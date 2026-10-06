// Pruebas de reglas de Firestore para la cuenta de taller: registro, aceptación de términos,
// historial de aceptaciones y permisos sobre el taller.
// Corren contra el emulador con el archivo real ../../firestore.rules.
// Comando (desde la raíz del repo):  npm run test:rules
import { describe, it, before, after } from 'node:test';
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, setDoc, updateDoc, getDoc, deleteDoc, writeBatch, serverTimestamp } from 'firebase/firestore';

const reglas = readFileSync(new URL('../../firestore.rules', import.meta.url), 'utf8');
let env;

async function sembrar() {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'config', 'cotizaciones'), { terminosVersion: 'v1', avisoTallerVersion: 'aviso-1', datosClienteHabilitados: true, resumenCambios: 'Cambios de prueba' });
    await setDoc(doc(db, 'usuarios', 'adm'), { rol: 'admin', email: 'admin@prueba.mx' });
    await setDoc(doc(db, 'yonkes', 'Y1'), { nombre: 'Yonke uno', activo: true, ownerUid: 'y1' });
    await setDoc(doc(db, 'usuarios', 'y1'), { rol: 'yonke', yonkeId: 'Y1', email: 'y1@prueba.mx', fechaRegistro: new Date() });
    for (const [id, owner, activo] of [['T1', 't1', true], ['T2', 't2', true], ['T3', 't3', false]]) {
      await setDoc(doc(db, 'talleres', id), taller(owner, activo));
      await setDoc(doc(db, 'talleres', id, 'aceptaciones', 'v1'), { version: 'v1', fecha: new Date() });
      await setDoc(doc(db, 'usuarios', owner), { rol: 'taller', tallerId: id, email: `${owner}@prueba.mx`, fechaRegistro: new Date() });
    }
  });
}

function taller(ownerUid, activo = true, extra = {}) {
  return {
    nombre: 'Taller de prueba', whatsapp: '6641234567', ciudad: 'Tijuana', logoUrl: '', ownerUid, activo,
    creadoAt: new Date(), aceptacionVersion: 'v1',
    avisoPrivacidad: { modo: 'generado', versionPlantilla: 'aviso-1', fecha: new Date() },
    ...extra,
  };
}
// Taller nuevo, como lo crea el registro: sin aceptar y con la fecha del servidor
const tallerNuevo = (uid, extra = {}) => ({
  nombre: 'Taller nuevo', whatsapp: '6649876543', ciudad: 'Ensenada', logoUrl: '', ownerUid: uid,
  activo: true, creadoAt: serverTimestamp(), aceptacionVersion: '',
  avisoPrivacidad: { modo: 'generado', versionPlantilla: 'aviso-1', fecha: serverTimestamp() },
  ...extra,
});

const como = (uid) => (uid ? env.authenticatedContext(uid).firestore() : env.unauthenticatedContext().firestore());
const tref = (uid, id) => doc(como(uid), 'talleres', id);
const aref = (uid, id, version) => doc(como(uid), 'talleres', id, 'aceptaciones', version);

// Lote de aceptación: entrada del historial + taller con la versión aceptada (como hace la app)
async function aceptar(uid, tallerId, version) {
  const db = como(uid);
  const lote = writeBatch(db);
  lote.set(doc(db, 'talleres', tallerId, 'aceptaciones', version), { version, fecha: serverTimestamp() });
  lote.update(doc(db, 'talleres', tallerId), { aceptacionVersion: version });
  await lote.commit();
}

before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-talleres',
    firestore: { rules: reglas, host: '127.0.0.1', port: 8181 },
  });
});
after(async () => { await env.cleanup(); });

describe('registro de taller', () => {
  it('crea el taller sin aceptar, con el aviso vigente y su fecha del servidor', async () => {
    await sembrar();
    await assertSucceeds(setDoc(tref('t9', 'T9'), tallerNuevo('t9')));
  });
  it('bloquea un taller nuevo cuya versión de aviso no es la vigente', async () => {
    await sembrar();
    await assertFails(setDoc(tref('t9', 'T9'), tallerNuevo('t9', { avisoPrivacidad: { modo: 'generado', versionPlantilla: 'aviso-viejo', fecha: serverTimestamp() } })));
  });
  it('bloquea un taller nuevo con la fecha del aviso puesta por el cliente', async () => {
    await sembrar();
    await assertFails(setDoc(tref('t9', 'T9'), tallerNuevo('t9', { avisoPrivacidad: { modo: 'generado', versionPlantilla: 'aviso-1', fecha: new Date() } })));
  });
  it('bloquea un taller nuevo que nace ya aceptado', async () => {
    await sembrar();
    await assertFails(setDoc(tref('t9', 'T9'), tallerNuevo('t9', { aceptacionVersion: 'v1' })));
  });
  it('bloquea un taller nuevo sin el campo de aceptación', async () => {
    await sembrar();
    const { aceptacionVersion, ...sin } = tallerNuevo('t9');
    await assertFails(setDoc(tref('t9', 'T9'), sin));
  });
  it('bloquea el campo viejo aceptacionLegal', async () => {
    await sembrar();
    await assertFails(setDoc(tref('t9', 'T9'), tallerNuevo('t9', { aceptacionLegal: { version: 'x', fecha: new Date() } })));
  });
  it('bloquea un taller nuevo para alguien que ya tiene cuenta de rol', async () => {
    await sembrar();
    await assertFails(setDoc(tref('y1', 'TY'), tallerNuevo('y1')));
  });
  it('el usuario de taller se crea apuntando a su propio taller', async () => {
    await sembrar();
    await setDoc(tref('t9', 'T9'), tallerNuevo('t9'));
    await assertSucceeds(setDoc(doc(como('t9'), 'usuarios', 't9'), { rol: 'taller', tallerId: 'T9', email: 't9@x.mx', fechaRegistro: serverTimestamp() }));
  });
});

describe('aceptación de términos', () => {
  it('acepta la versión vigente en un lote (historial + taller)', async () => {
    await sembrar();
    await env.withSecurityRulesDisabled(async (c) => { await updateDoc(doc(c.firestore(), 'config', 'cotizaciones'), { terminosVersion: 'v2' }); });
    await assertSucceeds(aceptar('t1', 'T1', 'v2'));
  });
  it('bloquea inventar una versión que no es la vigente', async () => {
    await sembrar();
    await assertFails(aceptar('t1', 'T1', 'v9'));
  });
  it('bloquea aceptar en el taller de otro', async () => {
    await sembrar();
    await assertFails(aceptar('t2', 'T1', 'v1'));
  });
  it('bloquea cambiar el aviso de privacidad', async () => {
    await sembrar();
    await assertFails(updateDoc(tref('t1', 'T1'), { avisoPrivacidad: { modo: 'generado', versionPlantilla: 'otro', fecha: serverTimestamp() } }));
  });
  it('bloquea cambiar el estado activo o el dueño', async () => {
    await sembrar();
    await assertFails(updateDoc(tref('t1', 'T1'), { activo: false }));
    await assertFails(updateDoc(tref('t1', 'T1'), { ownerUid: 't2' }));
  });
  it('permite cambiar el nombre', async () => {
    await sembrar();
    await assertSucceeds(updateDoc(tref('t1', 'T1'), { nombre: 'Taller editado' }));
  });
});

describe('historial de aceptaciones', () => {
  it('el dueño lee su propio historial', async () => {
    await sembrar();
    await assertSucceeds(getDoc(aref('t1', 'T1', 'v1')));
  });
  it('un taller NO lee el historial de otro taller', async () => {
    await sembrar();
    await assertFails(getDoc(aref('t2', 'T1', 'v1')));
  });
  it('el admin lee cualquier historial', async () => {
    await sembrar();
    await assertSucceeds(getDoc(aref('adm', 'T1', 'v1')));
  });
  it('nadie puede modificar una entrada del historial (ni el dueño)', async () => {
    await sembrar();
    await assertFails(updateDoc(aref('t1', 'T1', 'v1'), { fecha: serverTimestamp() }));
  });
  it('el taller NO puede borrar una aceptación', async () => {
    await sembrar();
    await assertFails(deleteDoc(aref('t1', 'T1', 'v1')));
  });
  it('el admin SÍ puede borrar una aceptación', async () => {
    await sembrar();
    await assertSucceeds(deleteDoc(aref('adm', 'T1', 'v1')));
  });
  it('el admin no puede crear entradas del historial', async () => {
    await sembrar();
    await assertFails(setDoc(aref('adm', 'T1', 'v7'), { version: 'v7', fecha: serverTimestamp() }));
  });
});

describe('lectura y borrado del taller', () => {
  it('un taller ajeno no lee un taller', async () => {
    await sembrar();
    await assertFails(getDoc(tref('t9', 'T1')));
  });
  it('un visitante no lee talleres', async () => {
    await sembrar();
    await assertFails(getDoc(tref(null, 'T1')));
  });
  it('el dueño no puede borrar su taller si su usuario ya existe', async () => {
    await sembrar();
    await assertFails(deleteDoc(tref('t1', 'T1')));
  });
  it('el admin borra un taller', async () => {
    await sembrar();
    await assertSucceeds(deleteDoc(tref('adm', 'T2')));
  });
});

describe('yonkes no cambian', () => {
  it('un yonke sigue leyendo su usuario', async () => {
    await sembrar();
    await assertSucceeds(getDoc(doc(como('y1'), 'usuarios', 'y1')));
  });
  it('un yonke no puede crear un taller', async () => {
    await sembrar();
    await assertFails(setDoc(tref('y1', 'TY'), tallerNuevo('y1')));
  });
});
