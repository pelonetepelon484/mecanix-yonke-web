// Pruebas de reglas para la cuenta de refaccionaria (etapa 1): bandera config/refaccionarias,
// registro, datos públicos y privados, lo que solo el admin escribe, aceptación de términos con su
// versión propia. El logo en Storage se prueba en storage.rules.mjs (el emulador de Storage comparte
// reglas entre proyectos). Corren contra el emulador con el archivo real ../../firestore.rules.
// Comando (desde la raíz del repo):  npm run test:rules
import { describe, it, before, after, beforeEach } from 'node:test';
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, setDoc, updateDoc, getDoc, deleteDoc, writeBatch, serverTimestamp, Timestamp } from 'firebase/firestore';

const reglas = readFileSync(new URL('../../firestore.rules', import.meta.url), 'utf8');
let env;

const CONFIG_ENCENDIDA = { habilitado: true, terminosVersion: 'r1', resumenCambios: 'Cambios de prueba' };

async function config(datos) {
  await env.withSecurityRulesDisabled(async (c) => {
    if (datos === null) await deleteDoc(doc(c.firestore(), 'config', 'refaccionarias'));
    else await setDoc(doc(c.firestore(), 'config', 'refaccionarias'), datos);
  });
}

// Refaccionaria ya registrada y aceptada (sembrada sin reglas).
const refaccionaria = (ownerUid, extra = {}) => ({
  nombre: 'Refacciones El Pistón', whatsapp: '6641234567', estado: 'baja-california', ciudad: 'Tijuana', logoUrl: '',
  slug: `el-piston-${ownerUid}`, ownerUid, activo: true, creadoAt: new Date(), aceptacionVersion: 'r1', ...extra,
});
// Como la crea el registro: sin aceptar, con la hora del servidor, sin Verificado, prueba ni plan.
const refaccionariaNueva = (uid, extra = {}) => ({
  nombre: 'Refaccionaria Nueva', whatsapp: '6649876543', estado: 'sonora', ciudad: 'Hermosillo', logoUrl: '',
  zonaEntrega: { descripcion: 'Entregas en Hermosillo centro', municipios: ['Hermosillo'] },
  slug: `refaccionaria-nueva-${uid}`, ownerUid: uid, activo: true, creadoAt: serverTimestamp(), aceptacionVersion: '', ...extra,
});

const como = (uid) => (uid ? env.authenticatedContext(uid).firestore() : env.unauthenticatedContext().firestore());
const rref = (uid, id) => doc(como(uid), 'refaccionarias', id);
const usuarioNuevo = (id) => ({ rol: 'refaccionaria', refaccionariaId: id, email: 'nueva@prueba.mx', fechaRegistro: serverTimestamp() });

// Registro como lo hace la app: refaccionaria + privado/datos en un lote, luego el usuario.
async function registrar(uid, id, datos = refaccionariaNueva(uid)) {
  const db = como(uid);
  const lote = writeBatch(db);
  lote.set(doc(db, 'refaccionarias', id), datos);
  lote.set(doc(db, 'refaccionarias', id, 'privado', 'datos'), { email: 'nueva@prueba.mx' });
  await lote.commit();
}
async function aceptar(uid, id, version) {
  const db = como(uid);
  const lote = writeBatch(db);
  lote.set(doc(db, 'refaccionarias', id, 'aceptaciones', version), { version, fecha: serverTimestamp() });
  lote.update(doc(db, 'refaccionarias', id), { aceptacionVersion: version });
  await lote.commit();
}

before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-refaccionarias',
    firestore: { rules: reglas, host: '127.0.0.1', port: 8181 },
  });
});
after(async () => { await env.cleanup(); });
beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (c) => {
    const db = c.firestore();
    await setDoc(doc(db, 'config', 'refaccionarias'), CONFIG_ENCENDIDA);
    await setDoc(doc(db, 'usuarios', 'adm'), { rol: 'admin', email: 'admin@prueba.mx' });
    await setDoc(doc(db, 'usuarios', 'y1'), { rol: 'yonke', yonkeId: 'Y1', email: 'y1@prueba.mx', fechaRegistro: new Date() });
    await setDoc(doc(db, 'usuarios', 't1'), { rol: 'taller', tallerId: 'T1', email: 't1@prueba.mx', fechaRegistro: new Date() });
    for (const [id, owner] of [['R1', 'r1'], ['R2', 'r2']]) {
      await setDoc(doc(db, 'refaccionarias', id), refaccionaria(owner));
      await setDoc(doc(db, 'refaccionarias', id, 'privado', 'datos'), { email: `${owner}@prueba.mx` });
      await setDoc(doc(db, 'refaccionarias', id, 'aceptaciones', 'r1'), { version: 'r1', fecha: new Date() });
      await setDoc(doc(db, 'usuarios', owner), { rol: 'refaccionaria', refaccionariaId: id, email: `${owner}@prueba.mx`, fechaRegistro: new Date() });
    }
  });
});

describe('bandera config/refaccionarias.habilitado', () => {
  it('apagada, sin el campo, sin el documento o con otro valor: nadie crea una refaccionaria', async () => {
    for (const datos of [{ ...CONFIG_ENCENDIDA, habilitado: false }, { terminosVersion: 'r1' }, null, { ...CONFIG_ENCENDIDA, habilitado: 'true' }]) {
      await config(datos);
      await assertFails(registrar('nuevo', 'RN'));
      await assertFails(setDoc(rref('nuevo', 'RN'), refaccionariaNueva('nuevo')));
    }
  });
  it('apagada: tampoco se crea el usuario con rol refaccionaria (aunque la refaccionaria ya exista)', async () => {
    await registrar('nuevo', 'RN');
    await config({ ...CONFIG_ENCENDIDA, habilitado: false });
    await assertFails(setDoc(doc(como('nuevo'), 'usuarios', 'nuevo'), usuarioNuevo('RN')));
  });
  it('encendida: registro completo (refaccionaria + privado, usuario y aceptación)', async () => {
    await assertSucceeds(registrar('nuevo', 'RN'));
    await assertSucceeds(setDoc(doc(como('nuevo'), 'usuarios', 'nuevo'), usuarioNuevo('RN')));
    await assertSucceeds(aceptar('nuevo', 'RN', 'r1'));
  });
});

describe('registro', () => {
  it('no nace con Verificado, pruebaHasta, plan ni premiumHasta, ni inactiva, ni a nombre de otro', async () => {
    for (const extra of [{ verificado: true }, { pruebaHasta: Timestamp.fromDate(new Date('2030-01-01')) }, { plan: 'pago' }, { premiumHasta: Timestamp.fromDate(new Date('2030-01-01')) }, { activo: false }, { ownerUid: 'otro' }, { aceptacionVersion: 'r1' }]) {
      await assertFails(registrar('nuevo', 'RN', refaccionariaNueva('nuevo', extra)));
    }
  });
  it('lista cerrada de campos y formatos', async () => {
    for (const extra of [{ whatsapp: '123' }, { estado: 'Baja California' }, { slug: 'Con Espacios' }, { campoExtra: 'x' },
      { zonaEntrega: { descripcion: 'x', municipios: [], extra: 1 } }, { zonaEntrega: { municipios: Array(31).fill('M') } }]) {
      await assertFails(registrar('nuevo', 'RN', refaccionariaNueva('nuevo', extra)));
    }
    // zonaEntrega es opcional
    const { zonaEntrega, ...sinZona } = refaccionariaNueva('nuevo');
    await assertSucceeds(registrar('nuevo', 'RN', sinZona));
  });
  it('quien ya tiene cuenta de yonke, taller o refaccionaria no crea otra', async () => {
    for (const uid of ['y1', 't1', 'r1']) await assertFails(registrar(uid, `RX-${uid}`, refaccionariaNueva(uid)));
  });
  it('el usuario debe apuntar a una refaccionaria propia y con los 4 campos', async () => {
    await registrar('nuevo', 'RN');
    await assertFails(setDoc(doc(como('nuevo'), 'usuarios', 'nuevo'), usuarioNuevo('R1')));
    await assertFails(setDoc(doc(como('nuevo'), 'usuarios', 'nuevo'), { ...usuarioNuevo('RN'), extra: 1 }));
    await assertFails(setDoc(doc(como('nuevo'), 'usuarios', 'nuevo'), { ...usuarioNuevo('RN'), rol: 'admin' }));
  });
  it('rollback: el dueño borra su refaccionaria y su privado solo mientras no exista su usuario', async () => {
    await registrar('nuevo', 'RN');
    await assertSucceeds(deleteDoc(doc(como('nuevo'), 'refaccionarias', 'RN', 'privado', 'datos')));
    await assertSucceeds(deleteDoc(rref('nuevo', 'RN')));
    await assertFails(deleteDoc(rref('r1', 'R1')));
  });
});

describe('datos públicos y lo que solo el admin escribe', () => {
  it('cualquiera lee los datos del negocio, también sin sesión', async () => {
    await assertSucceeds(getDoc(rref(null, 'R1')));
    await assertSucceeds(getDoc(rref('y1', 'R1')));
  });
  it('el dueño edita sus datos, no los de otra', async () => {
    await assertSucceeds(updateDoc(rref('r1', 'R1'), { nombre: 'El Pistón 2', zonaEntrega: { descripcion: 'Centro', municipios: ['Tijuana'] } }));
    await assertFails(updateDoc(rref('r1', 'R2'), { nombre: 'Robada' }));
    await assertFails(updateDoc(rref('y1', 'R1'), { nombre: 'Yonke' }));
  });
  it('el dueño NO cambia ownerUid, activo, verificado, pruebaHasta, plan, premiumHasta, creadoAt ni slug', async () => {
    for (const cambio of [{ ownerUid: 'otro' }, { activo: false }, { verificado: true }, { pruebaHasta: Timestamp.fromDate(new Date('2030-01-01')) }, { plan: 'pago' },
      { premiumHasta: Timestamp.fromDate(new Date('2030-01-01')) }, { creadoAt: Timestamp.fromDate(new Date('2020-01-01')) }, { slug: 'otro-slug' }]) {
      await assertFails(updateDoc(rref('r1', 'R1'), cambio));
    }
  });
  it('el admin escribe verificado, pruebaHasta, plan, premiumHasta y activo', async () => {
    await assertSucceeds(updateDoc(rref('adm', 'R1'), { verificado: true, pruebaHasta: Timestamp.fromDate(new Date('2027-01-27')), plan: 'pago', premiumHasta: Timestamp.fromDate(new Date('2030-01-01')), activo: false }));
  });
  it('con Verificado, prueba y plan ya puestos por el admin, el dueño sigue editando sus datos sin tocarlos', async () => {
    await updateDoc(rref('adm', 'R1'), { verificado: true, pruebaHasta: Timestamp.fromDate(new Date('2027-01-27')), plan: 'pago' });
    await assertSucceeds(updateDoc(rref('r1', 'R1'), { ciudad: 'Rosarito' }));
    await assertFails(updateDoc(rref('r1', 'R1'), { verificado: false }));
    await assertFails(updateDoc(rref('r1', 'R1'), { pruebaHasta: Timestamp.fromDate(new Date('2030-01-01')) }));
  });
});

describe('datos privados (privado/datos)', () => {
  it('solo el dueño y el admin leen el correo', async () => {
    await assertSucceeds(getDoc(doc(como('r1'), 'refaccionarias', 'R1', 'privado', 'datos')));
    await assertSucceeds(getDoc(doc(como('adm'), 'refaccionarias', 'R1', 'privado', 'datos')));
    await assertFails(getDoc(doc(como('r2'), 'refaccionarias', 'R1', 'privado', 'datos')));
    await assertFails(getDoc(doc(como(null), 'refaccionarias', 'R1', 'privado', 'datos')));
  });
  it('el dueño cambia su correo, otra no; solo el campo email y solo el documento "datos"', async () => {
    await assertSucceeds(setDoc(doc(como('r1'), 'refaccionarias', 'R1', 'privado', 'datos'), { email: 'nuevo@prueba.mx' }));
    await assertFails(setDoc(doc(como('r2'), 'refaccionarias', 'R1', 'privado', 'datos'), { email: 'x@prueba.mx' }));
    await assertFails(setDoc(doc(como('r1'), 'refaccionarias', 'R1', 'privado', 'datos'), { email: 'x@prueba.mx', telefono: '1' }));
    await assertFails(setDoc(doc(como('r1'), 'refaccionarias', 'R1', 'privado', 'otro'), { email: 'x@prueba.mx' }));
  });
});

describe('aceptación de términos (versión propia de refaccionarias)', () => {
  it('acepta la versión vigente con su historial en el mismo lote; no otra versión ni sin historial', async () => {
    await config({ ...CONFIG_ENCENDIDA, terminosVersion: 'r2' });
    await assertFails(aceptar('r1', 'R1', 'r9'));
    await assertFails(updateDoc(rref('r1', 'R1'), { aceptacionVersion: 'r2' }));
    await assertSucceeds(aceptar('r1', 'R1', 'r2'));
  });
  it('el historial no se modifica; solo el dueño y el admin lo leen', async () => {
    await assertFails(updateDoc(doc(como('r1'), 'refaccionarias', 'R1', 'aceptaciones', 'r1'), { fecha: serverTimestamp() }));
    await assertSucceeds(getDoc(doc(como('r1'), 'refaccionarias', 'R1', 'aceptaciones', 'r1')));
    await assertFails(getDoc(doc(como('r2'), 'refaccionarias', 'R1', 'aceptaciones', 'r1')));
  });
  it('sin terminosVersion en config/refaccionarias, no se puede aceptar ninguna versión', async () => {
    await config({ habilitado: true });
    await assertFails(aceptar('r1', 'R1', 'r1'));
    await assertFails(aceptar('r1', 'R1', 'r2'));
  });
});
