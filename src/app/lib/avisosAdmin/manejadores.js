import { NextResponse } from 'next/server';

// Lógica de los tres avisos por WhatsApp (CallMeBot) al admin:
//   POST /api/notificar-solicitud-pieza   (taller con sesión: "nuevo pedido de pieza")
//   POST /api/notificar-registro          (yonke recién registrado, ya con sesión)
//   POST /api/pedido-entrega-inmediata    (cliente sin cuenta: "entrega inmediata")
// El navegador ya NO manda el texto del aviso: el servidor lo arma con lo guardado en Firestore.
// Límites con los contadores de las alertas de clientes (pedidosClientesLimite, usuario de
// servicio). FALLA CERRADA SOLO PARA EL AVISO: sin pase válido, con límite alcanzado o si el
// contador falla, no se manda el aviso. La acción del usuario (pedido, registro, WhatsApp) ya
// ocurrió antes en el navegador y nunca depende de esta respuesta.
// Todo lo que toca la red llega en `deps` (las reales están en servicio.js), para probar sin red.

const MINUTO = 60 * 1000;
const HORA = 60 * MINUTO;
const DIA = 24 * HORA;

export const MAX_AVISOS_SOLICITUD_TALLER_HORA = 10;
export const MAX_AVISOS_ENTREGA_IP_HORA = 5;
export const MAX_AVISOS_ENTREGA_TOTAL_HORA = 10;
// "Un aviso por pedido / por yonke": la marca dura más que el pedido (5 días) y que el registro.
const VIDA_MARCA_UNICA = 30 * DIA;

const ID_DOCUMENTO = /^[A-Za-z0-9_-]{1,128}$/;

function json(cuerpo, status = 200) {
  return NextResponse.json(cuerpo, { status, headers: { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' } });
}
const avisado = () => json({ ok: true, avisado: true });
const sinAviso = (motivo, status = 200) => json({ ok: status < 400, avisado: false, motivo }, status);

function obtenerIp(request) {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return request.headers.get('x-real-ip') || 'unknown';
}

function tokenDe(request) {
  const m = /^Bearer\s+(.+)$/i.exec(request.headers.get('authorization') || '');
  return m ? m[1].trim() : '';
}

const texto = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

export function crearManejadoresAvisos(deps) {
  async function dbServicio() {
    try {
      return (await deps.obtenerDb()) ?? null;
    } catch (error) {
      console.error('[avisosAdmin] No se pudo preparar la conexión de servicio', { message: error?.message });
      return null;
    }
  }

  // Contador por ventana de tiempo (por hora). Si falla, se NIEGA el aviso.
  async function dentroDeLimite(db, tipo, valor, max, ventanaMs) {
    const ventana = Math.floor(deps.ahora().getTime() / ventanaMs);
    try {
      return await deps.contar(db, deps.claveLimite(tipo, valor, ventana), max, ventanaMs);
    } catch (error) {
      console.error('[avisosAdmin] Falló el contador de límite', { tipo, code: error?.code, message: error?.message });
      return false;
    }
  }

  // Marca de "ya se avisó" (máximo 1, sin ventana). false = repetido, o el contador falló.
  async function primeraVez(db, tipo, valor) {
    try {
      return await deps.contar(db, deps.claveLimite(tipo, valor, 'unico'), 1, VIDA_MARCA_UNICA);
    } catch (error) {
      console.error('[avisosAdmin] Falló la marca de aviso único', { tipo, code: error?.code, message: error?.message });
      return false;
    }
  }

  async function enviar(mensaje) {
    try {
      await deps.notificar(mensaje);
      return avisado();
    } catch (error) {
      console.error('[avisosAdmin] No se pudo enviar el aviso', { message: error?.message });
      return sinAviso('envio', 502);
    }
  }

  async function leerCuerpo(request) {
    try {
      return await request.json();
    } catch {
      return null;
    }
  }

  // POST /api/notificar-solicitud-pieza  { solicitudId }  + Authorization: Bearer <pase del taller>
  async function solicitudPieza(request) {
    const token = tokenDe(request);
    if (!token) return sinAviso('sinSesion', 401);
    const body = await leerCuerpo(request);
    const solicitudId = texto(body?.solicitudId, 200);
    if (!ID_DOCUMENTO.test(solicitudId)) return sinAviso('solicitudInvalida', 400);

    const uid = await deps.uidDeToken(token);
    if (!uid) return sinAviso('sinSesion', 401);
    // Con el pase del taller: si las reglas no le dejan leer el pedido, no es suyo (o no existe).
    const solicitud = await deps.leerComoUsuario(token, `solicitudesPiezas/${solicitudId}`);
    if (!solicitud || typeof solicitud.tallerId !== 'string' || !ID_DOCUMENTO.test(solicitud.tallerId)) return sinAviso('noEsTuyo', 403);
    // Los yonkes del estado también pueden leer pedidos abiertos: además, el taller del pedido
    // debe ser de quien llama.
    const taller = await deps.leerComoUsuario(token, `talleres/${solicitud.tallerId}`);
    if (!taller || taller.ownerUid !== uid) return sinAviso('noEsTuyo', 403);

    const db = await dbServicio();
    if (!db) return sinAviso('noDisponible', 503);
    if (!(await dentroDeLimite(db, 'avisoSolTaller', solicitud.tallerId, MAX_AVISOS_SOLICITUD_TALLER_HORA, HORA))) return sinAviso('limite', 429);
    if (!(await primeraVez(db, 'avisoSol', solicitudId))) return sinAviso('repetido');

    // Avisos en el dispositivo a los yonkes del estado (falla cerrada y nunca lanza; una sola vez
    // por pedido gracias a la marca de arriba).
    if (deps.avisarYonkes) {
      try {
        await deps.avisarYonkes(db, {
          tipo: 'pedidoTaller', id: solicitudId, estado: solicitud.estado, vehiculo: solicitud.vehiculo, pieza: solicitud.pieza,
        });
      } catch (error) {
        console.error('[avisosAdmin] No se pudieron mandar los avisos a los yonkes', { message: error?.message });
      }
    }

    const v = solicitud.vehiculo ?? {};
    const vehiculo = [texto(v.marca, 100), texto(v.modelo, 100), Number.isInteger(v.anio) ? v.anio : ''].filter(Boolean).join(' ');
    return enviar(`🔧 Nuevo pedido de pieza en Mecanix!\n\nTaller: ${texto(solicitud.tallerNombre, 200)}\nPieza: ${texto(solicitud.pieza, 200)}\nVehículo: ${vehiculo}\nEstado: ${texto(solicitud.estado, 100)}\n\nRevisa Firebase si necesitas avisar a los yonkes.`);
  }

  // POST /api/notificar-registro  (sin cuerpo)  + Authorization: Bearer <pase del yonke nuevo>
  // Al llamarse, el registro ya creó la cuenta (con sesión), la ficha del yonke y usuarios/{uid}.
  async function registroYonke(request) {
    const token = tokenDe(request);
    if (!token) return sinAviso('sinSesion', 401);
    const uid = await deps.uidDeToken(token);
    if (!uid) return sinAviso('sinSesion', 401);
    if (!ID_DOCUMENTO.test(uid)) return sinAviso('sinSesion', 401);

    const usuario = await deps.leerComoUsuario(token, `usuarios/${uid}`);
    if (!usuario || usuario.rol !== 'yonke' || typeof usuario.yonkeId !== 'string' || !ID_DOCUMENTO.test(usuario.yonkeId)) return sinAviso('noEsTuyo', 403);
    const yonke = await deps.leerComoUsuario(token, `yonkes/${usuario.yonkeId}`);
    if (!yonke || yonke.ownerUid !== uid) return sinAviso('noEsTuyo', 403);

    const db = await dbServicio();
    if (!db) return sinAviso('noDisponible', 503);
    if (!(await primeraVez(db, 'avisoRegistro', usuario.yonkeId))) return sinAviso('repetido');

    return enviar(`🏪 Nuevo yonke registrado en Mecanix!\n\nNombre: ${texto(yonke.nombre, 200)}\nCiudad: ${texto(yonke.ciudad, 100)}\nTeléfono: ${texto(yonke.telefono, 30)}\nCorreo: ${texto(usuario.email, 200)}\n\nRevisa Firebase para activarlo.`);
  }

  // POST /api/pedido-entrega-inmediata  { yonkeId, pieza, marca, modelo, anio }  (sin sesión)
  // El pedido del cliente es el WhatsApp que su navegador ya abrió; esto es solo el aviso extra.
  async function entregaInmediata(request) {
    const body = await leerCuerpo(request);
    if (!body) return sinAviso('solicitudInvalida', 400);
    const yonkeId = texto(body.yonkeId, 200);
    if (!ID_DOCUMENTO.test(yonkeId)) return sinAviso('solicitudInvalida', 400);

    const db = await dbServicio();
    if (!db) return sinAviso('noDisponible', 503);
    // Primero el límite por dirección de internet (protege las lecturas), luego el yonke, y al
    // final el tope total (así las peticiones inválidas no gastan el tope de todos).
    if (!(await dentroDeLimite(db, 'avisoEntregaIp', obtenerIp(request), MAX_AVISOS_ENTREGA_IP_HORA, HORA))) return sinAviso('limite', 429);
    let yonke;
    try {
      yonke = await deps.leerYonke(db, yonkeId);
    } catch (error) {
      console.error('[avisosAdmin] No se pudo leer el yonke', { message: error?.message });
      return sinAviso('noDisponible', 503);
    }
    if (!yonke || yonke.activo === false || yonke.entregaInmediata !== true) return sinAviso('yonkeSinEntrega', 404);
    if (!(await dentroDeLimite(db, 'avisoEntregaTotal', 'admin', MAX_AVISOS_ENTREGA_TOTAL_HORA, HORA))) return sinAviso('limite', 429);

    const pieza = texto(body.pieza, 100);
    const anio = body.anio != null ? String(body.anio).trim().slice(0, 4) : '';
    const vehiculo = [texto(body.marca, 60), texto(body.modelo, 60), anio].filter(Boolean).join(' ');
    return enviar(`⚡ PEDIDO ENTREGA INMEDIATA\nPieza: ${pieza || '(sin especificar)'}\nVehículo: ${vehiculo || '(sin especificar)'}\nYonke: ${texto(yonke.nombre, 200) || '(sin especificar)'}`);
  }

  return { solicitudPieza, registroYonke, entregaInmediata };
}
