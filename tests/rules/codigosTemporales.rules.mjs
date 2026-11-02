// Pruebas de reglas: codigosTemporales (hash del código, solo el servidor) y
// yonkes/{id}/restablecimientos (quién generó cada código).
// Comando (desde la raíz del repo):  npm run test:rules
import { describe, it, before, after, beforeEach } from 'node:test';
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { Timestamp, deleteDoc, doc, getDoc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';

const reglas = readFileSync(new URL('../../firestore.rules', import.meta.url), 'utf8');
const HORA = 60 * 60 * 1000;
const HASH = 'a'.repeat(64);
let env;
const como = (uid) => env.authenticatedContext(uid).firestore();
const codigo = (extra = {}) => ({ uid: 'o1', codigoHash: HASH, expiraAt: Timestamp.fromMillis(Date.now() + 24 * HORA), creadoAt: serverTimestamp(), ...extra });
const ref = (uid, id = 'C1') => doc(como(uid), 'codigosTemporales', id);
const reg = (uid, id = 'R1') => doc(como(uid), 'yonkes', 'Y1', 'restablecimientos', id);
const registro = (extra = {}) => ({ adminUid: 'adm', fecha: serverTimestamp(), ...extra });

before(async () => {
  env = await initializeTestEnvironment({ projectId: 'demo-codigos', firestore: { rules: reglas, host: '127.0.0.1', port: 8181 } });
});
after(async () => { await env.cleanup(); });
beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'usuarios', 'adm'), { rol: 'admin' });
    await setDoc(doc(db, 'usuarios', 'svc'), { rol: 'servicio' });
    await setDoc(doc(db, 'usuarios', 'o1'), { rol: 'yonkeLigero', yonkeId: 'Y1' });
    await setDoc(doc(db, 'yonkes', 'Y1'), { nombre: 'Uno', ownerUid: 'o1', activo: true });
    await setDoc(doc(db, 'codigosTemporales', 'C0'), { uid: 'o1', codigoHash: HASH, expiraAt: new Date(), creadoAt: new Date() });
    await setDoc(doc(db, 'yonkes', 'Y1', 'restablecimientos', 'R0'), { adminUid: 'adm', fecha: new Date() });
  });
});

describe('codigosTemporales', () => {
  it('solo el servidor lee: ni el admin, ni el dueño, ni alguien sin sesión', async () => {
    await assertSucceeds(getDoc(ref('svc', 'C0')));
    await assertFails(getDoc(ref('adm', 'C0')));
    await assertFails(getDoc(ref('o1', 'C0')));
    await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), 'codigosTemporales', 'C0')));
  });
  it('el servidor lo crea o lo reemplaza; nadie más', async () => {
    await assertSucceeds(setDoc(ref('svc'), codigo()));
    await assertSucceeds(setDoc(ref('svc', 'C0'), codigo()));
    await assertFails(setDoc(ref('adm', 'C2'), codigo()));
    await assertFails(setDoc(ref('o1', 'C3'), codigo()));
  });
  it('NO el código legible, campos de más, ni más de 25 horas', async () => {
    await assertFails(setDoc(ref('svc'), codigo({ codigoHash: 'abcdefghjkmn' })));
    await assertFails(setDoc(ref('svc'), codigo({ codigo: 'abcdefghjkmn' })));
    await assertFails(setDoc(ref('svc'), codigo({ expiraAt: Timestamp.fromMillis(Date.now() + 26 * HORA) })));
    await assertFails(setDoc(ref('svc'), codigo({ creadoAt: Timestamp.now() })));
  });
  it('lo borran el servidor o el admin; el dueño no', async () => {
    await assertFails(deleteDoc(ref('o1', 'C0')));
    await assertSucceeds(deleteDoc(ref('svc', 'C0')));
  });
});

describe('restablecimientos', () => {
  it('el servidor lo crea con el admin y la hora del servidor', async () => {
    await assertSucceeds(setDoc(reg('svc'), registro()));
    await assertFails(setDoc(reg('svc', 'R2'), registro({ fecha: new Date() })));
    await assertFails(setDoc(reg('svc', 'R3'), registro({ extra: 1 })));
    await assertFails(setDoc(reg('svc', 'R4'), registro({ adminUid: '' })));
  });
  it('nadie más lo crea; solo el admin lo lee; nadie lo cambia', async () => {
    await assertFails(setDoc(reg('adm', 'R2'), registro()));
    await assertFails(setDoc(reg('o1', 'R3'), registro()));
    await assertSucceeds(getDoc(reg('adm', 'R0')));
    await assertFails(getDoc(reg('o1', 'R0')));
    await assertFails(updateDoc(reg('adm', 'R0'), { adminUid: 'otro' }));
    await assertFails(updateDoc(reg('svc', 'R0'), { adminUid: 'otro' }));
  });
  it('el dueño no lo borra; el admin sí', async () => {
    await assertFails(deleteDoc(reg('o1', 'R0')));
    await assertSucceeds(deleteDoc(reg('adm', 'R0')));
  });
});
