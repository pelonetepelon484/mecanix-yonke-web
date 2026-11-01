import { NextResponse } from 'next/server';
import { MENSAJES_COMPLETAR, validarCompletarRegistro } from '../../../lib/yonkeLigero';

// POST /api/yonkes/completar-registro  { ciudad, direccion, telefono, correo? }
//      + Authorization: Bearer <pase del yonke ligero>
// Pasa de ligero a completo: ficha y rol en un solo guardado del usuario de servicio (y el correo,
// si lo dejó). Mismo id: sus respuestas y su contador del día siguen ahí. Quién llama y su ficha se
// leen con su pase, y del cuerpo solo se toman esos cuatro datos: nombre, WhatsApp, estado o marcas
// no se pueden colar. No depende de config/yonkesLigeros: apagarla no deja a nadie atorado.
// Todo lo que toca la red llega en `deps`, para probar sin red.

const ID_DOCUMENTO = /^[A-Za-z0-9_-]{1,128}$/;

function json(cuerpo, status = 200) {
  return NextResponse.json(cuerpo, { status, headers: { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' } });
}
const fallo = (motivo, mensaje, status) => json({ ok: false, motivo, mensaje }, status);

function tokenDe(request) {
  const m = /^Bearer\s+(.+)$/i.exec(request.headers.get('authorization') || '');
  return m ? m[1].trim() : null;
}

export function crearManejadorCompletar(deps) {
  const noDisponible = () => fallo('noDisponible', MENSAJES_COMPLETAR.noDisponible, 503);

  return async function completar(request) {
    const token = tokenDe(request);
    const uid = token ? await deps.uidDeToken(token) : null;
    if (!uid) return fallo('sinSesion', MENSAJES_COMPLETAR.noDisponible, 401);

    const usuario = await deps.leerComoUsuario(token, `usuarios/${uid}`);
    if (usuario?.rol !== 'yonkeLigero' || typeof usuario.yonkeId !== 'string' || !ID_DOCUMENTO.test(usuario.yonkeId)) {
      return fallo('noEsLigero', MENSAJES_COMPLETAR.noDisponible, 403);
    }
    const yonke = await deps.leerComoUsuario(token, `yonkes/${usuario.yonkeId}`);
    if (!yonke || yonke.ownerUid !== uid || yonke.tipoRegistro !== 'ligero') return fallo('noEsLigero', MENSAJES_COMPLETAR.noDisponible, 403);

    let cuerpo;
    try {
      cuerpo = await request.json();
    } catch {
      return fallo('datos', MENSAJES_COMPLETAR.noDisponible, 400);
    }
    const { error, datos } = validarCompletarRegistro(cuerpo, yonke.estado);
    if (error) return fallo('datos', error, 400);

    try {
      const db = await deps.obtenerDb();
      if (!db) return noDisponible();
      await deps.guardar(db, { uid, yonkeId: usuario.yonkeId, ...datos });
    } catch (err) {
      console.error('[yonkeLigero] No se pudo completar el registro', { code: err?.code });
      return noDisponible();
    }

    try {
      await deps.notificar(`✅ Un yonke ligero completó su registro\n\nNombre: ${yonke.nombre}\nCiudad: ${datos.ciudad}\nTeléfono: ${datos.telefono}\n\nRevísalo para verificarlo.`);
    } catch (err) {
      console.warn('[yonkeLigero] No se pudo avisar al admin', { message: err?.message });
    }
    return json({ ok: true });
  };
}
