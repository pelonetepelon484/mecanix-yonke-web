// Pruebas de reglas: asistencia vial etapa 2. checkinsAsistencia/{huella} (enlaces privados, solo
// admin; el servidor los lee uno por uno) y ubicacionesAsistencia/{proveedorId} (la escribe solo el
// usuario de servicio del servidor; se lee con la bandera).
// Comando (desde la raíz del repo):  npm run test:rules
import { describe, it, before, after, beforeEach } from 'node:test';
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { collection, deleteDoc, doc, getDoc, getDocs, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';

const reglas = readFileSync(new URL('../../firestore.rules', import.meta.url), 'utf8');
let env;
const como = (uid) => env.authenticatedContext(uid).firestore();
const anonimo = () => env.unauthenticatedContext().firestore();
const HUELLA = 'ab'.repeat(32);
const ubicacion = { lat: 32.514, lng: -117.039, hastaAt: new Date(Date.now() + 3600000), actualizadoAt: new Date() };

async function sembrar({ mapa = true, activo = true } = {}) {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'usuarios', 'admin'), { rol: 'admin' });
    await setDoc(doc(db, 'usuarios', 'srv'), { rol: 'servicio' });
    await setDoc(doc(db, 'config', 'portada'), { asistenciaVialActiva: true, asistenciaVialMapa: mapa });
    await setDoc(doc(db, 'asistenciaVial', 'P1'), { nombre: 'Grúas', activo });
    await setDoc(doc(db, 'checkinsAsistencia', HUELLA), { proveedorId: 'P1', creadoAt: new Date() });
    await setDoc(doc(db, 'ubicacionesAsistencia', 'P1'), ubicacion);
  });
}

before(async () => {
  env = await initializeTestEnvironment({ projectId: 'demo-ubicacion-asistencia', firestore: { rules: reglas } });
});
after(async () => { await env.cleanup(); });

describe('checkinsAsistencia (enlaces privados)', () => {
  beforeEach(() => sembrar());
  it('solo el admin los ve; nadie más los lee ni los lista', async () => {
    await assertSucceeds(getDoc(doc(como('admin'), 'checkinsAsistencia', HUELLA)));
    await assertSucceeds(getDocs(collection(como('admin'), 'checkinsAsistencia')));
    await assertFails(getDoc(doc(anonimo(), 'checkinsAsistencia', HUELLA)));
    await assertFails(getDoc(doc(como('alguien'), 'checkinsAsistencia', HUELLA)));
    await assertFails(getDocs(collection(anonimo(), 'checkinsAsistencia')));
  });
  it('el admin crea uno nuevo (huella de 64 hex, proveedor existente) y lo borra', async () => {
    const nueva = 'cd'.repeat(32);
    await assertSucceeds(setDoc(doc(como('admin'), 'checkinsAsistencia', nueva), { proveedorId: 'P1', creadoAt: serverTimestamp() }));
    await assertSucceeds(deleteDoc(doc(como('admin'), 'checkinsAsistencia', nueva)));
  });
  it('rechaza huellas mal formadas, proveedores que no existen, campos extra y ediciones', async () => {
    await assertFails(setDoc(doc(como('admin'), 'checkinsAsistencia', 'corta'), { proveedorId: 'P1', creadoAt: serverTimestamp() }));
    await assertFails(setDoc(doc(como('admin'), 'checkinsAsistencia', 'AB'.repeat(32)), { proveedorId: 'P1', creadoAt: serverTimestamp() }));
    await assertFails(setDoc(doc(como('admin'), 'checkinsAsistencia', 'ef'.repeat(32)), { proveedorId: 'NOEXISTE', creadoAt: serverTimestamp() }));
    await assertFails(setDoc(doc(como('admin'), 'checkinsAsistencia', 'ef'.repeat(32)), { proveedorId: 'P1', creadoAt: serverTimestamp(), secreto: 'x' }));
    await assertFails(updateDoc(doc(como('admin'), 'checkinsAsistencia', HUELLA), { proveedorId: 'P2' }));
  });
  it('el servidor lo lee uno por uno solo con la bandera del mapa, nunca lista ni escribe', async () => {
    await assertSucceeds(getDoc(doc(como('srv'), 'checkinsAsistencia', HUELLA)));
    await assertFails(getDocs(collection(como('srv'), 'checkinsAsistencia')));
    await assertFails(setDoc(doc(como('srv'), 'checkinsAsistencia', 'cd'.repeat(32)), { proveedorId: 'P1', creadoAt: serverTimestamp() }));
    await assertFails(deleteDoc(doc(como('srv'), 'checkinsAsistencia', HUELLA)));
    await sembrar({ mapa: false });
    await assertFails(getDoc(doc(como('srv'), 'checkinsAsistencia', HUELLA)));
  });
  it('nadie más crea ni borra', async () => {
    await assertFails(setDoc(doc(como('alguien'), 'checkinsAsistencia', 'cd'.repeat(32)), { proveedorId: 'P1', creadoAt: serverTimestamp() }));
    await assertFails(deleteDoc(doc(anonimo(), 'checkinsAsistencia', HUELLA)));
  });
});

describe('ubicacionesAsistencia (mapa)', () => {
  const nueva = (extra = {}) => ({ lat: 32.52, lng: -117.04, hastaAt: new Date(Date.now() + 90 * 60000), actualizadoAt: serverTimestamp(), ...extra });
  it('con la bandera del mapa, cualquiera las lee; desde la app nadie las escribe', async () => {
    await sembrar();
    await assertSucceeds(getDoc(doc(anonimo(), 'ubicacionesAsistencia', 'P1')));
    await assertSucceeds(getDocs(collection(anonimo(), 'ubicacionesAsistencia')));
    for (const db of [anonimo(), como('alguien'), como('admin')]) {
      await assertFails(setDoc(doc(db, 'ubicacionesAsistencia', 'P1'), nueva()));
      await assertFails(updateDoc(doc(db, 'ubicacionesAsistencia', 'P1'), { lat: 32.6 }));
    }
  });
  it('el servidor la guarda solo con forma válida, hasta 3 horas y en Baja California', async () => {
    await sembrar();
    await assertSucceeds(setDoc(doc(como('srv'), 'ubicacionesAsistencia', 'P1'), nueva()));
    await assertSucceeds(setDoc(doc(como('srv'), 'ubicacionesAsistencia', 'P1'), nueva({ hastaAt: new Date(Date.now() + 180 * 60000) })));
    const malas = [
      nueva({ hastaAt: new Date(Date.now() + 240 * 60000) }),
      nueva({ hastaAt: new Date(Date.now() - 60000) }),
      nueva({ lat: 19.43, lng: -99.13 }),
      nueva({ lat: '32.5' }),
      nueva({ actualizadoAt: new Date(2020, 0, 1) }),
      nueva({ telefono: '6641234567' }),
    ];
    for (const d of malas) await assertFails(setDoc(doc(como('srv'), 'ubicacionesAsistencia', 'P1'), d));
    await assertSucceeds(deleteDoc(doc(como('srv'), 'ubicacionesAsistencia', 'P1')));
  });
  it('el servidor no la guarda sin la bandera o con el proveedor inactivo', async () => {
    await sembrar({ mapa: false });
    await assertFails(setDoc(doc(como('srv'), 'ubicacionesAsistencia', 'P1'), nueva()));
    await sembrar({ activo: false });
    await assertFails(setDoc(doc(como('srv'), 'ubicacionesAsistencia', 'P1'), nueva()));
  });
  it('sin la bandera del mapa, solo el admin las ve', async () => {
    await sembrar({ mapa: false });
    await assertFails(getDoc(doc(anonimo(), 'ubicacionesAsistencia', 'P1')));
    await assertFails(getDocs(collection(anonimo(), 'ubicacionesAsistencia')));
    await assertSucceeds(getDoc(doc(como('admin'), 'ubicacionesAsistencia', 'P1')));
  });
  it('solo el admin la borra (quitar del mapa)', async () => {
    await sembrar();
    await assertFails(deleteDoc(doc(anonimo(), 'ubicacionesAsistencia', 'P1')));
    await assertSucceeds(deleteDoc(doc(como('admin'), 'ubicacionesAsistencia', 'P1')));
  });
});
