// Pruebas de reglas: comparador de compatibilidad de piezas. comparadorLimite, comparadorUso y
// vinDecodificado los escribe solo el usuario de servicio del servidor; equivalenciasPiezas la
// escribe el admin y la lee el servidor. El navegador no lee ni escribe nada de esto.
// Comando (desde la raíz del repo):  npm run test:rules
import { describe, it, before, after, beforeEach } from 'node:test';
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { collection, deleteDoc, doc, getDoc, getDocs, increment, serverTimestamp, setDoc, Timestamp } from 'firebase/firestore';

const reglas = readFileSync(new URL('../../firestore.rules', import.meta.url), 'utf8');
let env;
const como = (uid) => env.authenticatedContext(uid).firestore();
const anonimo = () => env.unauthenticatedContext().firestore();
const ID_LIMITE = `ip_${'a'.repeat(32)}_2026-11-07`;
const CLAVE = '1HGCM826*3A';
const enDias = (d) => Timestamp.fromMillis(Date.now() + d * 86400000);
const limite = (extra = {}) => ({ count: 1, actualizado: Timestamp.now(), expiraEn: enDias(2), ...extra });
const vin = (extra = {}) => ({
  marca: 'HONDA', modelo: 'Accord', anio: '2003', motor: '', cilindrada: '2.4', cilindros: '4', combustible: 'Gasoline',
  transmision: '', traccion: 'FWD', carroceria: 'Sedan', pais: 'UNITED STATES (USA)', planta: 'MARYSVILLE', sinDatos: false, guardadoAt: serverTimestamp(), ...extra,
});

async function sembrar() {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'usuarios', 'admin'), { rol: 'admin' });
    await setDoc(doc(db, 'usuarios', 'srv'), { rol: 'servicio' });
    await setDoc(doc(db, 'usuarios', 'taller1'), { rol: 'taller', tallerId: 'T1' });
    await setDoc(doc(db, 'comparadorLimite', ID_LIMITE), limite());
    await setDoc(doc(db, 'comparadorUso', '2026-11-07'), { consultas: 1, actualizadoAt: Timestamp.now() });
    await setDoc(doc(db, 'vinDecodificado', CLAVE), vin({ guardadoAt: Timestamp.now() }));
    await setDoc(doc(db, 'equivalenciasPiezas', 'E1'), { clase: 'equivalencia', partes: ['ABC123', 'XYZ789'] });
  });
}

before(async () => {
  env = await initializeTestEnvironment({ projectId: 'demo-comparador', firestore: { rules: reglas } });
});
after(async () => { await env.cleanup(); });

describe('comparadorLimite', () => {
  beforeEach(() => sembrar());
  it('el servicio cuenta (crear, subir y bajar); nadie más lo lee ni lo escribe', async () => {
    await assertSucceeds(getDoc(doc(como('srv'), 'comparadorLimite', ID_LIMITE)));
    await assertSucceeds(setDoc(doc(como('srv'), 'comparadorLimite', ID_LIMITE), limite({ count: 2 })));
    await assertSucceeds(setDoc(doc(como('srv'), 'comparadorLimite', ID_LIMITE), limite({ count: 0 })));
    await assertSucceeds(setDoc(doc(como('srv'), 'comparadorLimite', `disp_${'b'.repeat(32)}_2026-11-07`), limite()));
    for (const db of [anonimo(), como('taller1'), como('admin')]) {
      await assertFails(getDoc(doc(db, 'comparadorLimite', ID_LIMITE)));
      await assertFails(setDoc(doc(db, 'comparadorLimite', ID_LIMITE), limite({ count: 0 })));
    }
    await assertFails(getDocs(collection(como('srv'), 'comparadorLimite')));
    await assertFails(deleteDoc(doc(como('srv'), 'comparadorLimite', ID_LIMITE)));
  });
  it('forma: ID con hash, solo count/actualizado/expiraEn, sin IP y sin vencer muy lejos', async () => {
    const srv = como('srv');
    await assertFails(setDoc(doc(srv, 'comparadorLimite', 'ip_192.168.0.1_2026-11-07'), limite()));
    await assertFails(setDoc(doc(srv, 'comparadorLimite', ID_LIMITE), limite({ ip: '1.2.3.4' })));
    await assertFails(setDoc(doc(srv, 'comparadorLimite', ID_LIMITE), limite({ count: -1 })));
    await assertFails(setDoc(doc(srv, 'comparadorLimite', ID_LIMITE), limite({ count: '1' })));
    await assertFails(setDoc(doc(srv, 'comparadorLimite', ID_LIMITE), limite({ expiraEn: enDias(30) })));
  });
});

describe('comparadorUso', () => {
  beforeEach(() => sembrar());
  it('el servicio suma conteos; el admin los lee; nadie más', async () => {
    await assertSucceeds(setDoc(doc(como('srv'), 'comparadorUso', '2026-11-07'), { consultas: increment(1), vinCache: increment(2), actualizadoAt: serverTimestamp() }, { merge: true }));
    await assertSucceeds(setDoc(doc(como('srv'), 'comparadorUso', '2026-11-08'), { limiteAlcanzado: increment(1), actualizadoAt: serverTimestamp() }, { merge: true }));
    await assertSucceeds(getDoc(doc(como('admin'), 'comparadorUso', '2026-11-07')));
    await assertFails(getDoc(doc(anonimo(), 'comparadorUso', '2026-11-07')));
    await assertFails(getDoc(doc(como('taller1'), 'comparadorUso', '2026-11-07')));
    await assertFails(setDoc(doc(como('admin'), 'comparadorUso', '2026-11-07'), { consultas: 9, actualizadoAt: serverTimestamp() }));
  });
  it('solo números conocidos: nada de datos personales', async () => {
    const srv = como('srv');
    await assertFails(setDoc(doc(srv, 'comparadorUso', '2026-11-07'), { ip: '1.2.3.4', actualizadoAt: serverTimestamp() }, { merge: true }));
    await assertFails(setDoc(doc(srv, 'comparadorUso', '2026-11-07'), { consultas: 'mucho', actualizadoAt: serverTimestamp() }, { merge: true }));
    await assertFails(setDoc(doc(srv, 'comparadorUso', 'hoy'), { consultas: 1, actualizadoAt: serverTimestamp() }));
  });
});

describe('vinDecodificado (caché de vPIC)', () => {
  beforeEach(() => sembrar());
  it('el servicio guarda y lee; el admin lee y borra; el público no', async () => {
    await assertSucceeds(setDoc(doc(como('srv'), 'vinDecodificado', '3N1AB7AP*KY'), vin()));
    await assertSucceeds(setDoc(doc(como('srv'), 'vinDecodificado', '3VWDX7AJ*BM'), vin({ marca: '', modelo: '', anio: '', sinDatos: true })));
    await assertSucceeds(getDoc(doc(como('srv'), 'vinDecodificado', CLAVE)));
    await assertSucceeds(getDocs(collection(como('admin'), 'vinDecodificado')));
    await assertSucceeds(deleteDoc(doc(como('admin'), 'vinDecodificado', CLAVE)));
    await assertFails(getDoc(doc(anonimo(), 'vinDecodificado', '3N1AB7AP*KY')));
    await assertFails(getDoc(doc(como('taller1'), 'vinDecodificado', '3N1AB7AP*KY')));
    await assertFails(setDoc(doc(como('taller1'), 'vinDecodificado', '3N1AB7AP*KY'), vin()));
  });
  it('nunca el VIN completo ni campos de más', async () => {
    const srv = como('srv');
    await assertFails(setDoc(doc(srv, 'vinDecodificado', '1HGCM82633A004352'), vin()));
    await assertFails(setDoc(doc(srv, 'vinDecodificado', CLAVE), vin({ vin: '1HGCM82633A004352' })));
    await assertFails(setDoc(doc(srv, 'vinDecodificado', CLAVE), vin({ marca: 'x'.repeat(81) })));
    await assertFails(setDoc(doc(srv, 'vinDecodificado', CLAVE), vin({ sinDatos: 'no' })));
  });
});

describe('equivalenciasPiezas', () => {
  beforeEach(() => sembrar());
  it('la escribe el admin, la lee el servidor; el público y los talleres no', async () => {
    await assertSucceeds(setDoc(doc(como('admin'), 'equivalenciasPiezas', 'E2'), { clase: 'aplicacion', parte: 'ABC123', marca: 'NISSAN', modelo: 'Versa', anioDesde: 2012, anioHasta: 2019 }));
    await assertSucceeds(getDocs(collection(como('srv'), 'equivalenciasPiezas')));
    await assertFails(setDoc(doc(como('srv'), 'equivalenciasPiezas', 'E3'), { clase: 'equivalencia', partes: ['A1', 'B1'] }));
    await assertFails(setDoc(doc(como('admin'), 'equivalenciasPiezas', 'E3'), { clase: 'otra', partes: ['A1', 'B1'] }));
    await assertFails(getDoc(doc(anonimo(), 'equivalenciasPiezas', 'E1')));
    await assertFails(getDoc(doc(como('taller1'), 'equivalenciasPiezas', 'E1')));
  });
});
