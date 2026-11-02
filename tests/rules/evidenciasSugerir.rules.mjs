// Pruebas de reglas: evidenciasSugerir. Autorización escrita del yonke para "Sugerir yonke", en el
// mismo lote que la respuesta; solo el admin la lee, nadie la cambia, y se conserva 30 días (TTL).
// Comando (desde la raíz del repo):  npm run test:rules
import { describe, it, before, after, beforeEach } from 'node:test';
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { Timestamp, deleteDoc, deleteField, doc, getDoc, serverTimestamp, setDoc, updateDoc, writeBatch } from 'firebase/firestore';

const reglas = readFileSync(new URL('../../firestore.rules', import.meta.url), 'utf8');
const DIA = 24 * 60 * 60 * 1000;
const EMAIL = 'admin@prueba.mx';
let env;
const como = (uid) => env.authenticatedContext(uid, uid === 'adm' ? { email: EMAIL } : {}).firestore();
const en5Dias = () => Timestamp.fromMillis(Date.now() + 5 * DIA);
const en30Dias = () => Timestamp.fromMillis(Date.now() + 30 * DIA);

const RUTAS = { pedidosClientes: 'P1', solicitudesPiezas: 'S1' };

// Lote igual al de sugerirYonke() en src/app/admin/pedidos/datos.js. extra con undefined quita el campo.
function sugerir(coleccion, { id = 'E1', uid = 'adm', extra = {}, respuestaExtra = {}, sinEvidencia = false, sinRespuesta = false, pedidoId = RUTAS[coleccion], expiraPedido } = {}) {
  const db = como(uid);
  const lote = writeBatch(db);
  const respuesta = {
    yonkeId: 'Y1', yonkeNombre: 'Yonke Uno', whatsapp: '6641111111', tieneLaPieza: true, precioATratar: true, nota: '',
    creadoPorAdmin: true, creadoPorAdminUid: uid, evidenciaId: id, creadoAt: serverTimestamp(), expiraAt: expiraPedido, ...respuestaExtra,
  };
  const evidencia = {
    coleccion, pedidoId, busqueda: 'Alternador · Nissan Sentra 2005', yonkeId: 'Y1', yonkeNombre: 'Yonke Uno', yonkeWhatsapp: '6641111111',
    medio: 'whatsapp', mensaje: 'Sí tengo la pieza y autorizo.', recibidoAt: Timestamp.fromMillis(Date.now() - 60000), autorizacionConfirmada: true,
    adminUid: uid, adminEmail: EMAIL, creadoAt: serverTimestamp(), expiraAt: en30Dias(), ...extra,
  };
  for (const o of [respuesta, evidencia]) for (const k of Object.keys(o)) if (o[k] === undefined) delete o[k];
  if (!sinRespuesta) lote.set(doc(db, coleccion, RUTAS[coleccion], 'respuestas', 'Y1'), respuesta);
  if (!sinEvidencia) lote.set(doc(db, 'evidenciasSugerir', id), evidencia);
  return lote.commit();
}

async function vencimiento(coleccion) {
  let v;
  await env.withSecurityRulesDisabled(async (ctx) => { v = (await getDoc(doc(ctx.firestore(), coleccion, RUTAS[coleccion]))).data().expiraAt; });
  return v;
}
const intentar = async (coleccion, opciones = {}) => sugerir(coleccion, { ...opciones, expiraPedido: await vencimiento(coleccion) });

before(async () => {
  env = await initializeTestEnvironment({ projectId: 'demo-evidencias', firestore: { rules: reglas, host: '127.0.0.1', port: 8181 } });
});
after(async () => { await env.cleanup(); });
beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'config', 'pedidosClientes'), { habilitado: true, sugerirYonkeAdmin: true });
    await setDoc(doc(db, 'config', 'solicitudesPiezas'), { habilitado: true, sugerirYonkeAdmin: true });
    await setDoc(doc(db, 'usuarios', 'adm'), { rol: 'admin', email: EMAIL });
    await setDoc(doc(db, 'usuarios', 'o1'), { rol: 'yonke', yonkeId: 'Y1' });
    await setDoc(doc(db, 'yonkes', 'Y1'), { nombre: 'Yonke Uno', whatsapp: '6641111111', estado: 'baja-california', activo: true, ownerUid: 'o1' });
    await setDoc(doc(db, 'pedidosClientes', 'P1'), { pieza: 'Alternador', estado: 'baja-california', estadoPedido: 'abierta', expiraAt: en5Dias() });
    await setDoc(doc(db, 'solicitudesPiezas', 'S1'), { pieza: 'Faro', estado: 'baja-california', estadoSolicitud: 'abierta', tallerId: 'T1', expiraAt: en5Dias() });
  });
});

describe('evidencia de Sugerir yonke: alta', () => {
  it('el admin guarda respuesta y evidencia juntas, en las dos colecciones', async () => {
    await assertSucceeds(intentar('pedidosClientes'));
    await assertSucceeds(intentar('solicitudesPiezas', { id: 'E2' }));
  });
  it('NO con la evidencia de otro pedido, de otro yonke o de otra colección', async () => {
    await assertFails(intentar('pedidosClientes', { extra: { pedidoId: 'OTRO' } }));
    await assertFails(intentar('pedidosClientes', { extra: { yonkeId: 'Y2' } }));
    await assertFails(intentar('pedidosClientes', { extra: { coleccion: 'solicitudesPiezas' } }));
  });
  it('NO con un evidenciaId que no existe en el lote', async () => {
    await assertFails(intentar('pedidosClientes', { sinEvidencia: true }));
  });
  it('NO evidencia suelta, sin su respuesta', async () => {
    await assertFails(intentar('pedidosClientes', { sinRespuesta: true }));
  });
  it('NO sin alguno de los datos, con medio no escrito ni con campos de más', async () => {
    for (const campo of ['busqueda', 'medio', 'mensaje', 'recibidoAt', 'autorizacionConfirmada', 'adminUid', 'adminEmail', 'expiraAt']) {
      await assertFails(intentar('pedidosClientes', { extra: { [campo]: undefined } }));
    }
    await assertFails(intentar('pedidosClientes', { extra: { medio: 'llamada' } }));
    await assertFails(intentar('pedidosClientes', { extra: { mensaje: '' } }));
    await assertFails(intentar('pedidosClientes', { extra: { mensaje: 'x'.repeat(2001) } }));
    await assertFails(intentar('pedidosClientes', { extra: { autorizacionConfirmada: false } }));
    await assertFails(intentar('pedidosClientes', { extra: { precio: 1500 } }));
  });
  it('NO con fecha futura, plazo distinto a 30 días, u hora del navegador', async () => {
    await assertFails(intentar('pedidosClientes', { extra: { recibidoAt: Timestamp.fromMillis(Date.now() + DIA) } }));
    await assertFails(intentar('pedidosClientes', { extra: { expiraAt: Timestamp.fromMillis(Date.now() + 29 * DIA) } }));
    await assertFails(intentar('pedidosClientes', { extra: { expiraAt: Timestamp.fromMillis(Date.now() + 31 * DIA) } }));
    await assertFails(intentar('pedidosClientes', { extra: { creadoAt: Timestamp.now() } }));
  });
  it('NO a nombre de otro admin, con otro correo o con otro nombre o WhatsApp del yonke', async () => {
    await assertFails(intentar('pedidosClientes', { extra: { adminUid: 'otro' } }));
    await assertFails(intentar('pedidosClientes', { extra: { adminEmail: 'otro@prueba.mx' } }));
    await assertFails(intentar('pedidosClientes', { extra: { yonkeNombre: 'Otro' } }));
    await assertFails(intentar('pedidosClientes', { extra: { yonkeWhatsapp: '6649999999' } }));
  });
  it('nadie más la crea: ni el yonke, ni alguien sin sesión', async () => {
    await assertFails(intentar('pedidosClientes', { uid: 'o1' }));
    await assertFails(setDoc(doc(env.unauthenticatedContext().firestore(), 'evidenciasSugerir', 'X'), { mensaje: 'x' }));
  });
});

describe('evidencia de Sugerir yonke: lectura, conservación y borrado', () => {
  const ref = (uid, id = 'E1') => doc(como(uid), 'evidenciasSugerir', id);
  const conservar = (uid, extra = {}) => updateDoc(ref(uid), {
    expiraAt: deleteField(), conservadaAt: serverTimestamp(), conservadaPorUid: uid, motivoConservacion: 'El yonke reclamó', ...extra,
  });
  beforeEach(() => intentar('pedidosClientes'));

  it('solo el admin la lee', async () => {
    await assertSucceeds(getDoc(ref('adm')));
    await assertFails(getDoc(ref('o1')));
    await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), 'evidenciasSugerir', 'E1')));
  });
  it('nadie cambia el mensaje, ni el admin', async () => {
    await assertFails(updateDoc(ref('adm'), { mensaje: 'otro' }));
    await assertFails(conservar('adm', { mensaje: 'otro' }));
  });
  it('sigue ahí aunque se quite la respuesta o se borre el pedido', async () => {
    await assertSucceeds(deleteDoc(doc(como('adm'), 'pedidosClientes', 'P1', 'respuestas', 'Y1')));
    await assertSucceeds(getDoc(ref('adm')));
  });
  it('dentro de los 30 días no se borra a mano', async () => {
    await assertFails(deleteDoc(ref('adm')));
    await assertFails(deleteDoc(ref('o1')));
  });
  it('el admin la conserva por reclamación, con motivo; el yonke no', async () => {
    await assertFails(conservar('o1'));
    await assertFails(conservar('adm', { motivoConservacion: '' }));
    await assertFails(conservar('adm', { conservadaPorUid: 'otro' }));
    await assertFails(conservar('adm', { conservadaAt: Timestamp.now() }));
    await assertSucceeds(conservar('adm'));
  });
  it('conservada: se borra al atender la reclamación y no se vuelve a cambiar', async () => {
    await assertSucceeds(conservar('adm'));
    await assertFails(conservar('adm', { motivoConservacion: 'Otro motivo' }));
    await assertFails(deleteDoc(ref('o1')));
    await assertSucceeds(deleteDoc(ref('adm')));
  });
  it('vencida: ya no se conserva', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await updateDoc(doc(ctx.firestore(), 'evidenciasSugerir', 'E1'), { expiraAt: Timestamp.fromMillis(Date.now() - 1000) });
    });
    await assertFails(conservar('adm'));
  });
});
