// Pruebas de reglas: asistenciaVial/{id} (directorio de grúas y llanteras, etapa 1), su
// privado/datos (solo admin) y el contador contactos/{mes} (toques en Llamar y WhatsApp).
// Comando (desde la raíz del repo):  npm run test:rules
import { describe, it, before, after, beforeEach } from 'node:test';
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { collection, deleteDoc, doc, getDoc, getDocs, increment, query, setDoc, updateDoc, where } from 'firebase/firestore';

const reglas = readFileSync(new URL('../../firestore.rules', import.meta.url), 'utf8');
let env;
const como = (uid) => env.authenticatedContext(uid).firestore();
const anonimo = () => env.unauthenticatedContext().firestore();
const proveedor = (extra = {}) => ({
  nombre: 'Grúas El Güero', servicios: ['grua', 'paso_de_corriente'], tiposGrua: ['plataforma'], ciudades: ['tijuana', 'rosarito'],
  atiende24h: true, horario: '', telefono: '6641234567', whatsapp: '6641234567', descripcion: 'Servicio en toda la ciudad.',
  logoUrl: '', activo: true, documentosEnRegla: true, fechaRevisionDocumentos: new Date('2026-11-01T12:00:00Z'),
  creadoAt: new Date(), actualizadoAt: new Date(), ...extra,
});

before(async () => {
  env = await initializeTestEnvironment({ projectId: 'demo-mecanix', firestore: { rules: reglas } });
});
after(async () => { await env.cleanup(); });
beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'usuarios', 'admin'), { rol: 'admin' });
    await setDoc(doc(db, 'usuarios', 'dueno'), { rol: 'yonke', yonkeId: 'Y1' });
    await setDoc(doc(db, 'asistenciaVial', 'ACT'), proveedor());
    await setDoc(doc(db, 'asistenciaVial', 'INA'), proveedor({ activo: false }));
    await setDoc(doc(db, 'asistenciaVial', 'ACT', 'privado', 'datos'), { notasInternas: 'nota', documentosRevisados: 'permiso', contactoDueno: 'Juan' });
    await setDoc(doc(db, 'asistenciaVial', 'ACT', 'contactos', '2026-11'), { llamadas: 3 });
  });
});

describe('asistencia vial: datos públicos', () => {
  it('el público lee solo los activos (uno por uno y en la consulta con activo == true)', async () => {
    await assertSucceeds(getDoc(doc(anonimo(), 'asistenciaVial', 'ACT')));
    await assertFails(getDoc(doc(anonimo(), 'asistenciaVial', 'INA')));
    await assertSucceeds(getDocs(query(collection(anonimo(), 'asistenciaVial'), where('activo', '==', true))));
    await assertFails(getDocs(collection(anonimo(), 'asistenciaVial')));
  });
  it('el admin lee todos, también los inactivos', async () => {
    await assertSucceeds(getDoc(doc(como('admin'), 'asistenciaVial', 'INA')));
    await assertSucceeds(getDocs(collection(como('admin'), 'asistenciaVial')));
  });
  it('solo el admin da de alta, edita y borra', async () => {
    await assertSucceeds(setDoc(doc(como('admin'), 'asistenciaVial', 'NUEVO'), proveedor()));
    await assertSucceeds(updateDoc(doc(como('admin'), 'asistenciaVial', 'ACT'), { activo: false }));
    await assertSucceeds(deleteDoc(doc(como('admin'), 'asistenciaVial', 'INA')));
    for (const db of [anonimo(), como('dueno'), como('intruso')]) {
      await assertFails(setDoc(doc(db, 'asistenciaVial', 'OTRO'), proveedor()));
      await assertFails(updateDoc(doc(db, 'asistenciaVial', 'ACT'), { documentosEnRegla: true }));
      await assertFails(deleteDoc(doc(db, 'asistenciaVial', 'ACT')));
    }
  });
  it('rechaza datos mal formados, aun del admin', async () => {
    const malos = [
      proveedor({ extra: 1 }),
      proveedor({ nombre: 'X' }),
      proveedor({ servicios: [] }),
      proveedor({ servicios: ['helicoptero'] }),
      proveedor({ ciudades: [] }),
      proveedor({ telefono: '123' }),
      proveedor({ whatsapp: '55' }),
      proveedor({ descripcion: 'x'.repeat(301) }),
      proveedor({ horario: 'x'.repeat(151) }),
      proveedor({ atiende24h: 'si' }),
      proveedor({ fechaRevisionDocumentos: 'ayer' }),
    ];
    for (const d of malos) await assertFails(setDoc(doc(como('admin'), 'asistenciaVial', 'MAL'), d));
    await assertSucceeds(setDoc(doc(como('admin'), 'asistenciaVial', 'OK'), proveedor({ whatsapp: '', fechaRevisionDocumentos: null, documentosEnRegla: false })));
  });
});

describe('asistencia vial: privado/datos', () => {
  it('solo el admin lo lee y lo escribe; el público nunca', async () => {
    await assertSucceeds(getDoc(doc(como('admin'), 'asistenciaVial', 'ACT', 'privado', 'datos')));
    await assertFails(getDoc(doc(anonimo(), 'asistenciaVial', 'ACT', 'privado', 'datos')));
    await assertFails(getDoc(doc(como('dueno'), 'asistenciaVial', 'ACT', 'privado', 'datos')));
    await assertSucceeds(setDoc(doc(como('admin'), 'asistenciaVial', 'ACT', 'privado', 'datos'), { notasInternas: 'ok', documentosRevisados: '', contactoDueno: '' }));
    await assertFails(setDoc(doc(anonimo(), 'asistenciaVial', 'ACT', 'privado', 'datos'), { notasInternas: 'hack' }));
  });
  it('solo el documento "datos", con sus tres campos', async () => {
    await assertFails(setDoc(doc(como('admin'), 'asistenciaVial', 'ACT', 'privado', 'otro'), { notasInternas: 'x' }));
    await assertFails(setDoc(doc(como('admin'), 'asistenciaVial', 'ACT', 'privado', 'datos'), { ine: 'x' }));
  });
});

describe('asistencia vial: contador de toques', () => {
  const ref = (db, id = 'ACT', mes = '2026-11') => doc(db, 'asistenciaVial', id, 'contactos', mes);
  it('cualquiera suma exactamente 1 a llamadas o a whatsapp (crear y sumar)', async () => {
    await assertSucceeds(setDoc(ref(anonimo()), { whatsapp: increment(1) }, { merge: true }));
    await assertSucceeds(setDoc(ref(anonimo()), { llamadas: increment(1) }, { merge: true }));
    await assertSucceeds(setDoc(ref(anonimo(), 'ACT', '2026-12'), { llamadas: increment(1) }, { merge: true }));
  });
  it('no deja sumar de más, los dos a la vez, otros campos ni meses inventados', async () => {
    await assertFails(setDoc(ref(anonimo()), { llamadas: 10 }, { merge: true }));
    await assertFails(setDoc(ref(anonimo(), 'ACT', '2026-12'), { llamadas: 1, whatsapp: 1 }));
    await assertFails(setDoc(ref(anonimo(), 'ACT', '2026-12'), { llamadas: 1, ip: 'x' }));
    await assertFails(setDoc(ref(anonimo(), 'ACT', 'hoy'), { llamadas: 1 }));
  });
  it('no cuenta toques de proveedores inactivos ni inexistentes', async () => {
    await assertFails(setDoc(ref(anonimo(), 'INA'), { llamadas: increment(1) }, { merge: true }));
    await assertFails(setDoc(ref(anonimo(), 'NOEXISTE'), { llamadas: increment(1) }, { merge: true }));
  });
  it('solo el admin lo lee y lo borra', async () => {
    await assertSucceeds(getDoc(ref(como('admin'))));
    await assertFails(getDoc(ref(anonimo())));
    await assertFails(deleteDoc(ref(anonimo())));
    await assertSucceeds(deleteDoc(ref(como('admin'))));
  });
});
