// Reglas de busquedasResumen (copia reducida que ve el yonke en "Demanda"): lista EXACTA de
// campos, con alcanceResultado opcional y solo con sus 3 valores.
// Comando (desde la raíz del repo):  npm run test:rules
import { describe, it, before, after } from 'node:test';
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { addDoc, collection, Timestamp } from 'firebase/firestore';

const reglas = readFileSync(new URL('../../firestore.rules', import.meta.url), 'utf8');
let env;
const resumen = (extra = {}) => ({
  estadoGeografico: 'son', pieza: 'Alternador', marca: 'Honda', modelo: 'Civic', anio: 2016,
  estado: 'ok', conResultado: true, sinVehiculo: false, fecha: Timestamp.now(), ...extra,
});
// El servidor escribe sin sesión (dbServer).
const crear = (datos) => addDoc(collection(env.unauthenticatedContext().firestore(), 'busquedasResumen'), datos);

before(async () => {
  env = await initializeTestEnvironment({ projectId: 'demo-busquedas-resumen', firestore: { rules: reglas, host: '127.0.0.1', port: 8181 } });
});
after(async () => { await env.cleanup(); });

describe('busquedasResumen: alcanceResultado', () => {
  it('con cualquiera de los 3 valores: se guarda', async () => {
    for (const a of ['con_resultado', 'solo_otros_estados', 'sin_resultado']) await assertSucceeds(crear(resumen({ alcanceResultado: a })));
  });
  it('sin el campo (versión anterior de la app): se sigue guardando', async () => {
    await assertSucceeds(crear(resumen()));
  });
  it('otro valor, otro tipo o null: no', async () => {
    for (const a of ['con', 'otros', '', 1, true, null]) await assertFails(crear(resumen({ alcanceResultado: a })));
  });
  it('cualquier otro campo sigue prohibido (por ejemplo el estado elegido, que solo va en busquedas)', async () => {
    await assertFails(crear(resumen({ estadoBusqueda: 'jalisco' })));
    await assertFails(crear(resumen({ alcanceResultado: 'con_resultado', textoOriginal: 'x' })));
  });
});
