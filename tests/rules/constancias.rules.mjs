// Pruebas de reglas: yonkes/{id}/constancias/{tipo}_{versión}. Aviso de Privacidad y declaración de
// autorización, guardadas junto con la ficha del yonke. Lista cerrada; nadie las cambia.
// Comando (desde la raíz del repo):  npm run test:rules
import { describe, it, before, after, beforeEach } from 'node:test';
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { deleteDoc, doc, getDoc, serverTimestamp, setDoc, updateDoc, writeBatch } from 'firebase/firestore';

const reglas = readFileSync(new URL('../../firestore.rules', import.meta.url), 'utf8');
const V = '2026-10-26';
const TEXTO = 'Declaro que estoy autorizado.';
let env;
const como = (uid) => env.authenticatedContext(uid).firestore();
const ficha = (uid) => ({
  nombre: 'Yonke', direccion: 'Calle 1', estado: 'sonora', ciudad: 'hermosillo', telefono: '6621234567', whatsapp: '6621234567',
  metodosPago: [], plan: 'freemium', activo: true, fechaRegistro: new Date(), ownerUid: uid,
});
const privacidad = (extra = {}) => ({ tipo: 'privacidad', version: V, fecha: serverTimestamp(), ...extra });
const autorizacion = (extra = {}) => ({ tipo: 'autorizacion', version: V, fecha: serverTimestamp(), texto: TEXTO, ...extra });

// Igual que crearYonkeConAceptacion() en src/app/panel/terminosYonke.js.
function alta(uid, id, { constancias = [['privacidad', privacidad()], ['autorizacion', autorizacion()]], comoUid = uid } = {}) {
  const db = como(comoUid);
  const lote = writeBatch(db);
  lote.set(doc(db, 'yonkes', id), { ...ficha(uid), aceptacionLegal: { version: V, fecha: serverTimestamp() } });
  lote.set(doc(db, 'yonkes', id, 'aceptaciones', V), { version: V, fecha: serverTimestamp() });
  for (const [tipo, datos] of constancias) lote.set(doc(db, 'yonkes', id, 'constancias', `${tipo}_${V}`), datos);
  return lote.commit();
}

before(async () => {
  env = await initializeTestEnvironment({ projectId: 'demo-mecanix', firestore: { rules: reglas } });
});
after(async () => { await env.cleanup(); });
beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'usuarios', 'admin'), { rol: 'admin' });
    await setDoc(doc(db, 'yonkes', 'Y1'), { ...ficha('dueno'), aceptacionLegal: { version: V, fecha: new Date() } });
    await setDoc(doc(db, 'usuarios', 'dueno'), { rol: 'yonke', yonkeId: 'Y1' });
    await setDoc(doc(db, 'yonkes', 'Y1', 'constancias', `autorizacion_${V}`), { tipo: 'autorizacion', version: V, fecha: new Date(), texto: TEXTO });
  });
});

describe('constancias del registro', () => {
  it('el alta guarda las dos constancias junto con la ficha', async () => {
    await assertSucceeds(alta('nuevo', 'N1'));
  });
  it('rechaza el alta sin alguna de las dos constancias', async () => {
    await assertFails(alta('a', 'A', { constancias: [] }));
    await assertFails(alta('b', 'B', { constancias: [['privacidad', privacidad()]] }));
    await assertFails(alta('c', 'C', { constancias: [['autorizacion', autorizacion()]] }));
  });
  it('rechaza campos de más, tipo desconocido, id que no coincide, otra versión y hora del navegador', async () => {
    await assertFails(alta('a', 'A', { constancias: [['privacidad', privacidad({ extra: 1 })]] }));
    await assertFails(alta('b', 'B', { constancias: [['privacidad', autorizacion()]] }));
    await assertFails(alta('c', 'C', { constancias: [['otra', { tipo: 'otra', version: V, fecha: serverTimestamp() }]] }));
    await assertFails(alta('d', 'D', { constancias: [['privacidad', privacidad({ version: 'vieja' })]] }));
    await assertFails(alta('e', 'E', { constancias: [['privacidad', privacidad({ fecha: new Date() })]] }));
  });
  it('la declaración exige su texto, con tope', async () => {
    const sinTexto = autorizacion();
    delete sinTexto.texto;
    await assertFails(alta('a', 'A', { constancias: [['autorizacion', sinTexto]] }));
    await assertFails(alta('b', 'B', { constancias: [['autorizacion', autorizacion({ texto: '' })]] }));
    await assertFails(alta('c', 'C', { constancias: [['autorizacion', autorizacion({ texto: 'x'.repeat(501) })]] }));
  });
  it('no se agregan después ni fuera del guardado de la aceptación', async () => {
    await assertFails(setDoc(doc(como('dueno'), 'yonkes', 'Y1', 'constancias', `privacidad_${V}`), privacidad()));
  });
  it('nadie escribe en la ficha de otro', async () => {
    await assertFails(setDoc(doc(como('intruso'), 'yonkes', 'Y1', 'constancias', `privacidad_${V}`), privacidad()));
    await assertFails(setDoc(doc(env.unauthenticatedContext().firestore(), 'yonkes', 'Y1', 'constancias', `privacidad_${V}`), privacidad()));
  });
  it('las lee el dueño y el admin, nadie más; no se modifican; solo el admin las borra', async () => {
    const ref = (uid) => doc(como(uid), 'yonkes', 'Y1', 'constancias', `autorizacion_${V}`);
    await assertSucceeds(getDoc(ref('dueno')));
    await assertSucceeds(getDoc(ref('admin')));
    await assertFails(getDoc(ref('intruso')));
    await assertFails(updateDoc(ref('dueno'), { texto: 'otro' }));
    await assertFails(updateDoc(ref('admin'), { texto: 'otro' }));
    await assertFails(deleteDoc(ref('dueno')));
    await assertSucceeds(deleteDoc(ref('admin')));
  });
});
