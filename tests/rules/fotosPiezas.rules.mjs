// Hasta 3 fotos en motores/transmisiones sueltos y piezas sueltas: `foto` (la primera, como
// siempre) + `fotosExtra` (2a y 3a). Confirma que las reglas ACTUALES ya lo permiten al dueño y
// al admin, y a nadie más -- no hizo falta cambiar firestore.rules.
// Comando (desde la raíz del repo):  npm run test:rules
import { describe, it, before, after, beforeEach } from 'node:test';
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { deleteField, doc, setDoc, updateDoc } from 'firebase/firestore';

const reglas = readFileSync(new URL('../../firestore.rules', import.meta.url), 'utf8');
let env;
const como = (uid) => env.authenticatedContext(uid).firestore();
const anonimo = () => env.unauthenticatedContext().firestore();
const f = (n) => ({ url: `https://img/${n}.webp`, path: `yonkes/Y1/motores/M1-${n}.webp` });

before(async () => {
  env = await initializeTestEnvironment({ projectId: 'demo-fotos-piezas', firestore: { rules: reglas, host: '127.0.0.1', port: 8181 } });
});
after(async () => { await env.cleanup(); });
beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'usuarios', 'adm'), { rol: 'admin' });
    await setDoc(doc(db, 'yonkes', 'Y1'), { nombre: 'Yonke uno', activo: true, ownerUid: 'o1' });
    await setDoc(doc(db, 'usuarios', 'o1'), { rol: 'yonke', yonkeId: 'Y1' });
    await setDoc(doc(db, 'yonkes', 'Y2'), { nombre: 'Yonke dos', activo: true, ownerUid: 'o2' });
    await setDoc(doc(db, 'usuarios', 'o2'), { rol: 'yonke', yonkeId: 'Y2' });
    // Datos viejos: 1 sola foto.
    await setDoc(doc(db, 'yonkes', 'Y1', 'motores', 'M1'), { tipo: 'Motor', marca: 'Nissan', modelo: 'Sentra', ano: '2010', foto: f(1) });
    await setDoc(doc(db, 'yonkes', 'Y1', 'piezasSueltas', 'P1'), { pieza: 'Alternador', marca: 'Nissan', modelo: 'Sentra', ano: '2010', foto: f(1) });
  });
});

describe('hasta 3 fotos con las reglas actuales', () => {
  it('el dueño agrega la 2a y 3a foto (fotosExtra) a un motor y a una pieza suelta, y las quita', async () => {
    for (const col of ['motores', 'piezasSueltas']) {
      const id = col === 'motores' ? 'M1' : 'P1';
      await assertSucceeds(updateDoc(doc(como('o1'), 'yonkes', 'Y1', col, id), { foto: f(1), fotosExtra: [f(2), f(3)] }));
      await assertSucceeds(updateDoc(doc(como('o1'), 'yonkes', 'Y1', col, id), { foto: f(2), fotosExtra: deleteField() }));
    }
  });
  it('el admin también puede', async () => {
    await assertSucceeds(updateDoc(doc(como('adm'), 'yonkes', 'Y1', 'motores', 'M1'), { fotosExtra: [f(2)] }));
  });
  it('otro yonke o alguien sin cuenta no puede', async () => {
    for (const db of [como('o2'), anonimo()]) {
      await assertFails(updateDoc(doc(db, 'yonkes', 'Y1', 'motores', 'M1'), { fotosExtra: [f(2)] }));
      await assertFails(updateDoc(doc(db, 'yonkes', 'Y1', 'piezasSueltas', 'P1'), { fotosExtra: [f(2)] }));
    }
  });
});
