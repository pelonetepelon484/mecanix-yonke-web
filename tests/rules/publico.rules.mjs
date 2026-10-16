// Pruebas de reglas: resumen público de alertas (publico/alertasRecientes). Solo el usuario de
// servicio y el admin lo leen y lo escriben; nadie más (ni sin cuenta, ni yonkes, ni talleres).
// Comando (desde la raíz del repo):  npm run test:rules
import { describe, it, before, after, beforeEach } from 'node:test';
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { deleteDoc, doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';

const reglas = readFileSync(new URL('../../firestore.rules', import.meta.url), 'utf8');
let env;
const anonimo = () => env.unauthenticatedContext().firestore();
const como = (uid) => env.authenticatedContext(uid).firestore();
const alerta = (i) => ({ id: `P${i}`, pieza: 'Faro', vehiculo: { marca: 'Honda', modelo: 'Civic', anio: 2020 }, estado: 'baja-california', creadoMs: 1, expiraMs: 2 });
const resumen = (n = 2, extra = {}) => ({ alertas: Array.from({ length: n }, (_, i) => alerta(i)), actualizadoAt: serverTimestamp(), ...extra });

before(async () => {
  env = await initializeTestEnvironment({ projectId: 'demo-publico', firestore: { rules: reglas, host: '127.0.0.1', port: 8181 } });
});
after(async () => { await env.cleanup(); });
beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'usuarios', 'adm'), { rol: 'admin' });
    await setDoc(doc(db, 'usuarios', 'svc'), { rol: 'servicio' });
    await setDoc(doc(db, 'usuarios', 'o1'), { rol: 'yonke', yonkeId: 'Y1' });
    await setDoc(doc(db, 'usuarios', 't1'), { rol: 'taller', tallerId: 'T1' });
    await setDoc(doc(db, 'publico', 'alertasRecientes'), { alertas: [alerta(0)], actualizadoAt: new Date() });
  });
});

describe('publico/alertasRecientes', () => {
  it('lo leen el servicio y el admin; nadie más', async () => {
    await assertSucceeds(getDoc(doc(como('svc'), 'publico', 'alertasRecientes')));
    await assertSucceeds(getDoc(doc(como('adm'), 'publico', 'alertasRecientes')));
    for (const db of [anonimo(), como('o1'), como('t1')]) await assertFails(getDoc(doc(db, 'publico', 'alertasRecientes')));
  });
  it('lo escriben el servicio y el admin, hasta 30 alertas y con la hora del servidor', async () => {
    await assertSucceeds(setDoc(doc(como('svc'), 'publico', 'alertasRecientes'), resumen(30)));
    await assertSucceeds(setDoc(doc(como('adm'), 'publico', 'alertasRecientes'), resumen(0)));
    await assertFails(setDoc(doc(como('svc'), 'publico', 'alertasRecientes'), resumen(31)));
    await assertFails(setDoc(doc(como('svc'), 'publico', 'alertasRecientes'), resumen(2, { actualizadoAt: new Date(0) })));
    await assertFails(setDoc(doc(como('svc'), 'publico', 'alertasRecientes'), resumen(2, { clienteWhatsapp: '6641234567' })));
    await assertFails(setDoc(doc(como('svc'), 'publico', 'otroDoc'), resumen(1)));
  });
  it('nadie más lo escribe ni lo borra (solo el admin lo borra)', async () => {
    for (const db of [anonimo(), como('o1'), como('t1')]) await assertFails(setDoc(doc(db, 'publico', 'alertasRecientes'), resumen(1)));
    await assertFails(deleteDoc(doc(como('svc'), 'publico', 'alertasRecientes')));
    await assertSucceeds(deleteDoc(doc(como('adm'), 'publico', 'alertasRecientes')));
  });
});
