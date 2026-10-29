import { NextResponse } from 'next/server';
import { ORIGEN_PROMO, banderaPremiumGratis, normalizarCorreo, normalizarWhatsapp, sumarMeses } from '../../../lib/premiumGratis';

// POST /api/talleres/premium-gratis  (sin cuerpo)  + Authorization: Bearer <pase del taller nuevo>
// Lo llama el registro de talleres justo después de crear la cuenta. Con config/talleres
// encendido, le da al taller recién creado plan Premium con premiumHasta = creadoAt (hora del
// servidor) + N meses y premiumOrigen 'promo'. El navegador no manda fechas ni datos: todo se lee
// de Firestore con el pase del taller (las reglas deciden qué puede ver) y se escribe con el
// usuario de servicio, que las reglas solo dejan hacer esto (promoPremiumGratisOk).
// Una vez por negocio: huellas (HMAC con sal secreta) del WhatsApp y del correo normalizados en
// pedidosClientesLimite; si cualquiera de las dos ya existe, no hay promoción. Taller + huellas
// se escriben en una sola transacción: o todo o nada.
// Nunca rompe el registro: cualquier "no" deja al taller como Básico, igual que hoy.
// Todo lo que toca la red llega en `deps` (las reales están en servicio.js), para probar sin red.

const MINUTO = 60 * 1000;
// Las reglas dan 1 hora desde creadoAt; aquí un poco menos, por si los relojes no coinciden.
export const VENTANA_REGISTRO_MS = 50 * MINUTO;
// Las huellas se borran solas (política TTL de expiraEn) a los 3 años.
export const VIDA_HUELLA_MS = 3 * 365 * 24 * 60 * MINUTO;
const ID_DOCUMENTO = /^[A-Za-z0-9_-]{1,128}$/;

function json(cuerpo, status = 200) {
  return NextResponse.json(cuerpo, { status, headers: { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' } });
}
const sinPromo = (motivo, status = 200) => json({ ok: status < 400, otorgada: false, motivo }, status);
const otorgada = (premiumHasta) => json({ ok: true, otorgada: true, premiumHasta: premiumHasta.toISOString() });

function tokenDe(request) {
  const m = /^Bearer\s+(.+)$/i.exec(request.headers.get('authorization') || '');
  return m ? m[1].trim() : '';
}

export function crearManejadorPremiumGratis(deps) {
  return async function premiumGratis(request) {
    let bandera;
    try {
      bandera = banderaPremiumGratis(await deps.leerConfig());
    } catch (e) {
      console.error('[premiumGratis] No se pudo leer config/talleres', { message: e?.message });
      bandera = banderaPremiumGratis(null);
    }
    if (!bandera.habilitado) return sinPromo('apagada');

    const token = tokenDe(request);
    if (!token) return sinPromo('sinSesion', 401);
    const uid = await deps.uidDeToken(token);
    if (!uid) return sinPromo('sinSesion', 401);

    const usuario = await deps.leerComoUsuario(token, `usuarios/${uid}`);
    const tallerId = usuario?.tallerId;
    if (usuario?.rol !== 'taller' || typeof tallerId !== 'string' || !ID_DOCUMENTO.test(tallerId)) return sinPromo('noEsTaller', 403);
    const taller = await deps.leerComoUsuario(token, `talleres/${tallerId}`);
    if (!taller || taller.ownerUid !== uid) return sinPromo('noEsTuyo', 403);

    // Ya la tiene (p. ej. el reintento después de un primer intento que sí se guardó).
    if (taller.premiumOrigen === ORIGEN_PROMO && taller.premiumHasta instanceof Date) return otorgada(taller.premiumHasta);
    // Cualquier plan ya puesto (Básico o Premium del admin): no se toca.
    if ('plan' in taller || 'premiumHasta' in taller || 'premiumOrigen' in taller) return sinPromo('yaTienePlan');

    const creadoAt = taller.creadoAt;
    const ahora = deps.ahora();
    if (!(creadoAt instanceof Date) || Number.isNaN(creadoAt.getTime())) return sinPromo('fueraDeTiempo');
    const edad = ahora.getTime() - creadoAt.getTime();
    if (edad < -5 * MINUTO || edad > VENTANA_REGISTRO_MS) return sinPromo('fueraDeTiempo');

    const whatsapp = normalizarWhatsapp(taller.whatsapp);
    const correo = normalizarCorreo(usuario.email);
    if (!whatsapp || !correo) return sinPromo('datosIncompletos');

    // Siempre una fecha: la promoción nunca es "sin vencimiento".
    const premiumHasta = sumarMeses(creadoAt, bandera.meses);
    if (!(premiumHasta.getTime() > ahora.getTime())) return sinPromo('fueraDeTiempo');

    const db = await deps.obtenerDb().catch((e) => {
      console.error('[premiumGratis] No se pudo preparar la conexión de servicio', { message: e?.message });
      return null;
    });
    if (!db) return sinPromo('noDisponible', 503);

    let resultado;
    try {
      resultado = await deps.otorgar(db, {
        tallerId, premiumHasta, vidaHuellaMs: VIDA_HUELLA_MS,
        huellas: [deps.claveLimite('promoTallerWa', whatsapp, 'unico'), deps.claveLimite('promoTallerCorreo', correo, 'unico')],
      });
    } catch (e) {
      console.error('[premiumGratis] No se pudo guardar la promoción', { tallerId, code: e?.code, message: e?.message });
      return sinPromo('noDisponible', 503);
    }
    if (resultado === 'yaUsada') return sinPromo('yaUsada');
    return otorgada(premiumHasta);
  };
}
