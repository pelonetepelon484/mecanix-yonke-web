import { NextResponse } from 'next/server';
import { estaVencido } from '../../../lib/pedidosClientes';
import { MENSAJES_LIGERO, configLigeros, correoInterno, numerosDeYonkes, validarRegistroLigero } from '../../../lib/yonkeLigero';

// POST /api/yonkes/registro-ligero  { nombre, whatsapp, password, pedidoId, aceptaTerminos, aceptaPrivacidad, declaraAutorizacion }
// Alta del yonke ligero desde una búsqueda activa. El navegador nunca escribe en Firestore: con
// config/yonkesLigeros.habilitado, el servidor revisa los límites, toma el estado de la alerta y
// crea la cuenta y, en una sola transacción, ficha, historial de aceptación, usuario y huella del
// WhatsApp. Si eso falla, borra la cuenta: el número no queda atrapado. Después el navegador inicia
// sesión. La contraseña solo pasa por aquí: nunca se guarda ni se escribe en los registros.
// Todo lo que toca la red llega en `deps` (las reales están en servicio.js), para probar sin red.

const DIA_MS = 24 * 60 * 60 * 1000;
// Las huellas se borran solas (política TTL de expiraEn) a los 3 años.
export const VIDA_HUELLA_MS = 3 * 365 * DIA_MS;

function json(cuerpo, status = 200) {
  return NextResponse.json(cuerpo, { status, headers: { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' } });
}
const fallo = (motivo, mensaje, status) => json({ ok: false, motivo, mensaje }, status);

function obtenerIp(request) {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return request.headers.get('x-real-ip') || 'unknown';
}

export function crearManejadorRegistroLigero(deps) {
  const noDisponible = () => fallo('noDisponible', MENSAJES_LIGERO.noDisponible, 503);

  // Contador en Firestore. Si falla, se NIEGA (falla cerrada).
  async function dentroDeLimite(db, tipo, valor, max) {
    const ventana = Math.floor(deps.ahora().getTime() / DIA_MS);
    try {
      return await deps.contar(db, deps.claveLimite(tipo, valor, ventana), max, DIA_MS);
    } catch (error) {
      console.error('[yonkeLigero] Falló el contador de límite', { tipo, code: error?.code });
      return false;
    }
  }

  return async function registroLigero(request) {
    let config;
    try {
      config = configLigeros(await deps.leerConfig());
    } catch (error) {
      console.error('[yonkeLigero] No se pudo leer la bandera', { code: error?.code });
      return noDisponible();
    }
    if (!config.habilitado) return noDisponible();

    let cuerpo;
    try {
      cuerpo = await request.json();
    } catch {
      return fallo('datos', MENSAJES_LIGERO.noDisponible, 400);
    }
    const { error: errorDatos, datos } = validarRegistroLigero(cuerpo);
    if (errorDatos) return fallo('datos', errorDatos, 400);

    let cuenta = null;
    try {
      const db = await deps.obtenerDb();
      if (!db) return noDisponible();
      if (!(await dentroDeLimite(db, 'ligeroIp', obtenerIp(request), config.maxPorIpDia))) return fallo('limite', MENSAJES_LIGERO.limite, 429);

      // El estado sale de la alerta, nunca del navegador.
      const pedido = await deps.leerPedido(db, datos.pedidoId);
      if (!pedido || pedido.estadoPedido !== 'abierta' || estaVencido(pedido.expiraAt, deps.ahora())) {
        return fallo('alerta', MENSAJES_LIGERO.alerta, 410);
      }

      const huella = deps.claveLimite('ligeroWa', datos.whatsapp, 'unico');
      if (await deps.huellaExiste(db, huella)) return fallo('yaRegistrado', MENSAJES_LIGERO.yaRegistrado, 409);
      if (numerosDeYonkes(await deps.leerYonkes(db)).has(datos.whatsapp)) return fallo('yaRegistrado', MENSAJES_LIGERO.yaRegistrado, 409);

      // El máximo del día va al final: solo lo gastan los números nuevos de verdad.
      if (!(await dentroDeLimite(db, 'ligeroDia', 'global', config.maxPorDia))) return fallo('limite', MENSAJES_LIGERO.limite, 429);

      const version = await deps.versionTerminos();
      const correo = correoInterno(datos.whatsapp);
      try {
        cuenta = await deps.crearCuenta(correo, datos.password);
      } catch (error) {
        if (error?.code === 'auth/email-already-in-use') return fallo('yaRegistrado', MENSAJES_LIGERO.yaRegistrado, 409);
        if (error?.code === 'auth/weak-password') return fallo('datos', MENSAJES_LIGERO.password, 400);
        throw error;
      }

      let resultado;
      try {
        resultado = await deps.guardar(db, {
          uid: cuenta.uid, nombre: datos.nombre, whatsapp: datos.whatsapp, estado: pedido.estado, correo, version, huella, vidaHuellaMs: VIDA_HUELLA_MS,
        });
      } catch (error) {
        await cuenta.borrar();
        throw error;
      }
      if (resultado !== 'ok') {
        await cuenta.borrar();
        return fallo('yaRegistrado', MENSAJES_LIGERO.yaRegistrado, 409);
      }

      // Nunca tumba el registro. Sin el número ni la contraseña.
      try {
        await deps.notificar(`🟢 Nuevo yonke ligero en Mecanix\n\nNombre: ${datos.nombre}\nEstado: ${await deps.nombreEstado(pedido.estado)}`);
      } catch (error) {
        console.warn('[yonkeLigero] No se pudo avisar al admin', { message: error?.message });
      }
      return json({ ok: true, estado: pedido.estado });
    } catch (error) {
      console.error('[yonkeLigero] No se pudo completar el registro', { code: error?.code });
      return noDisponible();
    } finally {
      await cuenta?.cerrar().catch(() => {});
    }
  };
}
