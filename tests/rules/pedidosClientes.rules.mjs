// Pruebas de reglas de Firestore para el pedido de pieza de clientes sin cuenta (pedidosClientes).
// Corren contra el emulador con el archivo real ../../firestore.rules.
// Comando (desde la raíz del repo):  npm run test:rules
import { describe, it, before, after, beforeEach } from 'node:test';
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import {
  Timestamp, collection, deleteDoc, doc, getDoc, getDocs, orderBy, query, serverTimestamp, setDoc, updateDoc, where, writeBatch,
} from 'firebase/firestore';

const reglas = readFileSync(new URL('../../firestore.rules', import.meta.url), 'utf8');
let env;

const anonimo = () => env.unauthenticatedContext().firestore();
const como = (uid) => env.authenticatedContext(uid).firestore();
const DIA = 24 * 60 * 60 * 1000;
const en5Dias = () => Timestamp.fromMillis(Date.now() + 5 * DIA);
const HASH = 'a'.repeat(64);

// Admin, usuario de servicio, tres yonkes (BC activo, Sonora activo, BC inactivo), un taller,
// y tres pedidos de BC: abierto, abierto, vencido.
async function sembrar({ config = { habilitado: true } } = {}) {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    if (config) await setDoc(doc(db, 'config', 'pedidosClientes'), config);
    await setDoc(doc(db, 'usuarios', 'adm'), { rol: 'admin', email: 'admin@prueba.mx' });
    await setDoc(doc(db, 'usuarios', 'svc'), { rol: 'servicio' });
    await setDoc(doc(db, 'yonkes', 'Y1'), { nombre: 'Yonke BC', whatsapp: '6641111111', estado: 'baja-california', activo: true, ownerUid: 'o1' });
    await setDoc(doc(db, 'usuarios', 'o1'), { rol: 'yonke', yonkeId: 'Y1', email: 'o1@prueba.mx', fechaRegistro: new Date() });
    await setDoc(doc(db, 'yonkes', 'Y2'), { nombre: 'Yonke Sonora', whatsapp: '6622222222', estado: 'sonora', activo: true, ownerUid: 'o2' });
    await setDoc(doc(db, 'usuarios', 'o2'), { rol: 'yonke', yonkeId: 'Y2', email: 'o2@prueba.mx', fechaRegistro: new Date() });
    await setDoc(doc(db, 'yonkes', 'Y3'), { nombre: 'Yonke BC inactivo', whatsapp: '6643333333', estado: 'baja-california', activo: false, ownerUid: 'o3' });
    await setDoc(doc(db, 'usuarios', 'o3'), { rol: 'yonke', yonkeId: 'Y3', email: 'o3@prueba.mx', fechaRegistro: new Date() });
    await setDoc(doc(db, 'usuarios', 't1'), { rol: 'taller', tallerId: 'T1', email: 't1@prueba.mx', fechaRegistro: new Date() });
    for (const [id, expiraAt] of [['P1', en5Dias()], ['P2', en5Dias()], ['PV', Timestamp.fromMillis(Date.now() - DIA)]]) {
      await setDoc(doc(db, 'pedidosClientes', id), {
        vehiculo: { marca: 'Nissan', modelo: 'Sentra', anio: 2005 }, pieza: 'Alternador', estado: 'baja-california',
        estadoPedido: 'abierta', creadoAt: Timestamp.now(), expiraAt,
      });
      await setDoc(doc(db, 'pedidosClientes', id, 'privado', 'contacto'), { clienteWhatsapp: '6649998877', codigoHash: HASH, expiraAt });
    }
  });
}

before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-pedidos-clientes',
    firestore: { rules: reglas, host: '127.0.0.1', port: 8181 },
  });
});
after(async () => { await env.cleanup(); });
beforeEach(() => sembrar());

// Igual que crearPedido() en src/app/lib/pedidosClientes/servicio.js.
function crearComo(db, { pedido = {}, privado = {} } = {}) {
  const ref = doc(collection(db, 'pedidosClientes'));
  const expiraAt = en5Dias();
  const lote = writeBatch(db);
  lote.set(ref, {
    vehiculo: { marca: 'Nissan', modelo: 'Sentra', anio: 2005 }, pieza: 'Alternador', estado: 'baja-california',
    estadoPedido: 'abierta', creadoAt: serverTimestamp(), expiraAt, ...pedido,
  });
  lote.set(doc(db, 'pedidosClientes', ref.id, 'privado', 'contacto'), { clienteWhatsapp: '6641234567', codigoHash: HASH, expiraAt, ...privado });
  return lote.commit();
}

// Igual que responderPedido() en src/app/panel/pedidosClientesDatos.js.
async function responderComo(uid, yonkeId, pedidoId, extra = {}) {
  const db = como(uid);
  const yonke = { Y1: ['Yonke BC', '6641111111'], Y2: ['Yonke Sonora', '6622222222'], Y3: ['Yonke BC inactivo', '6643333333'] }[yonkeId];
  let padre;
  await env.withSecurityRulesDisabled(async (ctx) => { padre = (await getDoc(doc(ctx.firestore(), 'pedidosClientes', pedidoId))).data(); });
  const cuerpo = {
    yonkeId, yonkeNombre: yonke[0], whatsapp: yonke[1], tieneLaPieza: true, precio: 1500, nota: 'Original',
    creadoAt: serverTimestamp(), expiraAt: padre.expiraAt, ...extra,
  };
  // extra con { campo: undefined } quita ese campo (Firestore no acepta undefined).
  for (const k of Object.keys(cuerpo)) if (cuerpo[k] === undefined) delete cuerpo[k];
  return setDoc(doc(db, 'pedidosClientes', pedidoId, 'respuestas', yonkeId), cuerpo);
}

const consultaPanel = (db, estado = 'baja-california') => getDocs(query(
  collection(db, 'pedidosClientes'), where('estado', '==', estado), where('estadoPedido', '==', 'abierta'), orderBy('creadoAt', 'desc'),
));

describe('crear pedidos (solo el usuario de servicio)', () => {
  it('el servicio crea pedido + privado/contacto en un lote', async () => {
    await assertSucceeds(crearComo(como('svc')));
  });
  it('con la bandera apagada o sin config/pedidosClientes, ni el servicio puede crear', async () => {
    await sembrar({ config: { habilitado: false } });
    await assertFails(crearComo(como('svc')));
    await sembrar({ config: null });
    await assertFails(crearComo(como('svc')));
  });
  it('nadie más crea pedidos: sin cuenta, yonke, taller ni admin', async () => {
    for (const db of [anonimo(), como('o1'), como('t1'), como('adm')]) await assertFails(crearComo(db));
  });
  it('rechaza el WhatsApp dentro del pedido, otro estado del pedido o una vigencia distinta de 5 días', async () => {
    await assertFails(crearComo(como('svc'), { pedido: { whatsapp: '6641234567' } }));
    await assertFails(crearComo(como('svc'), { pedido: { nota: 'hola' } }));
    await assertFails(crearComo(como('svc'), { pedido: { estadoPedido: 'cerrada' } }));
    await assertFails(crearComo(como('svc'), { pedido: { expiraAt: Timestamp.fromMillis(Date.now() + 10 * DIA) } }));
    await assertFails(crearComo(como('svc'), { pedido: { pieza: '' } }));
  });
  it('privado/contacto exige WhatsApp de 10 dígitos y un hash SHA-256, nunca el código en claro', async () => {
    await assertFails(crearComo(como('svc'), { privado: { clienteWhatsapp: '664 123 4567' } }));
    await assertFails(crearComo(como('svc'), { privado: { codigoHash: 'codigo-en-claro' } }));
    await assertFails(crearComo(como('svc'), { privado: { codigo: 'x' } }));
  });
  it('nadie se puede dar de alta a sí mismo como usuario de servicio', async () => {
    await assertFails(setDoc(doc(como('nuevo'), 'usuarios', 'nuevo'), { rol: 'servicio' }));
  });
});

describe('leer pedidos', () => {
  it('un yonke activo del estado lee el pedido y la consulta de su panel', async () => {
    await assertSucceeds(getDoc(doc(como('o1'), 'pedidosClientes', 'P1')));
    await assertSucceeds(consultaPanel(como('o1')));
  });
  it('un yonke de otro estado, uno inactivo, un taller o alguien sin cuenta no lo leen', async () => {
    await assertFails(getDoc(doc(como('o2'), 'pedidosClientes', 'P1')));
    await assertFails(consultaPanel(como('o2')));
    await assertFails(getDoc(doc(como('o3'), 'pedidosClientes', 'P1')));
    await assertFails(getDoc(doc(como('t1'), 'pedidosClientes', 'P1')));
    await assertFails(getDoc(doc(anonimo(), 'pedidosClientes', 'P1')));
    await assertFails(consultaPanel(anonimo()));
  });
  it('el servicio y el admin leen el pedido', async () => {
    await assertSucceeds(getDoc(doc(como('svc'), 'pedidosClientes', 'P1')));
    await assertSucceeds(getDoc(doc(como('adm'), 'pedidosClientes', 'P1')));
  });
});

describe('WhatsApp del cliente (privado/contacto)', () => {
  it('NINGÚN yonke lo lee: ni el del estado, ni el que ya respondió, ni uno de otro estado', async () => {
    await assertSucceeds(responderComo('o1', 'Y1', 'P1'));
    for (const uid of ['o1', 'o2', 'o3']) {
      await assertFails(getDoc(doc(como(uid), 'pedidosClientes', 'P1', 'privado', 'contacto')));
      await assertFails(getDocs(collection(como(uid), 'pedidosClientes', 'P1', 'privado')));
    }
  });
  it('tampoco un taller ni alguien sin cuenta', async () => {
    await assertFails(getDoc(doc(como('t1'), 'pedidosClientes', 'P1', 'privado', 'contacto')));
    await assertFails(getDoc(doc(anonimo(), 'pedidosClientes', 'P1', 'privado', 'contacto')));
  });
  it('solo el admin y el servicio lo leen; nadie lo edita', async () => {
    await assertSucceeds(getDoc(doc(como('adm'), 'pedidosClientes', 'P1', 'privado', 'contacto')));
    await assertSucceeds(getDoc(doc(como('svc'), 'pedidosClientes', 'P1', 'privado', 'contacto')));
    await assertFails(updateDoc(doc(como('svc'), 'pedidosClientes', 'P1', 'privado', 'contacto'), { clienteWhatsapp: '6640000000' }));
    await assertFails(updateDoc(doc(como('adm'), 'pedidosClientes', 'P1', 'privado', 'contacto'), { clienteWhatsapp: '6640000000' }));
  });
  it('un yonke no puede crear un privado/contacto propio', async () => {
    await assertFails(setDoc(doc(como('o1'), 'pedidosClientes', 'P1', 'privado', 'otro'), { clienteWhatsapp: '6641234567', codigoHash: HASH, expiraAt: en5Dias() }));
  });
});

describe('respuestas de los yonkes', () => {
  it('un yonke activo del estado responde "La tengo" con precio, una sola vez', async () => {
    await assertSucceeds(responderComo('o1', 'Y1', 'P1'));
    await assertFails(responderComo('o1', 'Y1', 'P1', { precio: 100 }));
  });
  it('responde "No la tengo" sin precio; "La tengo" sin precio no se acepta', async () => {
    await assertFails(responderComo('o1', 'Y1', 'P2', { tieneLaPieza: true, precio: undefined }));
    await assertFails(responderComo('o1', 'Y1', 'P2', { tieneLaPieza: false, precio: 100 }));
    await assertSucceeds(responderComo('o1', 'Y1', 'P2', { tieneLaPieza: false, precio: undefined, nota: '' }));
  });
  it('no responden: yonke de otro estado, inactivo, a nombre de otro yonke o con datos que no son los suyos', async () => {
    await assertFails(responderComo('o2', 'Y2', 'P1'));
    await assertFails(responderComo('o3', 'Y3', 'P1'));
    await assertFails(responderComo('o1', 'Y2', 'P1'));
    await assertFails(responderComo('o1', 'Y1', 'P1', { whatsapp: '6640000000' }));
    await assertFails(responderComo('o1', 'Y1', 'P1', { yonkeNombre: 'Otro nombre' }));
    await assertFails(responderComo('o1', 'Y1', 'P1', { precio: 0 }));
    await assertFails(responderComo('o1', 'Y1', 'P1', { nota: 'x'.repeat(201) }));
  });
  it('no se responde un pedido vencido, cancelado o con la bandera apagada', async () => {
    await assertFails(responderComo('o1', 'Y1', 'PV'));
    await env.withSecurityRulesDisabled(async (ctx) => updateDoc(doc(ctx.firestore(), 'pedidosClientes', 'P2'), { estadoPedido: 'cancelada' }));
    await assertFails(responderComo('o1', 'Y1', 'P2'));
    await env.withSecurityRulesDisabled(async (ctx) => setDoc(doc(ctx.firestore(), 'config', 'pedidosClientes'), { habilitado: false }));
    await assertFails(responderComo('o1', 'Y1', 'P1'));
  });
  it('cada yonke lee solo su respuesta; el servicio las lee todas para el cliente', async () => {
    await assertSucceeds(responderComo('o1', 'Y1', 'P1'));
    await assertSucceeds(getDoc(doc(como('o1'), 'pedidosClientes', 'P1', 'respuestas', 'Y1')));
    await assertFails(getDoc(doc(como('o2'), 'pedidosClientes', 'P1', 'respuestas', 'Y1')));
    await assertFails(getDocs(collection(como('o1'), 'pedidosClientes', 'P1', 'respuestas')));
    await assertFails(getDoc(doc(anonimo(), 'pedidosClientes', 'P1', 'respuestas', 'Y1')));
    await assertSucceeds(getDocs(collection(como('svc'), 'pedidosClientes', 'P1', 'respuestas')));
  });
});

describe('cambiar o borrar pedidos', () => {
  it('el admin puede cancelar un pedido (spam) y borrarlo; nadie más lo cambia', async () => {
    await assertFails(updateDoc(doc(como('o1'), 'pedidosClientes', 'P1'), { estadoPedido: 'cancelada' }));
    await assertFails(updateDoc(doc(como('svc'), 'pedidosClientes', 'P1'), { estadoPedido: 'cancelada' }));
    await assertFails(updateDoc(doc(como('adm'), 'pedidosClientes', 'P1'), { pieza: 'Otra' }));
    await assertSucceeds(updateDoc(doc(como('adm'), 'pedidosClientes', 'P1'), { estadoPedido: 'cancelada' }));
    await assertFails(deleteDoc(doc(como('svc'), 'pedidosClientes', 'P1')));
    await assertSucceeds(deleteDoc(doc(como('adm'), 'pedidosClientes', 'P1')));
  });
});

describe('contadores de límite (pedidosClientesLimite)', () => {
  const contador = (count = 1) => ({ count, actualizado: new Date(), expiraEn: en5Dias() });
  it('solo el servicio los lee y escribe', async () => {
    const ref = (db) => doc(db, 'pedidosClientesLimite', 'wa_abc_1');
    await assertSucceeds(setDoc(ref(como('svc')), contador(1)));
    await assertSucceeds(setDoc(ref(como('svc')), contador(2)));
    await assertSucceeds(getDoc(ref(como('svc'))));
    for (const db of [anonimo(), como('o1'), como('adm')]) {
      await assertFails(getDoc(ref(db)));
      await assertFails(setDoc(ref(db), contador(1)));
    }
  });
  it('no acepta campos de más', async () => {
    await assertFails(setDoc(doc(como('svc'), 'pedidosClientesLimite', 'x'), { ...contador(1), ip: '1.2.3.4' }));
  });
});
