// Pruebas de reglas de Firestore para la cuenta de taller (usuarios/{uid} con rol 'taller' y talleres/{id}).
// Corren contra el emulador con el archivo real ../../firestore.rules.
// Comando (desde la raíz del repo):  npm run test:rules
import { describe, it, before, after } from 'node:test';
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, setDoc, updateDoc, getDoc, deleteDoc, addDoc, collection, serverTimestamp } from 'firebase/firestore';

const reglas = readFileSync(new URL('../../firestore.rules', import.meta.url), 'utf8');
let env;

// Datos base: un admin, un yonke con dueño, un taller ya registrado (t1 es su dueño).
async function sembrar() {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'usuarios', 'adm'), { rol: 'admin', email: 'admin@prueba.mx' });
    await setDoc(doc(db, 'yonkes', 'Y1'), { nombre: 'Yonke uno', activo: true, ownerUid: 'y1' });
    await setDoc(doc(db, 'usuarios', 'y1'), { rol: 'yonke', yonkeId: 'Y1', email: 'y1@prueba.mx', fechaRegistro: new Date() });
    await setDoc(doc(db, 'talleres', 'T1'), { nombre: 'Taller uno', whatsapp: '6641234567', ciudad: 'Tijuana', logoUrl: '', ownerUid: 't1', activo: true, creadoAt: new Date() });
    await setDoc(doc(db, 'usuarios', 't1'), { rol: 'taller', tallerId: 'T1', email: 't1@prueba.mx', fechaRegistro: new Date() });
  });
}

const como = (uid) => (uid ? env.authenticatedContext(uid).firestore() : env.unauthenticatedContext().firestore());
const tallerNuevo = (extra = {}) => ({
  nombre: 'Taller nuevo', whatsapp: '6649876543', ciudad: 'Ensenada', logoUrl: '', ownerUid: 't0',
  activo: true, creadoAt: serverTimestamp(), aceptacionLegal: { version: 'prueba', fecha: new Date() }, ...extra,
});
const usuarioTaller = (extra = {}) => ({
  rol: 'taller', tallerId: 'T0', email: 't0@prueba.mx', fechaRegistro: serverTimestamp(), ...extra,
});

before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-talleres',
    firestore: { rules: reglas, host: '127.0.0.1', port: 8181 },
  });
});
after(async () => { await env.cleanup(); });

describe('registro de taller (en el mismo orden que el código)', () => {
  it('paso 1: crea su taller con ownerUid propio', async () => {
    await sembrar();
    await assertSucceeds(setDoc(doc(como('t0'), 'talleres', 'T0'), tallerNuevo()));
  });
  it('paso 2: crea su usuario de taller apuntando a su taller', async () => {
    await sembrar();
    await setDoc(doc(como('t0'), 'talleres', 'T0'), tallerNuevo());
    await assertSucceeds(setDoc(doc(como('t0'), 'usuarios', 't0'), usuarioTaller()));
  });
  it('no puede crear el taller sin aceptar términos y aviso', async () => {
    await sembrar();
    const { aceptacionLegal, ...sinAceptacion } = tallerNuevo();
    await assertFails(setDoc(doc(como('t0'), 'talleres', 'T0'), sinAceptacion));
  });
  it('no puede crear el taller si ya tiene usuario de rol', async () => {
    await sembrar();
    await assertFails(setDoc(doc(como('t1'), 'talleres', 'T9'), tallerNuevo({ ownerUid: 't1' })));
  });
  it('rollback: el dueño borra su taller antes de tener usuario', async () => {
    await sembrar();
    await setDoc(doc(como('t8'), 'talleres', 'T8'), tallerNuevo({ ownerUid: 't8' }));
    await assertSucceeds(deleteDoc(doc(como('t8'), 'talleres', 'T8')));
  });
});

describe('taller nuevo intentando apuntar a otra cuenta o subir de rol', () => {
  it('no puede apuntar su usuario a un taller ajeno', async () => {
    await sembrar();
    await assertFails(setDoc(doc(como('t9'), 'usuarios', 't9'), usuarioTaller({ tallerId: 'T1' })));
  });
  it('no puede ponerse rol admin', async () => {
    await sembrar();
    await assertFails(setDoc(doc(como('t9'), 'usuarios', 't9'), usuarioTaller({ rol: 'admin', tallerId: 'T1' })));
  });
  it('no puede ponerse rol yonke (con un yonke existente)', async () => {
    await sembrar();
    await assertFails(setDoc(doc(como('t9'), 'usuarios', 't9'), { rol: 'yonke', yonkeId: 'Y1', email: 't9@prueba.mx', fechaRegistro: serverTimestamp() }));
  });
  it('no puede agregar campos extra al usuario de taller', async () => {
    await sembrar();
    await setDoc(doc(como('t0'), 'talleres', 'T0'), tallerNuevo());
    await assertFails(setDoc(doc(como('t0'), 'usuarios', 't0'), usuarioTaller({ admin: true })));
  });
  it('no puede cambiar su rol después de registrarse', async () => {
    await sembrar();
    await assertFails(updateDoc(doc(como('t1'), 'usuarios', 't1'), { rol: 'yonke', yonkeId: 'Y1' }));
  });
  it('no puede cambiar su tallerId después de registrarse', async () => {
    await sembrar();
    await assertFails(updateDoc(doc(como('t1'), 'usuarios', 't1'), { tallerId: 'T9' }));
  });
});

describe('dueño de taller: sus datos', () => {
  it('cambia nombre y WhatsApp válido', async () => {
    await sembrar();
    await assertSucceeds(updateDoc(doc(como('t1'), 'talleres', 'T1'), { nombre: 'Taller editado', whatsapp: '6640000000' }));
  });
  it('no puede cambiar ownerUid', async () => {
    await sembrar();
    await assertFails(updateDoc(doc(como('t1'), 'talleres', 'T1'), { ownerUid: 't9' }));
  });
  it('no puede desactivar su taller', async () => {
    await sembrar();
    await assertFails(updateDoc(doc(como('t1'), 'talleres', 'T1'), { activo: false }));
  });
  it('no acepta WhatsApp de 5 dígitos', async () => {
    await sembrar();
    await assertFails(updateDoc(doc(como('t1'), 'talleres', 'T1'), { whatsapp: '12345' }));
  });
  it('no acepta WhatsApp con letras', async () => {
    await sembrar();
    await assertFails(updateDoc(doc(como('t1'), 'talleres', 'T1'), { whatsapp: 'abc1234567' }));
  });
  it('no puede borrar su taller si su usuario ya existe', async () => {
    await sembrar();
    await assertFails(deleteDoc(doc(como('t1'), 'talleres', 'T1')));
  });
});

describe('taller nuevo: validaciones al crear su taller', () => {
  it('rechaza WhatsApp de 9 dígitos', async () => {
    await sembrar();
    await assertFails(setDoc(doc(como('t9'), 'talleres', 'T9'), tallerNuevo({ whatsapp: '664123456', ownerUid: 't9' })));
  });
  it('rechaza un taller con ownerUid de otra persona', async () => {
    await sembrar();
    await assertFails(setDoc(doc(como('t9'), 'talleres', 'T9b'), tallerNuevo({ ownerUid: 't0' })));
  });
  it('rechaza un taller nuevo que nace desactivado', async () => {
    await sembrar();
    await assertFails(setDoc(doc(como('t9'), 'talleres', 'T9c'), tallerNuevo({ ownerUid: 't9', activo: false })));
  });
});

describe('lectura y acceso ajeno', () => {
  it('un taller no lee el taller de otro', async () => {
    await sembrar();
    await assertFails(getDoc(doc(como('t9'), 'talleres', 'T1')));
  });
  it('el dueño lee su propio taller', async () => {
    await sembrar();
    await assertSucceeds(getDoc(doc(como('t1'), 'talleres', 'T1')));
  });
  it('un visitante sin sesión no lee talleres', async () => {
    await sembrar();
    await assertFails(getDoc(doc(como(null), 'talleres', 'T1')));
  });
  it('un yonke no puede crear un taller propio', async () => {
    await sembrar();
    await assertFails(setDoc(doc(como('y1'), 'talleres', 'TY'), tallerNuevo({ ownerUid: 'y1' })));
  });
  it('un taller no puede escribir en un yonke ajeno', async () => {
    await sembrar();
    await assertFails(updateDoc(doc(como('t1'), 'yonkes', 'Y1'), { nombre: 'hackeado' }));
  });
});

describe('admin sobre talleres', () => {
  it('lee, edita y borra talleres', async () => {
    await sembrar();
    await assertSucceeds(getDoc(doc(como('adm'), 'talleres', 'T1')));
    await assertSucceeds(updateDoc(doc(como('adm'), 'talleres', 'T1'), { activo: true }));
    await assertSucceeds(deleteDoc(doc(como('adm'), 'talleres', 'T1')));
  });
});

describe('yonkes: no se rompen con el cambio de taller', () => {
  it('registro de yonke nuevo (yonke con ownerUid y luego usuario)', async () => {
    await sembrar();
    await assertSucceeds(setDoc(doc(como('y5'), 'yonkes', 'Y5'), { nombre: 'Nuevo', activo: true, ownerUid: 'y5' }));
    await assertSucceeds(setDoc(doc(como('y5'), 'usuarios', 'y5'), { rol: 'yonke', yonkeId: 'Y5', email: 'y5@prueba.mx', fechaRegistro: serverTimestamp() }));
  });
  it('yonke existente entra y lee su usuario', async () => {
    await sembrar();
    await assertSucceeds(getDoc(doc(como('y1'), 'usuarios', 'y1')));
  });
  it('admin crea un acceso de yonke', async () => {
    await sembrar();
    await assertSucceeds(setDoc(doc(como('adm'), 'usuarios', 'a1'), { rol: 'yonke', yonkeId: 'Y1', email: 'a1@prueba.mx', fechaRegistro: serverTimestamp() }));
  });
  it('admin revoca un acceso de yonke', async () => {
    await sembrar();
    await assertSucceeds(deleteDoc(doc(como('adm'), 'usuarios', 'y1')));
  });
  it('un yonke no puede cambiar su propio usuario', async () => {
    await sembrar();
    await assertFails(updateDoc(doc(como('y1'), 'usuarios', 'y1'), { yonkeId: 'Y1' }));
  });
  it('una cuenta de taller ya registrada no puede crear un yonke propio', async () => {
    await sembrar();
    await assertFails(setDoc(doc(como('t1'), 'yonkes', 'YT'), { nombre: 'Yonke de taller', ownerUid: 't1' }));
  });
  it('un usuario sin cuenta no puede crear yonke sin ownerUid', async () => {
    await sembrar();
    await assertFails(addDoc(collection(como('x7'), 'yonkes'), { nombre: 'Sin dueño' }));
  });
});
