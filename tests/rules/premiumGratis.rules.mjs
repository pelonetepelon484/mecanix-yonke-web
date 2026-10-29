// Pruebas de reglas: promoción "Premium gratis al registrarte" de talleres (promoPremiumGratisOk en
// ../../firestore.rules). Solo el usuario de servicio, con config/talleres encendido, a un taller sin
// plan, en su primera hora, con fecha (nunca vacía) y a más tardar creadoAt + meses x 31 días.
// El dueño sigue sin poder tocar plan, premiumHasta ni premiumOrigen.
// Comando (desde la raíz del repo):  npm run test:rules
import { describe, it, before, after } from 'node:test';
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { Timestamp, deleteField, doc, setDoc, updateDoc, writeBatch, serverTimestamp } from 'firebase/firestore';

const reglas = readFileSync(new URL('../../firestore.rules', import.meta.url), 'utf8');
const DIA = 24 * 60 * 60 * 1000;
let env;

const ahora = () => Date.now();
const fecha = (ms) => Timestamp.fromMillis(ms);

function taller(ownerUid, creadoAtMs, extra = {}) {
  return {
    nombre: 'Taller de prueba', whatsapp: '6641234567', ciudad: 'Tijuana', logoUrl: '', ownerUid, activo: true,
    creadoAt: fecha(creadoAtMs), aceptacionVersion: 'v1',
    avisoPrivacidad: { modo: 'generado', versionPlantilla: 'aviso-1', fecha: fecha(creadoAtMs) },
    ...extra,
  };
}

async function sembrar({ configTalleres = { premiumGratisHabilitado: true, mesesPremiumGratis: 3 }, tallerT1 = {} } = {}) {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'config', 'cotizaciones'), { terminosVersion: 'v1', avisoTallerVersion: 'aviso-1' });
    if (configTalleres) await setDoc(doc(db, 'config', 'talleres'), configTalleres);
    await setDoc(doc(db, 'usuarios', 'svc'), { rol: 'servicio' });
    await setDoc(doc(db, 'usuarios', 'adm'), { rol: 'admin' });
    await setDoc(doc(db, 'usuarios', 't1'), { rol: 'taller', tallerId: 'T1', email: 't1@prueba.mx' });
    await setDoc(doc(db, 'usuarios', 't2'), { rol: 'taller', tallerId: 'T2', email: 't2@prueba.mx' });
    // T1: recién registrado (hace 2 minutos). VIEJO: registrado hace 2 horas.
    await setDoc(doc(db, 'talleres', 'T1'), taller('t1', ahora() - 2 * 60 * 1000, tallerT1));
    await setDoc(doc(db, 'talleres', 'T2'), taller('t2', ahora() - 2 * 60 * 1000));
    await setDoc(doc(db, 'talleres', 'VIEJO'), taller('t3', ahora() - 2 * 60 * 60 * 1000));
    for (const id of ['T1', 'T2', 'VIEJO']) await setDoc(doc(db, 'talleres', id, 'aceptaciones', 'v1'), { version: 'v1', fecha: new Date() });
  });
}

const como = (uid) => env.authenticatedContext(uid).firestore();
const promo = (dias = 90, extra = {}) => ({ plan: 'premium', premiumHasta: fecha(ahora() + dias * DIA), premiumOrigen: 'promo', ...extra });
const darPromo = (uid, id, datos = promo()) => updateDoc(doc(como(uid), 'talleres', id), datos);

before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-premium-gratis',
    firestore: { rules: reglas, host: '127.0.0.1', port: 8181 },
  });
});
after(async () => { await env.cleanup(); });

describe('promoción Premium gratis: el usuario de servicio', () => {
  it('la da a un taller recién registrado, con las huellas en el mismo lote', async () => {
    await sembrar();
    const db = como('svc');
    const lote = writeBatch(db);
    lote.update(doc(db, 'talleres', 'T1'), promo());
    for (const clave of ['promoTallerWa_abc_unico', 'promoTallerCorreo_def_unico']) {
      lote.set(doc(db, 'pedidosClientesLimite', clave), { count: 1, actualizado: new Date(), expiraEn: fecha(ahora() + 3 * 365 * DIA) });
    }
    await assertSucceeds(lote.commit());
  });

  it('NO con la bandera apagada, sin config/talleres o con meses inválidos', async () => {
    for (const configTalleres of [
      { premiumGratisHabilitado: false, mesesPremiumGratis: 3 }, { premiumGratisHabilitado: 'true' }, null,
      { premiumGratisHabilitado: true, mesesPremiumGratis: 0 }, { premiumGratisHabilitado: true, mesesPremiumGratis: 13 },
      { premiumGratisHabilitado: true, mesesPremiumGratis: '3' },
    ]) {
      await sembrar({ configTalleres });
      await assertFails(darPromo('svc', 'T1'));
    }
  });

  it('sin mesesPremiumGratis usa 3 (hasta 93 días)', async () => {
    await sembrar({ configTalleres: { premiumGratisHabilitado: true } });
    await assertFails(darPromo('svc', 'T1', promo(100)));
    await assertSucceeds(darPromo('svc', 'T1', promo(90)));
  });

  it('NUNCA sin fecha ("sin vencimiento"): vacía, null o sin el campo', async () => {
    await sembrar();
    await assertFails(darPromo('svc', 'T1', { plan: 'premium', premiumHasta: '', premiumOrigen: 'promo' }));
    await assertFails(darPromo('svc', 'T1', { plan: 'premium', premiumHasta: null, premiumOrigen: 'promo' }));
    await assertFails(darPromo('svc', 'T1', { plan: 'premium', premiumOrigen: 'promo' }));
    await assertFails(darPromo('svc', 'T1', { plan: 'premium', premiumHasta: '2027-01-29', premiumOrigen: 'promo' }));
  });

  it('NO más meses de los configurados, ni una fecha pasada', async () => {
    await sembrar();
    await assertFails(darPromo('svc', 'T1', promo(100)));
    await assertFails(darPromo('svc', 'T1', promo(-1)));
    await sembrar({ configTalleres: { premiumGratisHabilitado: true, mesesPremiumGratis: 1 } });
    await assertFails(darPromo('svc', 'T1', promo(60)));
    await assertSucceeds(darPromo('svc', 'T1', promo(30)));
  });

  it('NO a un taller registrado hace más de 1 hora (los ya registrados no cambian)', async () => {
    await sembrar();
    await assertFails(darPromo('svc', 'VIEJO'));
  });

  it('NO a un taller que ya tiene plan (Básico, Premium del admin) ni dos veces', async () => {
    await sembrar({ tallerT1: { plan: 'freemium' } });
    await assertFails(darPromo('svc', 'T1'));
    await sembrar({ tallerT1: { plan: 'premium', premiumHasta: '' } });
    await assertFails(darPromo('svc', 'T1'));
    await sembrar();
    await assertSucceeds(darPromo('svc', 'T1'));
    await assertFails(darPromo('svc', 'T1', promo(80)));
  });

  it('NO otro origen, otro plan ni cambiar más campos', async () => {
    await sembrar();
    await assertFails(darPromo('svc', 'T1', promo(90, { premiumOrigen: 'admin' })));
    await assertFails(darPromo('svc', 'T1', promo(90, { plan: 'basico' })));
    await assertFails(darPromo('svc', 'T1', promo(90, { nombre: 'Otro nombre' })));
    await assertFails(darPromo('svc', 'T1', promo(90, { activo: false })));
  });
});

describe('promoción Premium gratis: nadie más', () => {
  it('el dueño no se la puede dar (ni al crear ni al editar), aunque la bandera esté encendida', async () => {
    await sembrar();
    await assertFails(darPromo('t1', 'T1'));
    await assertFails(darPromo('t1', 'T1', { premiumOrigen: 'promo' }));
    await assertFails(setDoc(doc(como('t9'), 'talleres', 'T9'), {
      nombre: 'Taller nuevo', whatsapp: '6649876543', ciudad: 'Ensenada', logoUrl: '', ownerUid: 't9', activo: true,
      creadoAt: serverTimestamp(), aceptacionVersion: '', premiumOrigen: 'promo',
      avisoPrivacidad: { modo: 'generado', versionPlantilla: 'aviso-1', fecha: serverTimestamp() },
    }));
  });

  it('otro taller tampoco', async () => {
    await sembrar();
    await assertFails(darPromo('t2', 'T1'));
  });

  it('con la promoción puesta, el dueño sigue editando sus datos, pero no premiumOrigen', async () => {
    await sembrar({ tallerT1: promo() });
    await assertSucceeds(updateDoc(doc(como('t1'), 'talleres', 'T1'), { nombre: 'Taller Uno Renovado' }));
    await assertFails(updateDoc(doc(como('t1'), 'talleres', 'T1'), { premiumOrigen: 'admin' }));
    await assertFails(updateDoc(doc(como('t1'), 'talleres', 'T1'), { premiumOrigen: deleteField() }));
    await assertFails(updateDoc(doc(como('t1'), 'talleres', 'T1'), { premiumHasta: fecha(ahora() + 900 * DIA) }));
  });

  it('el admin sí cambia plan, fecha y origen', async () => {
    await sembrar({ tallerT1: promo() });
    await assertSucceeds(updateDoc(doc(como('adm'), 'talleres', 'T1'), { plan: 'premium', premiumHasta: fecha(ahora() + 365 * DIA), premiumOrigen: 'admin' }));
    await assertSucceeds(updateDoc(doc(como('adm'), 'talleres', 'T1'), { plan: 'freemium', premiumHasta: deleteField(), premiumOrigen: deleteField() }));
  });
});
