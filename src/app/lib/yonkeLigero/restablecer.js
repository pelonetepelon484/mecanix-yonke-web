import { NextResponse } from 'next/server';
import { HORAS_CODIGO } from '../../../lib/codigoTemporal';
import { esCuentaInterna, whatsappDeCuentaInterna } from '../../../lib/yonkeLigero';

// POST /api/admin/restablecer-password  { usuarioId }  + Authorization: Bearer <pase del admin>
// Solo el admin, y solo cuentas que entran con WhatsApp: su correo interno no recibe correos, así
// que la contraseña la restablece él. Genera un código temporal (usarCodigo.js), lo devuelve UNA vez
// y solo guarda su hash; deja la contraseña anterior sin efecto, cierra las sesiones y anota quién lo
// generó. Le avisa por WhatsApp sin incluirlo. Quién llama y a qué cuenta se leen con el pase del
// admin: las reglas deciden. Todo lo de red llega en `deps`, para probar sin red.

const DIA_MS = 24 * 60 * 60 * 1000;
const HORA_MS = 60 * 60 * 1000;
export const MAX_RESTABLECER_DIA = 20;
const ID_DOCUMENTO = /^[A-Za-z0-9_-]{1,128}$/;
const ROLES_CON_WHATSAPP = ['yonkeLigero', 'yonke'];

function json(cuerpo, status = 200) {
  return NextResponse.json(cuerpo, { status, headers: { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' } });
}
const fallo = (motivo, status) => json({ ok: false, motivo }, status);

function tokenDe(request) {
  const m = /^Bearer\s+(.+)$/i.exec(request.headers.get('authorization') || '');
  return m ? m[1].trim() : null;
}

export function crearManejadorRestablecer(deps) {
  return async function restablecer(request) {
    const token = tokenDe(request);
    const uidAdmin = token ? await deps.uidDeToken(token) : null;
    if (!uidAdmin) return fallo('sinSesion', 401);
    const admin = await deps.leerComoUsuario(token, `usuarios/${uidAdmin}`);
    if (admin?.rol !== 'admin') return fallo('noEsAdmin', 403);

    let usuarioId;
    try {
      usuarioId = (await request.json())?.usuarioId;
    } catch {
      return fallo('datos', 400);
    }
    if (typeof usuarioId !== 'string' || !ID_DOCUMENTO.test(usuarioId)) return fallo('datos', 400);

    const usuario = await deps.leerComoUsuario(token, `usuarios/${usuarioId}`);
    if (!usuario || !ROLES_CON_WHATSAPP.includes(usuario.rol) || !esCuentaInterna(usuario.email)) return fallo('noAplica', 400);
    const whatsapp = whatsappDeCuentaInterna(usuario.email);
    if (!whatsapp) return fallo('noAplica', 400);

    const credenciales = deps.credenciales();
    if (!credenciales) return fallo('noConfigurado', 503);

    try {
      const db = await deps.obtenerDb();
      if (!db) return fallo('noDisponible', 503);
      const ventana = Math.floor(deps.ahora().getTime() / DIA_MS);
      const dentro = await deps.contar(db, deps.claveLimite('ligeroReset', 'global', ventana), MAX_RESTABLECER_DIA, DIA_MS);
      if (!dentro) return fallo('limite', 429);

      const temporal = deps.generarTemporal();
      const deshacer = await deps.guardarCodigo(db, {
        clave: deps.claveLimite('codigoWa', whatsapp, 'unico'), uid: usuarioId, yonkeId: usuario.yonkeId, adminUid: uidAdmin,
        codigoHash: deps.hashCodigo(temporal), expiraAt: new Date(deps.ahora().getTime() + HORAS_CODIGO * HORA_MS),
      });
      try {
        await deps.cambiarPassword(credenciales, usuarioId, deps.generarBloqueo());
      } catch (error) {
        await deshacer().catch(() => {});
        throw error;
      }

      try {
        const yonke = await deps.leerComoUsuario(token, `yonkes/${usuario.yonkeId}`);
        await deps.notificar(`🔑 Se restableció una contraseña en Mecanix\n\nYonke: ${yonke?.nombre || usuario.yonkeId}`);
      } catch (error) {
        console.warn('[restablecer] No se pudo avisar al admin', { message: error?.message });
      }
      return json({ ok: true, temporal });
    } catch (error) {
      console.error('[restablecer] No se pudo restablecer', { message: error?.message });
      return fallo('noDisponible', 503);
    }
  };
}
