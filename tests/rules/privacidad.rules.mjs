// Pruebas de reglas de Firestore para reservaciones, busquedas_pendientes y busqueda_rate_limit
// (huecos de privacidad: lectura pública de reservaciones y escritura libre de las otras dos).
// Corren contra el emulador con el archivo real ../../firestore.rules.
// Comando (desde la raíz del repo):  npm run test:rules
import { describe, it, before, after, beforeEach } from 'node:test';
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import {
  addDoc, collection, deleteDoc, doc, getDoc, getDocs, orderBy, query, runTransaction, setDoc, Timestamp, updateDoc, where,
} from 'firebase/firestore';

const reglas = readFileSync(new URL('../../firestore.rules', import.meta.url), 'utf8');
let env;

const anonimo = () => env.unauthenticatedContext().firestore();
const como = (uid) => env.authenticatedContext(uid).firestore();

// Admin, dos yonkes con dueño, un taller y una reservación de cada yonke.
async function sembrar() {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'usuarios', 'adm'), { rol: 'admin', email: 'admin@prueba.mx' });
    await setDoc(doc(db, 'yonkes', 'Y1'), { nombre: 'Yonke uno', activo: true, ownerUid: 'o1' });
    await setDoc(doc(db, 'usuarios', 'o1'), { rol: 'yonke', yonkeId: 'Y1', email: 'o1@prueba.mx', fechaRegistro: new Date() });
    await setDoc(doc(db, 'yonkes', 'Y2'), { nombre: 'Yonke dos', activo: true, ownerUid: 'o2' });
    await setDoc(doc(db, 'usuarios', 'o2'), { rol: 'yonke', yonkeId: 'Y2', email: 'o2@prueba.mx', fechaRegistro: new Date() });
    await setDoc(doc(db, 'usuarios', 't1'), { rol: 'taller', tallerId: 'T1', email: 't1@prueba.mx', fechaRegistro: new Date() });
    await setDoc(doc(db, 'reservaciones', 'R1'), reservacion('Y1'));
    await setDoc(doc(db, 'reservaciones', 'R2'), reservacion('Y2'));
    await setDoc(doc(db, 'busquedas_pendientes', 'P1'), pendiente());
    await setDoc(doc(db, 'busqueda_rate_limit', `${'a'.repeat(32)}_100`), { count: 3, actualizado: new Date() });
  });
}

before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-privacidad',
    firestore: { rules: reglas, host: '127.0.0.1', port: 8181 },
  });
});
after(async () => { await env.cleanup(); });
beforeEach(sembrar);

// Igual que confirmarReserva() en HomeClient.js (TenantPageClient.js manda los mismos campos).
function reservacion(yonkeId, extra = {}) {
  return {
    numeroPedido: 'MYV-1008-1234', yonkeId, vehiculoId: 'V1', yonkeNombre: 'Yonke',
    vehiculo: { marca: 'Nissan', modelo: 'Sentra', ano: 2005 }, motor: null,
    piezaSolicitada: 'Alternador', nombreCliente: 'Juan Pérez', telefonoCliente: '6641234567',
    estado: 'pendiente', fecha: new Date(), interesaEnvio: false, ...extra,
  };
}

describe('reservaciones', () => {
  it('un cliente sin cuenta puede crear una reservación (con y sin avisoPrivacidadVersion)', async () => {
    await assertSucceeds(addDoc(collection(anonimo(), 'reservaciones'), reservacion('Y1', { avisoPrivacidadVersion: 'v1' })));
    await assertSucceeds(addDoc(collection(anonimo(), 'reservaciones'), reservacion('Y1')));
  });
  it('sin cuenta NO se puede leer una reservación ni listarlas', async () => {
    await assertFails(getDoc(doc(anonimo(), 'reservaciones', 'R1')));
    await assertFails(getDocs(collection(anonimo(), 'reservaciones')));
    await assertFails(getDocs(query(collection(anonimo(), 'reservaciones'), where('yonkeId', '==', 'Y1'))));
  });
  it('el yonke dueño lee la suya y la consulta del panel (yonkeId + estado + fecha)', async () => {
    await assertSucceeds(getDoc(doc(como('o1'), 'reservaciones', 'R1')));
    await assertSucceeds(getDocs(query(
      collection(como('o1'), 'reservaciones'),
      where('yonkeId', '==', 'Y1'), where('estado', '==', 'pendiente'), orderBy('fecha', 'desc'),
    )));
  });
  it('otro yonke no lee reservaciones ajenas, ni con su propia consulta apuntando a otro yonke', async () => {
    await assertFails(getDoc(doc(como('o2'), 'reservaciones', 'R1')));
    await assertFails(getDocs(query(collection(como('o2'), 'reservaciones'), where('yonkeId', '==', 'Y1'))));
  });
  it('un yonke no puede listar todas las reservaciones sin filtrar por su yonkeId', async () => {
    await assertFails(getDocs(collection(como('o1'), 'reservaciones')));
  });
  it('una cuenta de taller o una cuenta sin rol no lee reservaciones', async () => {
    await assertFails(getDoc(doc(como('t1'), 'reservaciones', 'R1')));
    await assertFails(getDoc(doc(como('nadie'), 'reservaciones', 'R1')));
  });
  it('el admin lee cualquiera y la consulta por yonkeId del borrado de yonke', async () => {
    await assertSucceeds(getDoc(doc(como('adm'), 'reservaciones', 'R2')));
    await assertSucceeds(getDocs(query(collection(como('adm'), 'reservaciones'), where('yonkeId', '==', 'Y1'))));
  });
  it('sin cambios: el dueño marca completada/cancelada/expirada; otro yonke no', async () => {
    await assertSucceeds(updateDoc(doc(como('o1'), 'reservaciones', 'R1'), { estado: 'completada' }));
    await assertFails(updateDoc(doc(como('o2'), 'reservaciones', 'R1'), { estado: 'cancelada' }));
  });
});

// Igual que persistirContactoSiExiste() en src/app/api/buscar/route.js.
function pendiente(extra = {}) {
  return {
    pieza: 'Alternador', marca: 'Nissan', modelo: 'Sentra', anio: 2005,
    textoOriginal: 'alternador sentra 2005', estado: 'sin_inventario', fecha: new Date(),
    contacto: '664 123 4567', atendido: false, ...extra,
  };
}

describe('busquedas_pendientes', () => {
  it('sin cuenta se crea con la forma exacta de /api/buscar (también con pieza/marca/modelo/año nulos)', async () => {
    await assertSucceeds(addDoc(collection(anonimo(), 'busquedas_pendientes'), pendiente()));
    await assertSucceeds(addDoc(collection(anonimo(), 'busquedas_pendientes'), pendiente({
      pieza: null, marca: null, modelo: null, anio: null, estado: 'no_interpretada', textoOriginal: 'hola',
    })));
  });
  it('acepta todos los estados que usa la ruta', async () => {
    for (const estado of ['sin_inventario', 'fuera_de_catalogo', 'parseo_parcial', 'no_interpretada', 'fuera_de_giro', 'numero_de_parte', 'marca_muy_general', 'pieza_sin_vehiculo']) {
      await assertSucceeds(addDoc(collection(anonimo(), 'busquedas_pendientes'), pendiente({ estado })));
    }
  });
  it('rechaza campos de más, estado inválido, contacto vacío o enorme, atendido=true y fechas falsas', async () => {
    const crear = (extra) => addDoc(collection(anonimo(), 'busquedas_pendientes'), pendiente(extra));
    await assertFails(crear({ extra: 'x' }));
    await assertFails(crear({ estado: 'ok' }));
    await assertFails(crear({ contacto: '' }));
    await assertFails(crear({ contacto: '1'.repeat(201) }));
    await assertFails(crear({ textoOriginal: 'x'.repeat(2001) }));
    await assertFails(crear({ atendido: true }));
    await assertFails(crear({ anio: '2005' }));
    await assertFails(crear({ fecha: new Date(Date.now() - 3 * 60 * 60 * 1000) }));
    await assertFails(crear({ fecha: new Date(Date.now() + 3 * 60 * 60 * 1000) }));
    const { contacto: _c, ...sinContacto } = pendiente();
    await assertFails(addDoc(collection(anonimo(), 'busquedas_pendientes'), sinContacto));
  });
  it('sin cuenta (o con cuenta de yonke) NO se lee, edita ni borra', async () => {
    for (const db of [anonimo(), como('o1')]) {
      await assertFails(getDoc(doc(db, 'busquedas_pendientes', 'P1')));
      await assertFails(getDocs(collection(db, 'busquedas_pendientes')));
      await assertFails(updateDoc(doc(db, 'busquedas_pendientes', 'P1'), { atendido: true }));
      await assertFails(setDoc(doc(db, 'busquedas_pendientes', 'P1'), pendiente()));
      await assertFails(deleteDoc(doc(db, 'busquedas_pendientes', 'P1')));
    }
  });
  it('el admin lee, marca como atendido (como admin/busquedas) y borra', async () => {
    const db = como('adm');
    await assertSucceeds(getDocs(query(collection(db, 'busquedas_pendientes'), orderBy('fecha', 'desc'))));
    await assertSucceeds(updateDoc(doc(db, 'busquedas_pendientes', 'P1'), { atendido: true, atendidoFecha: new Date() }));
    await assertSucceeds(deleteDoc(doc(db, 'busquedas_pendientes', 'P1')));
  });
});

const ID_NUEVO = `${'b'.repeat(32)}_200`;
const ID_EXISTENTE = `${'a'.repeat(32)}_100`;

describe('busqueda_rate_limit', () => {
  it('crea un contador nuevo en 1 (con y sin expiraEn, como rateLimit.js)', async () => {
    const ref = doc(anonimo(), 'busqueda_rate_limit', ID_NUEVO);
    await assertSucceeds(setDoc(ref, { count: 1, actualizado: new Date(), expiraEn: Timestamp.fromMillis(Date.now() + 3600e3) }, { merge: true }));
    await assertSucceeds(setDoc(doc(anonimo(), 'busqueda_rate_limit', `${'c'.repeat(32)}_200`), { count: 1, actualizado: new Date() }, { merge: true }));
  });
  it('suma exactamente 1 a un contador existente', async () => {
    await assertSucceeds(setDoc(doc(anonimo(), 'busqueda_rate_limit', ID_EXISTENTE), { count: 4, actualizado: new Date() }, { merge: true }));
  });
  it('no se puede reiniciar, bajar, brincar ni borrar un contador', async () => {
    const ref = doc(anonimo(), 'busqueda_rate_limit', ID_EXISTENTE);
    await assertFails(setDoc(ref, { count: 0, actualizado: new Date() }, { merge: true }));
    await assertFails(setDoc(ref, { count: 1, actualizado: new Date() }));
    await assertFails(setDoc(ref, { count: 3, actualizado: new Date() }, { merge: true }));
    await assertFails(setDoc(ref, { count: 5, actualizado: new Date() }, { merge: true }));
    await assertFails(deleteDoc(ref));
  });
  it('no se crean contadores con otro valor, otros campos o un ID que no sea hash_minuto', async () => {
    await assertFails(setDoc(doc(anonimo(), 'busqueda_rate_limit', ID_NUEVO), { count: 7, actualizado: new Date() }));
    await assertFails(setDoc(doc(anonimo(), 'busqueda_rate_limit', ID_NUEVO), { count: 1, actualizado: new Date(), basura: 'x' }));
    await assertFails(setDoc(doc(anonimo(), 'busqueda_rate_limit', 'cualquier-cosa'), { count: 1, actualizado: new Date() }));
  });
  it('la lectura sigue cerrada para todos', async () => {
    await assertFails(getDoc(doc(anonimo(), 'busqueda_rate_limit', ID_EXISTENTE)));
    await assertFails(getDoc(doc(como('adm'), 'busqueda_rate_limit', ID_EXISTENTE)));
  });
  // Documenta el estado actual (pendiente de decidir): con la lectura cerrada, la transacción
  // de rateLimit.js se rechaza y /api/buscar deja pasar la búsqueda -- el límite no se aplica.
  // Si se decide encender el límite abriendo "get", esta prueba debe cambiar a assertSucceeds.
  it('la transacción de rateLimit.js se rechaza mientras la lectura siga cerrada', async () => {
    const db = anonimo();
    const ref = doc(db, 'busqueda_rate_limit', ID_NUEVO);
    await assertFails(runTransaction(db, async (t) => {
      const snap = await t.get(ref);
      const n = snap.exists() ? snap.data().count || 0 : 0;
      t.set(ref, { count: n + 1, actualizado: new Date() }, { merge: true });
    }));
  });
});
