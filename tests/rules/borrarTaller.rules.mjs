// Pruebas de la función de admin que borra un taller completo (src/lib/borrarTallerCompleto.mjs).
// Corre contra el emulador con las reglas reales. Solo admin puede borrar; el taller no.
// Comando (desde la raíz del repo):  npm run test:rules
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertFails } from '@firebase/rules-unit-testing';
import { doc, collection, getDocs, getDoc, setDoc, query, where, writeBatch, serverTimestamp, deleteDoc } from 'firebase/firestore';
import { borrarTallerCompleto } from '../../src/lib/borrarTallerCompleto.mjs';

const reglas = readFileSync(new URL('../../firestore.rules', import.meta.url), 'utf8');
const fns = { collection, doc, getDocs, writeBatch, query, where };
let env;

async function sembrar() {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'config', 'cotizaciones'), { terminosVersion: 'v1', avisoTallerVersion: 'aviso-1', datosClienteHabilitados: true });
    await setDoc(doc(db, 'usuarios', 'adm'), { rol: 'admin', email: 'a@x.mx' });
    await setDoc(doc(db, 'talleres', 'T1'), {
      nombre: 'Taller', whatsapp: '6641234567', ciudad: 'Tijuana', logoUrl: '', ownerUid: 't1', activo: true,
      creadoAt: new Date(), aceptacionVersion: 'v1', avisoPrivacidad: { modo: 'generado', versionPlantilla: 'aviso-1', fecha: new Date() },
    });
    await setDoc(doc(db, 'talleres', 'T1', 'aceptaciones', 'v1'), { version: 'v1', fecha: new Date() });
    await setDoc(doc(db, 'usuarios', 't1'), { rol: 'taller', tallerId: 'T1', email: 't1@x.mx' });
    // Dos cotizaciones: una con 3 renglones y otra con 20
    for (const [folio, n] of [['C251006-AAAA', 3], ['C251006-BBBB', 20]]) {
      await setDoc(doc(db, 'talleres', 'T1', 'cotizaciones', folio), {
        tallerId: 'T1', estado: 'borrador', archivada: false, cliente: {}, vehiculo: { marca: 'N', modelo: 'S', anio: 2001 },
        observaciones: '', vigenciaDias: 15, totalCentavos: 1, numRenglones: n, creadoAt: new Date(), actualizadoAt: new Date(),
        expiraAt: new Date(Date.now() + 80 * 86400000), avisoVersion: 'aviso-1',
      });
      for (let i = 0; i < n; i++) {
        await setDoc(doc(db, 'talleres', 'T1', 'cotizaciones', folio, 'renglones', String(i)), {
          tipo: 'manoObra', descripcion: 'x', cantidad: 1, precioUnitario: 1, expiraAt: new Date(Date.now() + 80 * 86400000),
        });
      }
    }
    // Otro taller que NO se debe tocar
    await setDoc(doc(db, 'talleres', 'T2'), { nombre: 'Otro', whatsapp: '6649999999', ciudad: 'Ensenada', logoUrl: '', ownerUid: 't2', activo: true, creadoAt: new Date(), aceptacionVersion: 'v1', avisoPrivacidad: { modo: 'generado', versionPlantilla: 'aviso-1', fecha: new Date() } });
    await setDoc(doc(db, 'talleres', 'T2', 'aceptaciones', 'v1'), { version: 'v1', fecha: new Date() });
    await setDoc(doc(db, 'usuarios', 't2'), { rol: 'taller', tallerId: 'T2', email: 't2@x.mx' });
  });
}

async function conteos(uid, tallerId) {
  const db = env.authenticatedContext(uid).firestore();
  const cots = await getDocs(collection(db, 'talleres', tallerId, 'cotizaciones'));
  let renglones = 0;
  for (const c of cots.docs) renglones += (await getDocs(collection(db, 'talleres', tallerId, 'cotizaciones', c.id, 'renglones'))).size;
  const acs = await getDocs(collection(db, 'talleres', tallerId, 'aceptaciones'));
  const taller = await getDoc(doc(db, 'talleres', tallerId));
  const usuario = await getDoc(doc(db, 'usuarios', tallerId.toLowerCase()));
  return { cotizaciones: cots.size, renglones, aceptaciones: acs.size, taller: taller.exists(), usuario: usuario.exists() };
}

before(async () => {
  env = await initializeTestEnvironment({ projectId: 'demo-borrartaller', firestore: { rules: reglas, host: '127.0.0.1', port: 8181 } });
});
after(async () => { await env.cleanup(); });

describe('admin borra un taller completo', () => {
  it('borra renglones, cotizaciones, aceptaciones, taller y usuario; no toca otro taller', async () => {
    await sembrar();
    const db = env.authenticatedContext('adm').firestore();
    const resumen = await borrarTallerCompleto({ db, fns }, 'T1');
    assert.equal(resumen.cotizaciones, 2);
    assert.equal(resumen.renglones, 23);
    assert.equal(resumen.aceptaciones, 1);
    assert.equal(resumen.taller, true);
    assert.equal(resumen.usuarios, 1);
    const despues = await conteos('adm', 'T1');
    assert.deepEqual(despues, { cotizaciones: 0, renglones: 0, aceptaciones: 0, taller: false, usuario: false });
    const otro = await conteos('adm', 'T2');
    assert.equal(otro.taller, true);
    assert.equal(otro.aceptaciones, 1);
  });

  it('es idempotente: volver a correrla sobre un taller ya borrado no falla', async () => {
    await sembrar();
    const db = env.authenticatedContext('adm').firestore();
    await borrarTallerCompleto({ db, fns }, 'T1');
    const segunda = await borrarTallerCompleto({ db, fns }, 'T1');
    assert.equal(segunda.cotizaciones, 0);
    assert.equal(segunda.taller, true);
  });

  it('rechaza un ID de taller vacío', async () => {
    await sembrar();
    const db = env.authenticatedContext('adm').firestore();
    await assert.rejects(borrarTallerCompleto({ db, fns }, ''));
  });

  it('el taller no puede ejecutarla: las reglas lo bloquean', async () => {
    await sembrar();
    const db = env.authenticatedContext('t1').firestore();
    await assert.rejects(borrarTallerCompleto({ db, fns }, 'T1'));
    // Nada debe haberse borrado de la cuenta del taller
    const despues = await conteos('adm', 'T1');
    assert.equal(despues.taller, true);
    assert.equal(despues.cotizaciones, 2);
  });
});
