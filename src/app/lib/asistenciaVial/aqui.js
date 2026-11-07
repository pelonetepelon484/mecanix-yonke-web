import { MENSAJES_UBICACION, esSecretoValido, ubicacionVigente, validarCheckin } from '../../../lib/ubicacionAsistencia';

// Lógica de /api/asistencia-vial/aqui (sin Firestore directo: todo llega en `deps`, para probarla).
// El proveedor manda el secreto de su enlace y una acción:
//   'estado'  -> su nombre y, si está en el mapa, hasta qué hora (para la pantalla).
//   'llegue'  -> { lat, lng, minutos }: guarda la ubicación redondeada hasta esa hora.
//   'me-fui'  -> se quita del mapa.
// Falla cerrada: sin las banderas (asistenciaVialActiva y asistenciaVialMapa), sin usuario de
// servicio, con un enlace que no existe o con el proveedor inactivo, no guarda nada.
// El secreto nunca se escribe en los registros.
const ESPERA_ENTRE_CHECKINS_MS = 15 * 1000;

const respuesta = (status, json) => ({ status, json });

export function crearManejadorAqui({
  leerBanderas, obtenerDb, hash, leerCheckin, leerProveedor, leerUbicacion, guardarUbicacion, borrarUbicacion, ahora = () => Date.now(),
}) {
  return async function atender(body) {
    const { secreto, accion } = body ?? {};
    if (!esSecretoValido(secreto) || !['estado', 'llegue', 'me-fui'].includes(accion)) {
      return respuesta(400, { error: MENSAJES_UBICACION.enlaceInvalido });
    }
    try {
      const banderas = await leerBanderas();
      if (!banderas?.asistenciaVialActiva || !banderas?.asistenciaVialMapa) return respuesta(404, { error: MENSAJES_UBICACION.noDisponible });
      const db = await obtenerDb();
      if (!db) return respuesta(503, { error: MENSAJES_UBICACION.noDisponible });

      const checkin = await leerCheckin(db, hash(secreto));
      if (!checkin?.proveedorId) return respuesta(404, { error: MENSAJES_UBICACION.enlaceInvalido });
      const proveedor = await leerProveedor(db, checkin.proveedorId);
      if (!proveedor || proveedor.activo !== true) return respuesta(404, { error: MENSAJES_UBICACION.enlaceInvalido });
      const id = checkin.proveedorId;
      const ahoraMs = ahora();

      if (accion === 'estado') {
        const u = await leerUbicacion(db, id);
        const hastaMs = u && ubicacionVigente(u, ahoraMs) ? u.hastaAt.toMillis() : null;
        return respuesta(200, { nombre: proveedor.nombre ?? '', hastaMs });
      }

      if (accion === 'me-fui') {
        await borrarUbicacion(db, id);
        return respuesta(200, { ok: true, hastaMs: null });
      }

      const r = validarCheckin({ lat: body.lat, lng: body.lng, minutos: body.minutos }, ahoraMs);
      if (!r.ok) return respuesta(400, { error: r.mensaje });
      const anterior = await leerUbicacion(db, id);
      const ultimo = anterior?.actualizadoAt?.toMillis?.();
      if (ultimo && ahoraMs - ultimo < ESPERA_ENTRE_CHECKINS_MS) {
        return respuesta(429, { error: 'Espera unos segundos antes de volver a intentar.' });
      }
      await guardarUbicacion(db, id, r.datos);
      return respuesta(200, { ok: true, hastaMs: r.datos.hastaMs });
    } catch (error) {
      console.error('[asistencia-vial/aqui] No se pudo atender', error?.code || error?.message);
      return respuesta(500, { error: MENSAJES_UBICACION.fallo });
    }
  };
}
