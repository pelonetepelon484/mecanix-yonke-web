import { NextResponse } from 'next/server';
import { MENSAJES_CODIGO, validarUsoCodigo } from '../../../lib/codigoTemporal';

// POST /api/yonkes/usar-codigo  { whatsapp, codigo, password }
// El yonke cambia su código temporal por una contraseña nueva. El servidor lo comprueba y lo consume
// en una transacción (un solo uso) antes de tocar la cuenta. El mensaje es el mismo si el número no
// existe, el código no coincide o ya venció. Falla cerrada si el contador no responde. Ni el código ni
// la contraseña se guardan o se escriben en los registros. Todo lo de red llega en `deps`.
const DIA_MS = 24 * 60 * 60 * 1000;
export const MAX_INTENTOS_WHATSAPP_DIA = 10;
export const MAX_INTENTOS_IP_DIA = 20;

function json(cuerpo, status = 200) {
  return NextResponse.json(cuerpo, { status, headers: { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' } });
}
const fallo = (motivo, mensaje, status) => json({ ok: false, motivo, mensaje }, status);

function obtenerIp(request) {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return request.headers.get('x-real-ip') || 'unknown';
}

export function crearManejadorUsarCodigo(deps) {
  const noDisponible = () => fallo('noDisponible', MENSAJES_CODIGO.noDisponible, 503);

  return async function usarCodigo(request) {
    let cuerpo;
    try {
      cuerpo = await request.json();
    } catch {
      return fallo('datos', MENSAJES_CODIGO.codigo, 400);
    }
    const { error, datos } = validarUsoCodigo(cuerpo);
    if (error) return fallo('datos', error, 400);

    const credenciales = deps.credenciales();
    if (!credenciales) return noDisponible();

    try {
      const db = await deps.obtenerDb();
      if (!db) return noDisponible();
      const ventana = Math.floor(deps.ahora().getTime() / DIA_MS);
      const dentro = await deps.contar(db, deps.claveLimite('codigoIntentoWa', datos.whatsapp, ventana), MAX_INTENTOS_WHATSAPP_DIA, DIA_MS)
        && await deps.contar(db, deps.claveLimite('codigoIntentoIp', obtenerIp(request), ventana), MAX_INTENTOS_IP_DIA, DIA_MS);
      if (!dentro) return fallo('limite', MENSAJES_CODIGO.limite, 429);

      const clave = deps.claveLimite('codigoWa', datos.whatsapp, 'unico');
      const guardado = await deps.reclamarCodigo(db, clave, datos.codigo, deps.ahora());
      if (!guardado) return fallo('codigo', MENSAJES_CODIGO.codigo, 400);

      try {
        await deps.cambiarPassword(credenciales, guardado.uid, datos.password);
      } catch (errorCambio) {
        // Google no lo confirmó: el código sigue sirviendo para reintentar.
        await deps.restaurarCodigo(db, clave, guardado);
        throw errorCambio;
      }
      return json({ ok: true });
    } catch (errorServidor) {
      console.error('[usarCodigo] No se pudo completar', { message: errorServidor?.message });
      return noDisponible();
    }
  };
}
