import { NextResponse } from 'next/server';
import { whatsappDeCuentaInterna } from '../../../lib/yonkeLigero';

// POST /api/admin/liberar-numero  { usuarioId }  + Authorization: Bearer <pase del admin>
// Lo llama el borrado de un yonke en /admin, antes de borrar su usuario: quita la huella del
// WhatsApp (con el pase del admin: las reglas deciden) y la cuenta (con la llave de Google), para
// que ese número se pueda volver a registrar. Solo cuentas que entran con WhatsApp. Dice qué pudo
// hacer: si falta la llave, la huella sí se quita y la cuenta queda para borrarla en la consola.
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

export function crearManejadorLiberar(deps) {
  return async function liberar(request) {
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
    const whatsapp = whatsappDeCuentaInterna(usuario?.email);
    if (!usuario || !ROLES_CON_WHATSAPP.includes(usuario.rol) || !whatsapp) return fallo('noAplica', 400);

    const huella = await deps.borrarComoUsuario(token, `pedidosClientesLimite/${deps.claveLimite('ligeroWa', whatsapp, 'unico')}`);

    let cuenta = false;
    const credenciales = deps.credenciales();
    if (credenciales) {
      try {
        await deps.borrarCuenta(credenciales, usuarioId);
        cuenta = true;
      } catch (error) {
        console.error('[liberar] No se pudo borrar la cuenta', { message: error?.message });
      }
    }

    try {
      await deps.notificar(`🗑️ Se liberó un número en Mecanix\n\nCuenta: ${usuarioId}${cuenta ? '' : '\nFalta borrar la cuenta en Firebase Authentication.'}`);
    } catch (error) {
      console.warn('[liberar] No se pudo avisar al admin', { message: error?.message });
    }
    return json({ ok: huella && cuenta, huella, cuenta });
  };
}
