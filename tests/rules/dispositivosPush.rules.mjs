// Pruebas de reglas: tokens de los avisos en el dispositivo (dispositivosPush/{yonkeId}_{sha256}).
// Solo el dueño del yonke crea, lee y borra los suyos; el usuario de servicio los lee y borra
// (para enviar y limpiar); el admin los lee y borra (borrado en cascada). Nada público. No
// depende de los términos ni del plan.
import { describe, it, before, after } from 'node:test';
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { collection, deleteDoc, doc, getDoc, getDocs, query, serverTimestamp, setDoc, updateDoc, where } from 'firebase/firestore';

const reglas = readFileSync(new URL('../../firestore.rules', import.meta.url), 'utf8');
let env;
const H = 'a'.repeat(64);
const H2 = 'b'.repeat(64);

async function sembrar({ terminos = false, planes = false } = {}) {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'usuarios', 'adm'), { rol: 'admin', email: 'a@x.mx' });
    await setDoc(doc(db, 'usuarios', 'svc'), { rol: 'servicio' });
    await setDoc(doc(db, 'usuarios', 't1'), { rol: 'taller', tallerId: 'T1', email: 't@x.mx' });
    await setDoc(doc(db, 'yonkes', 'Y1'), { nombre: 'Uno', activo: true, estado: 'baja-california', ownerUid: 'o1', plan: 'freemium', aceptacionLegal: { version: 'vieja', fecha: new Date() } });
    await setDoc(doc(db, 'usuarios', 'o1'), { rol: 'yonke', yonkeId: 'Y1', email: 'o1@x.mx' });
    await setDoc(doc(db, 'yonkes', 'Y2'), { nombre: 'Dos', activo: true, estado: 'baja-california', ownerUid: 'o2' });
    await setDoc(doc(db, 'usuarios', 'o2'), { rol: 'yonke', yonkeId: 'Y2', email: 'o2@x.mx' });
    await setDoc(doc(db, 'dispositivosPush', `Y2_${H}`), { yonkeId: 'Y2', token: 'tok-y2', creadoAt: new Date() });
    if (terminos) await setDoc(doc(db, 'config', 'terminosYonkes'), { version: 'nueva', resumenCambios: '' });
    if (planes) await setDoc(doc(db, 'config', 'planes'), { limitesActivos: true });
  });
}
const como = (uid) => (uid ? env.authenticatedContext(uid).firestore() : env.unauthenticatedContext().firestore());
const nuevo = (uid, id = `Y1_${H}`, datos = {}) => setDoc(doc(como(uid), 'dispositivosPush', id), { yonkeId: 'Y1', token: 'tok-y1', creadoAt: serverTimestamp(), ...datos });

before(async () => {
  env = await initializeTestEnvironment({ projectId: 'demo-dispositivos-push', firestore: { rules: reglas, host: '127.0.0.1', port: 8181 } });
});
after(async () => { await env.cleanup(); });

describe('el dueño del yonke', () => {
  it('activa (crea), vuelve a activar en el mismo celular (actualiza), lee y apaga (borra) sus avisos', async () => {
    await sembrar();
    await assertSucceeds(nuevo('o1'));
    await assertSucceeds(nuevo('o1', `Y1_${H}`, { token: 'tok-y1-renovado' }));
    await assertSucceeds(nuevo('o1', `Y1_${H2}`, { token: 'tok-y1-otro-celular' }));
    await assertSucceeds(getDoc(doc(como('o1'), 'dispositivosPush', `Y1_${H}`)));
    await assertSucceeds(getDocs(query(collection(como('o1'), 'dispositivosPush'), where('yonkeId', '==', 'Y1'))));
    await assertSucceeds(deleteDoc(doc(como('o1'), 'dispositivosPush', `Y1_${H}`)));
  });
  it('aunque no haya aceptado los términos nuevos y esté en plan Básico con límites encendidos', async () => {
    await sembrar({ terminos: true, planes: true });
    await assertSucceeds(nuevo('o1'));
    await assertSucceeds(deleteDoc(doc(como('o1'), 'dispositivosPush', `Y1_${H}`)));
  });
  it('rechaza campos extra, fecha del navegador, token vacío o id que no corresponde', async () => {
    await sembrar();
    await assertFails(nuevo('o1', `Y1_${H}`, { nombre: 'Juan' }));
    await assertFails(nuevo('o1', `Y1_${H}`, { creadoAt: new Date() }));
    await assertFails(nuevo('o1', `Y1_${H}`, { token: '' }));
    await assertFails(nuevo('o1', `Y2_${H2}`));
    await assertFails(nuevo('o1', 'Y1_corto'));
    await assertFails(nuevo('o1', `Y1_${H}`, { token: 'x'.repeat(4097) }));
  });
});

describe('nadie más', () => {
  it('otro yonke: no crea a nombre ajeno, no lee, no cambia ni borra tokens ajenos', async () => {
    await sembrar();
    await assertFails(nuevo('o2'));
    await assertFails(getDoc(doc(como('o1'), 'dispositivosPush', `Y2_${H}`)));
    await assertFails(getDocs(query(collection(como('o1'), 'dispositivosPush'), where('yonkeId', '==', 'Y2'))));
    await assertFails(updateDoc(doc(como('o1'), 'dispositivosPush', `Y2_${H}`), { token: 'robado' }));
    await assertFails(deleteDoc(doc(como('o1'), 'dispositivosPush', `Y2_${H}`)));
  });
  it('sin sesión o un taller: nada (ni leer, ni listar, ni crear)', async () => {
    await sembrar();
    for (const uid of [null, 't1']) {
      await assertFails(getDoc(doc(como(uid), 'dispositivosPush', `Y2_${H}`)));
      await assertFails(getDocs(collection(como(uid), 'dispositivosPush')));
      await assertFails(nuevo(uid));
    }
  });
  it('el dueño no puede listar todos los tokens (solo los suyos)', async () => {
    await sembrar();
    await assertFails(getDocs(collection(como('o1'), 'dispositivosPush')));
  });
});

describe('servidor (usuario de servicio) y admin', () => {
  it('servicio: lee los tokens de varios yonkes (in) y borra los inválidos, pero no los crea', async () => {
    await sembrar();
    await assertSucceeds(getDocs(query(collection(como('svc'), 'dispositivosPush'), where('yonkeId', 'in', ['Y1', 'Y2']))));
    await assertSucceeds(deleteDoc(doc(como('svc'), 'dispositivosPush', `Y2_${H}`)));
    await assertFails(setDoc(doc(como('svc'), 'dispositivosPush', `Y1_${H}`), { yonkeId: 'Y1', token: 't', creadoAt: serverTimestamp() }));
  });
  it('servicio: puede buscar los yonkes activos de un estado y los de otros estados con el interruptor', async () => {
    await sembrar();
    await assertSucceeds(getDocs(query(collection(como('svc'), 'yonkes'), where('estado', '==', 'baja-california'), where('activo', '==', true))));
    await assertSucceeds(getDocs(query(collection(como('svc'), 'yonkes'), where('verAlertasOtrosEstados', '==', true))));
  });
  it('admin: lee y borra (borrado en cascada por yonkeId)', async () => {
    await sembrar();
    const snap = await getDocs(query(collection(como('adm'), 'dispositivosPush'), where('yonkeId', '==', 'Y2')));
    for (const d of snap.docs) await assertSucceeds(deleteDoc(d.ref));
  });
});
