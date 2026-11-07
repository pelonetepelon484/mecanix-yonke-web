// Solo servidor. POST /api/comparador. Recibe { tipo, vinA, vinB, parteA, parteB, dispositivo } y,
// si hay sesión, Authorization: Bearer <pase>. Todas las dependencias llegan por "deps" (ver
// servicio.js) para poder probarlo sin Firestore ni NHTSA.
//
// Orden: bandera -> entrada -> sesión (y "requerir login") -> límite diario -> VIN (caché primero,
// después vPIC) -> registros de equivalencias -> resultado -> contadores del día.
// Falla cerrada: sin bandera 404; sin usuario de servicio o si falla el contador, no se compara.
// Privacidad: la IP, el identificador del navegador y el uid solo se guardan como hash (HMAC con sal
// secreta) dentro del ID del contador. Del VIN, solo la clave sin número de serie.
import {
  MENSAJES_COMPARADOR, claveVin, compararVehiculos, resultadoPorPieza, validarEntrada, vehiculoDesdeVpic, vinParaMostrar,
} from '../../../lib/comparadorPiezas';
import { ROLES_CON_CUENTA } from '../../../lib/configComparador';

const DIA_MS = 24 * 60 * 60 * 1000;
export const dispositivoValido = (d) => typeof d === 'string' && /^[A-Za-z0-9_-]{16,64}$/.test(d);

// Día en la hora de Tijuana (AAAA-MM-DD): el límite se reinicia a medianoche de aquí.
export const diaDe = (fecha) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Tijuana', year: 'numeric', month: '2-digit', day: '2-digit' }).format(fecha);

export function obtenerIp(request) {
  const forwarded = request?.headers?.get?.('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return request?.headers?.get?.('x-real-ip') || 'unknown';
}

function tokenDe(request) {
  const m = /^Bearer\s+(.+)$/i.exec(request?.headers?.get?.('authorization') || '');
  return m ? m[1].trim() : null;
}

const json = (status, cuerpo) => ({ status, json: cuerpo });

export function crearManejadorComparador(deps) {
  async function cuentaDe(request) {
    const token = tokenDe(request);
    if (!token) return null;
    const uid = await deps.uidDeToken(token);
    if (!uid) return null;
    const rol = await deps.leerRol(token, uid);
    return ROLES_CON_CUENTA.includes(rol) ? { uid, rol } : null;
  }

  // Cada VIN: caché primero; si no está, vPIC (y se guarda). Devuelve { vehiculo, origen }.
  async function vehiculoDe(db, vin, uso) {
    if (!vin) return { vehiculo: null, origen: 'sin_vin' };
    const clave = claveVin(vin);
    const guardado = await deps.leerCacheVin(db, clave);
    if (guardado) { uso.vinCache += 1; return { vehiculo: guardado, origen: 'cache' }; }
    const r = await deps.decodificar(clave);
    if (r.estado === 'fallo') { uso.vinFallos += 1; return { vehiculo: null, origen: 'fallo' }; }
    const vehiculo = r.estado === 'ok' ? vehiculoDesdeVpic(r.fila) : { ...vehiculoDesdeVpic(null), sinDatos: true };
    uso.vinNuevos += 1;
    try { await deps.guardarCacheVin(db, clave, vehiculo); } catch (error) {
      console.warn('[comparador] No se pudo guardar el caché del VIN', error?.code || error?.message);
    }
    return { vehiculo, origen: 'nuevo' };
  }

  return async function atender(request, body) {
    const config = await deps.leerConfig();
    if (!config.habilitado) return json(404, { error: MENSAJES_COMPARADOR.noDisponible });

    const entrada = validarEntrada(body || {});
    if (!entrada.ok) return json(400, { error: entrada.mensaje });
    const { tipo, vinA, vinB, parteA, parteB } = entrada.datos;

    let db;
    try { db = await deps.obtenerDb(); } catch { db = null; }
    if (!db) return json(503, { error: MENSAJES_COMPARADOR.noDisponible });

    const cuenta = await cuentaDe(request);
    if (config.requiereLogin && !cuenta) return json(401, { error: MENSAJES_COMPARADOR.login, requiereLogin: true });

    const ahora = deps.ahora();
    const dia = diaDe(ahora);
    const expiraEn = new Date(ahora.getTime() + 2 * DIA_MS);
    const contadores = cuenta
      ? [{ id: `cuenta_${deps.hash(cuenta.uid)}_${dia}`, max: config.limiteDiarioConCuenta }]
      : [
        { id: `ip_${deps.hash(obtenerIp(request))}_${dia}`, max: config.limiteDiarioIp },
        ...(dispositivoValido(body?.dispositivo) ? [{ id: `disp_${deps.hash(body.dispositivo)}_${dia}`, max: config.limiteDiarioDispositivo }] : []),
      ];

    const cobrados = [];
    try {
      for (const c of contadores) {
        if (!(await deps.contarLimite(db, c.id, c.max, expiraEn))) {
          for (const id of cobrados) await deps.devolverLimite(db, id).catch(() => {});
          await deps.sumarUso(db, dia, { limiteAlcanzado: 1 }).catch(() => {});
          return json(429, { error: cuenta ? MENSAJES_COMPARADOR.limiteCuenta : MENSAJES_COMPARADOR.limite, limite: true, conCuenta: !!cuenta });
        }
        cobrados.push(c.id);
      }
    } catch (error) {
      console.error('[comparador] Falló el contador de límite', error?.code || error?.message);
      return json(503, { error: MENSAJES_COMPARADOR.fallo });
    }

    try {
      const uso = { consultas: 1, vinNuevos: 0, vinCache: 0, vinFallos: 0 };
      const [a, b] = await Promise.all([vehiculoDe(db, vinA, uso), vehiculoDe(db, vinB, uso)]);
      const registros = await deps.buscarRegistros(db, {
        tipo, parteA, parteB, claveA: vinA ? claveVin(vinA) : null, claveB: vinB ? claveVin(vinB) : null, vehiculoA: a.vehiculo, vehiculoB: b.vehiculo,
      });
      const resultado = resultadoPorPieza({ tipo, parteA, parteB }, a.vehiculo, b.vehiculo, registros);
      const comparacion = a.vehiculo && b.vehiculo ? compararVehiculos(a.vehiculo, b.vehiculo) : null;

      // Si vPIC no respondió, esta consulta no cuenta contra el límite de nadie.
      if (uso.vinFallos > 0) for (const id of cobrados) await deps.devolverLimite(db, id).catch(() => {});
      await deps.sumarUso(db, dia, uso).catch((error) => console.warn('[comparador] No se pudo sumar el uso', error?.code || error?.message));

      const lado = (vin, parte, r) => ({
        vin: vinParaMostrar(vin), parte,
        estado: r.origen === 'sin_vin' ? 'sin_vin' : (r.vehiculo && !r.vehiculo.sinDatos ? 'ok' : 'sin_datos'),
        datos: r.vehiculo && !r.vehiculo.sinDatos ? r.vehiculo : null,
      });
      return json(200, {
        tipo,
        vehiculoA: lado(vinA, parteA, a),
        vehiculoB: lado(vinB, parteB, b),
        comparacion,
        resultado: resultado.resultado,
        nota: resultado.nota,
        motivos: resultado.motivos,
      });
    } catch (error) {
      console.error('[comparador] Falló la comparación', error?.code || error?.message);
      for (const id of cobrados) await deps.devolverLimite(db, id).catch(() => {});
      return json(500, { error: MENSAJES_COMPARADOR.fallo });
    }
  };
}
