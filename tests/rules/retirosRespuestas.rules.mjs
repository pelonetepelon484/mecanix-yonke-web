// Pruebas de reglas: retirosRespuestas. El admin deja motivo en el mismo lote que quita la respuesta;
// nadie más escribe ni lee (salvo el servidor), nadie lo cambia. El reclamo de número conserva la
// evidencia en ese lote, y un yonke desactivado ya no responde.
// Comando (desde la raíz del repo):  npm run test:rules
import { describe, it, before, after, beforeEach } from 'node:test';
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { Timestamp, collection, deleteDoc, deleteField, doc, getDocs, query, serverTimestamp, setDoc, updateDoc, where, writeBatch } from 'firebase/firestore';

const reglas = readFileSync(new URL('../../firestore.rules', import.meta.url), 'utf8');
const DIA = 24 * 60 * 60 * 1000;
const en = (ms) => Timestamp.fromMillis(Date.now() + ms);
let env;
const como = (uid) => env.authenticatedContext(uid, { email: `${uid}@prueba.mx` }).firestore();
const retiro = (extra = {}) => ({
  coleccion: 'pedidosClientes', pedidoId: 'P1', yonkeId: 'Y1', yonkeNombre: 'Yonke', motivo: 'sinPieza',
  adminUid: 'adm', adminEmail: 'adm@prueba.mx', fecha: serverTimestamp(), expiraAt: en(30 * DIA), ...extra,
});
function quitar(uid, datos = retiro(), { borrar = true, id = 'R1', mas } = {}) {
  const db = como(uid);
  const lote = writeBatch(db);
  if (borrar) lote.delete(doc(db, datos.coleccion, datos.pedidoId, 'respuestas', datos.yonkeId));
  lote.set(doc(db, 'retirosRespuestas', id), datos);
  mas?.(lote, db);
  return lote.commit();
}

before(async () => {
  env = await initializeTestEnvironment({ projectId: 'demo-retiros', firestore: { rules: reglas } });
});
after(async () => { await env.cleanup(); });
beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'usuarios', 'adm'), { rol: 'admin' });
    await setDoc(doc(db, 'usuarios', 'svc'), { rol: 'servicio' });
    await setDoc(doc(db, 'usuarios', 'o1'), { rol: 'yonke', yonkeId: 'Y1' });
    await setDoc(doc(db, 'yonkes', 'Y1'), { nombre: 'Yonke', estado: 'sonora', activo: true, ownerUid: 'o1' });
    await setDoc(doc(db, 'pedidosClientes', 'P1'), { pieza: 'Faro', estado: 'sonora', estadoPedido: 'abierta', expiraAt: en(DIA) });
    await setDoc(doc(db, 'pedidosClientes', 'P1', 'respuestas', 'Y1'), { yonkeId: 'Y1', yonkeNombre: 'Yonke', evidenciaId: 'E1' });
    await setDoc(doc(db, 'solicitudesPiezas', 'S1'), { pieza: 'Faro', estado: 'sonora', estadoSolicitud: 'abierta', expiraAt: en(DIA) });
    await setDoc(doc(db, 'solicitudesPiezas', 'S1', 'respuestas', 'Y1'), { yonkeId: 'Y1', yonkeNombre: 'Yonke' });
    await setDoc(doc(db, 'evidenciasSugerir', 'E1'), { coleccion: 'pedidosClientes', pedidoId: 'P1', yonkeId: 'Y1', expiraAt: en(10 * DIA) });
    await setDoc(doc(db, 'retirosRespuestas', 'VIEJO'), { pedidoId: 'P9', coleccion: 'pedidosClientes' });
  });
});

describe('retirar una respuesta', () => {
  it('el admin quita la respuesta y deja el motivo, en clientes y talleres', async () => {
    await assertSucceeds(quitar('adm'));
    await assertSucceeds(quitar('adm', retiro({ coleccion: 'solicitudesPiezas', pedidoId: 'S1' }), { id: 'R2' }));
  });
  it('rechaza el registro sin quitar de verdad la respuesta, o si esa respuesta no existe', async () => {
    await assertFails(quitar('adm', retiro(), { borrar: false }));
    await assertFails(quitar('adm', retiro({ yonkeId: 'Y9' }), { borrar: false }));
  });
  it('rechaza motivo desconocido, campos de más, otro admin, hora del navegador y plazo distinto', async () => {
    await assertFails(quitar('adm', retiro({ motivo: 'porque si' })));
    await assertFails(quitar('adm', retiro({ extra: 1 })));
    await assertFails(quitar('adm', retiro({ adminUid: 'otro' })));
    await assertFails(quitar('adm', retiro({ adminEmail: 'otro@prueba.mx' })));
    await assertFails(quitar('adm', retiro({ fecha: new Date() })));
    await assertFails(quitar('adm', retiro({ expiraAt: en(DIA) })));
    await assertFails(quitar('adm', retiro({ coleccion: 'yonkes' })));
  });
  it('nadie más lo escribe', async () => {
    await assertFails(quitar('o1'));
    await assertFails(setDoc(doc(env.unauthenticatedContext().firestore(), 'retirosRespuestas', 'R1'), retiro()));
  });
  it('lo leen el admin y el servidor, nadie más', async () => {
    const consulta = (db) => getDocs(query(collection(db, 'retirosRespuestas'), where('pedidoId', '==', 'P9'), where('coleccion', '==', 'pedidosClientes')));
    await assertSucceeds(consulta(como('adm')));
    await assertSucceeds(consulta(como('svc')));
    await assertFails(consulta(como('o1')));
    await assertFails(consulta(env.unauthenticatedContext().firestore()));
  });
  it('nadie lo cambia ni lo borra, ni el admin', async () => {
    await assertFails(updateDoc(doc(como('adm'), 'retirosRespuestas', 'VIEJO'), { motivo: 'otro' }));
    await assertFails(deleteDoc(doc(como('adm'), 'retirosRespuestas', 'VIEJO')));
  });
  it('número ajeno: conserva la evidencia en el mismo lote', async () => {
    await assertSucceeds(quitar('adm', retiro({ motivo: 'numeroAjeno' }), {
      mas: (lote, db) => lote.update(doc(db, 'evidenciasSugerir', 'E1'), {
        expiraAt: deleteField(), conservadaAt: serverTimestamp(), conservadaPorUid: 'adm', motivoConservacion: 'Reclamo de número ajeno: respuesta retirada',
      }),
    }));
  });
});

describe('cuenta desactivada por un reclamo', () => {
  const respuesta = () => ({ yonkeId: 'Y2', yonkeNombre: 'Otro', tieneLaPieza: true, nota: '', whatsapp: '6621112222', creadoAt: serverTimestamp(), expiraAt: en(DIA) });
  it('el admin la desactiva y ya no puede responder', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      await setDoc(doc(db, 'config', 'pedidosClientes'), { habilitado: true });
      await setDoc(doc(db, 'config', 'solicitudesPiezas'), { habilitado: true });
      await setDoc(doc(db, 'usuarios', 'o2'), { rol: 'yonke', yonkeId: 'Y2' });
      await setDoc(doc(db, 'usuarios', 'l2'), { rol: 'yonkeLigero', yonkeId: 'Y3' });
      await setDoc(doc(db, 'yonkes', 'Y2'), { nombre: 'Otro', estado: 'sonora', activo: false, ownerUid: 'o2' });
      await setDoc(doc(db, 'yonkes', 'Y3'), { nombre: 'Ligero', estado: 'sonora', activo: false, ownerUid: 'l2' });
    });
    await assertSucceeds(updateDoc(doc(como('adm'), 'yonkes', 'Y1'), { activo: false }));
    await assertFails(setDoc(doc(como('o2'), 'pedidosClientes', 'P1', 'respuestas', 'Y2'), respuesta()));
    await assertFails(setDoc(doc(como('l2'), 'pedidosClientes', 'P1', 'respuestas', 'Y3'), { ...respuesta(), yonkeId: 'Y3' }));
    await assertFails(setDoc(doc(como('o2'), 'solicitudesPiezas', 'S1', 'respuestas', 'Y2'), respuesta()));
  });
});
