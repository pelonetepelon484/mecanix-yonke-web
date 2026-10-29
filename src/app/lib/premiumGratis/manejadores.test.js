import { describe, expect, it, vi } from 'vitest';
import { claveLimite } from '../../../lib/pedidosClientesServidor';
import { VIDA_HUELLA_MS, crearManejadorPremiumGratis } from './manejadores';

// Google, Firestore y la transacción falsos. "leerComoUsuario" imita las reglas: cada pase solo lee
// su propio usuarios/{uid} y los talleres de los que es dueño.
const AHORA = new Date('2026-10-29T18:00:00Z');
const CREADO = new Date('2026-10-29T17:58:00Z');
const PASES = { 'pase-t1': 'uidT1', 'pase-t2': 'uidT2', 'pase-yonke': 'uidY' };

function crearFalsos(cambios = {}, { taller = {}, usuario = {} } = {}) {
  const docs = {
    'usuarios/uidT1': { rol: 'taller', tallerId: 'T1', email: 'J.Perez+registro@gmail.com', ...usuario },
    'usuarios/uidT2': { rol: 'taller', tallerId: 'T2', email: 'otro@taller.mx' },
    'usuarios/uidY': { rol: 'yonke', yonkeId: 'Y1', email: 'y@y.mx' },
    'talleres/T1': { ownerUid: 'uidT1', nombre: 'Taller Uno', whatsapp: '6641234567', creadoAt: CREADO, ...taller },
    'talleres/T2': { ownerUid: 'uidT2', nombre: 'Taller Dos', whatsapp: '6649999999', creadoAt: CREADO },
  };
  const huellasUsadas = new Set();
  const escrito = [];
  const deps = {
    leerConfig: vi.fn(async () => ({ premiumGratisHabilitado: true, mesesPremiumGratis: 3 })),
    uidDeToken: vi.fn(async (t) => PASES[t] ?? null),
    leerComoUsuario: vi.fn(async (t, ruta) => {
      const uid = PASES[t];
      const d = docs[ruta];
      if (!d) return null;
      if (ruta.startsWith('usuarios/')) return ruta === `usuarios/${uid}` ? d : null;
      return d.ownerUid === uid ? d : null;
    }),
    obtenerDb: vi.fn(async () => ({ falso: true })),
    claveLimite,
    otorgar: vi.fn(async (_db, datos) => {
      if (datos.huellas.some((h) => huellasUsadas.has(h))) return 'yaUsada';
      datos.huellas.forEach((h) => huellasUsadas.add(h));
      escrito.push(datos);
      return 'otorgada';
    }),
    ahora: () => AHORA,
    ...cambios,
  };
  return { deps, manejador: crearManejadorPremiumGratis(deps), escrito, huellasUsadas };
}

const peticion = (pase = 'pase-t1') => new Request('https://x/api/talleres/premium-gratis', {
  method: 'POST', headers: pase ? { Authorization: `Bearer ${pase}` } : {},
});
const llamar = async (manejador, req = peticion()) => { const r = await manejador(req); return { status: r.status, datos: await r.json() }; };

describe('POST /api/talleres/premium-gratis', () => {
  it('otorga: premiumHasta = creadoAt (servidor) + 3 meses, con las dos huellas', async () => {
    const { manejador, escrito } = crearFalsos();
    const { status, datos } = await llamar(manejador);
    expect(status).toBe(200);
    expect(datos).toEqual({ ok: true, otorgada: true, premiumHasta: '2027-01-29T17:58:00.000Z' });
    expect(escrito).toHaveLength(1);
    expect(escrito[0].tallerId).toBe('T1');
    expect(escrito[0].premiumHasta).toBeInstanceOf(Date);
    expect(escrito[0].vidaHuellaMs).toBe(VIDA_HUELLA_MS);
    expect(escrito[0].huellas).toEqual([
      claveLimite('promoTallerWa', '6641234567', 'unico'),
      claveLimite('promoTallerCorreo', 'jperez@gmail.com', 'unico'),
    ]);
    // Las huellas no llevan el número ni el correo en claro.
    expect(escrito[0].huellas.join()).not.toMatch(/6641234567|jperez|gmail/);
  });

  it('usa los meses de config/talleres', async () => {
    const { manejador } = crearFalsos({ leerConfig: vi.fn(async () => ({ premiumGratisHabilitado: true, mesesPremiumGratis: 1 })) });
    expect((await llamar(manejador)).datos.premiumHasta).toBe('2026-11-29T17:58:00.000Z');
  });

  it('bandera apagada, meses inválidos o error al leer: no hace nada', async () => {
    for (const leerConfig of [
      vi.fn(async () => null), vi.fn(async () => ({ premiumGratisHabilitado: 'true' })),
      vi.fn(async () => ({ premiumGratisHabilitado: true, mesesPremiumGratis: 24 })), vi.fn(async () => { throw new Error('x'); }),
    ]) {
      const { manejador, deps } = crearFalsos({ leerConfig });
      expect(await llamar(manejador)).toMatchObject({ status: 200, datos: { otorgada: false, motivo: 'apagada' } });
      expect(deps.uidDeToken).not.toHaveBeenCalled();
      expect(deps.otorgar).not.toHaveBeenCalled();
    }
  });

  it('sin pase, pase inválido, no taller o taller ajeno: no otorga', async () => {
    const { manejador, deps } = crearFalsos();
    expect((await llamar(manejador, peticion(null))).status).toBe(401);
    expect((await llamar(manejador, peticion('pase-falso'))).status).toBe(401);
    expect(await llamar(manejador, peticion('pase-yonke'))).toMatchObject({ status: 403, datos: { motivo: 'noEsTaller' } });
    const ajeno = crearFalsos({}, { usuario: { tallerId: 'T2' } });
    expect(await llamar(ajeno.manejador)).toMatchObject({ status: 403, datos: { motivo: 'noEsTuyo' } });
    expect(deps.otorgar).not.toHaveBeenCalled();
  });

  it('taller con cualquier plan ya puesto (Básico, Premium del admin o sin fecha): no se toca', async () => {
    for (const taller of [
      { plan: 'freemium' }, { plan: 'premium' }, { plan: 'premium', premiumHasta: '' },
      { plan: 'premium', premiumHasta: new Date('2027-05-01T00:00:00Z'), premiumOrigen: 'admin' }, { premiumHasta: '' },
    ]) {
      const { manejador, deps } = crearFalsos({}, { taller });
      expect(await llamar(manejador)).toMatchObject({ datos: { otorgada: false, motivo: 'yaTienePlan' } });
      expect(deps.otorgar).not.toHaveBeenCalled();
    }
  });

  it('reintento después de que el primero sí se guardó: responde otorgada sin escribir otra vez', async () => {
    const hasta = new Date('2027-01-29T17:58:00Z');
    const { manejador, deps } = crearFalsos({}, { taller: { plan: 'premium', premiumHasta: hasta, premiumOrigen: 'promo' } });
    expect(await llamar(manejador)).toMatchObject({ datos: { otorgada: true, premiumHasta: hasta.toISOString() } });
    expect(deps.otorgar).not.toHaveBeenCalled();
  });

  it('taller viejo (más de 50 minutos) o sin creadoAt: fuera de tiempo', async () => {
    for (const creadoAt of [new Date('2026-10-29T17:00:00Z'), new Date('2025-01-01T00:00:00Z'), undefined, 'ayer', new Date('2026-10-29T19:00:00Z')]) {
      const { manejador, deps } = crearFalsos({}, { taller: { creadoAt } });
      expect(await llamar(manejador)).toMatchObject({ datos: { otorgada: false, motivo: 'fueraDeTiempo' } });
      expect(deps.otorgar).not.toHaveBeenCalled();
    }
  });

  it('sin WhatsApp o correo usables: no hay promoción', async () => {
    const a = crearFalsos({}, { taller: { whatsapp: '123' } });
    expect((await llamar(a.manejador)).datos.motivo).toBe('datosIncompletos');
    const b = crearFalsos({}, { usuario: { email: '' } });
    expect((await llamar(b.manejador)).datos.motivo).toBe('datosIncompletos');
  });

  it('una vez por negocio: mismo WhatsApp o mismo correo (con puntos/+alias de Gmail) ya no reciben', async () => {
    const f = crearFalsos();
    expect((await llamar(f.manejador)).datos.otorgada).toBe(true);
    // Mismo WhatsApp, otro correo.
    const g = crearFalsos({ otorgar: f.deps.otorgar }, { usuario: { email: 'nuevo@taller.mx' } });
    expect(await llamar(g.manejador)).toMatchObject({ datos: { otorgada: false, motivo: 'yaUsada' } });
    // Otro WhatsApp, el mismo Gmail escrito distinto.
    const h = crearFalsos({ otorgar: f.deps.otorgar }, { taller: { whatsapp: '6640000000' }, usuario: { email: 'j.p.e.r.e.z+otra@googlemail.com' } });
    expect(await llamar(h.manejador)).toMatchObject({ datos: { otorgada: false, motivo: 'yaUsada' } });
    // Otro WhatsApp y otro correo: sí.
    const i = crearFalsos({ otorgar: f.deps.otorgar }, { taller: { whatsapp: '6640000000' }, usuario: { email: 'nuevo@taller.mx' } });
    expect((await llamar(i.manejador)).datos.otorgada).toBe(true);
  });

  it('sin conexión de servicio o si falla la transacción: 503 (el registro sigue como Básico)', async () => {
    const a = crearFalsos({ obtenerDb: vi.fn(async () => null) });
    expect(await llamar(a.manejador)).toMatchObject({ status: 503, datos: { otorgada: false, motivo: 'noDisponible' } });
    const b = crearFalsos({ obtenerDb: vi.fn(async () => { throw new Error('login'); }) });
    expect((await llamar(b.manejador)).status).toBe(503);
    const c = crearFalsos({ otorgar: vi.fn(async () => { throw Object.assign(new Error('denied'), { code: 'permission-denied' }); }) });
    expect((await llamar(c.manejador)).status).toBe(503);
  });

  it('la promoción SIEMPRE lleva fecha (nunca "sin vencimiento")', async () => {
    const { manejador, escrito } = crearFalsos();
    await llamar(manejador);
    expect(escrito[0].premiumHasta).toBeInstanceOf(Date);
    expect(Number.isNaN(escrito[0].premiumHasta.getTime())).toBe(false);
    expect(escrito[0].premiumHasta.getTime()).toBeGreaterThan(AHORA.getTime());
  });
});
