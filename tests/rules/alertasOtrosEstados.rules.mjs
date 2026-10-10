// Pruebas de reglas: alertas de búsqueda (pedidosClientes) que yonkes de OTROS estados pueden ver y
// responder cuando el cliente lo aceptó (aceptaOtrosEstados), la segunda bandera
// config/pedidosClientes.otrosEstados está encendida y el yonke es activo, Verificado, con envíos
// nacionales y con su interruptor verAlertasOtrosEstados encendido.
// Comando (desde la raíz del repo):  npm run test:rules
import { describe, it, before, after, beforeEach } from 'node:test';
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import {
  Timestamp, collection, doc, getDoc, getDocs, limit, orderBy, query, serverTimestamp, setDoc, updateDoc, where, writeBatch,
} from 'firebase/firestore';

const reglas = readFileSync(new URL('../../firestore.rules', import.meta.url), 'utf8');
let env;

const como = (uid) => env.authenticatedContext(uid).firestore();
const DIA = 24 * 60 * 60 * 1000;
const en5Dias = () => Timestamp.fromMillis(Date.now() + 5 * DIA);
const HASH = 'a'.repeat(64);

// Yonke de Jalisco que cumple todo; los demás fallan en UNA sola cosa.
const JALISCO_OK = { estado: 'jalisco', activo: true, verificado: true, enviosNacionales: true, verAlertasOtrosEstados: true };
const YONKES = {
  YB: { nombre: 'Yonke BC', whatsapp: '6641111111', estado: 'baja-california', activo: true },
  YJ: { nombre: 'Yonke Jalisco', whatsapp: '3331111111', ...JALISCO_OK },
  YS: { nombre: 'Yonke sin interruptor', whatsapp: '3332222222', ...JALISCO_OK, verAlertasOtrosEstados: false },
  YE: { nombre: 'Yonke sin envíos', whatsapp: '3333333333', ...JALISCO_OK, enviosNacionales: false },
  YV: { nombre: 'Yonke sin verificar', whatsapp: '3334444444', ...JALISCO_OK, verificado: false },
  YI: { nombre: 'Yonke inactivo', whatsapp: '3335555555', ...JALISCO_OK, activo: false },
};
const uid = (yonkeId) => `o_${yonkeId}`;

// Alertas de Baja California: PA acepta otros estados, PN no, PX es de antes (sin el campo), PC
// acepta pero está cerrada.
async function sembrar({ config = { habilitado: true, otrosEstados: true } } = {}) {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'config', 'pedidosClientes'), config);
    await setDoc(doc(db, 'usuarios', 'svc'), { rol: 'servicio' });
    for (const [id, y] of Object.entries(YONKES)) {
      await setDoc(doc(db, 'yonkes', id), { ...y, ownerUid: uid(id) });
      await setDoc(doc(db, 'usuarios', uid(id)), { rol: 'yonke', yonkeId: id, email: `${id}@prueba.mx`, fechaRegistro: new Date() });
    }
    const base = { vehiculo: { marca: 'Nissan', modelo: 'Sentra', anio: 2005 }, pieza: 'Alternador', estado: 'baja-california', creadoAt: Timestamp.now(), expiraAt: en5Dias() };
    const alertas = {
      PA: { ...base, estadoPedido: 'abierta', aceptaOtrosEstados: true },
      PN: { ...base, estadoPedido: 'abierta', aceptaOtrosEstados: false },
      PX: { ...base, estadoPedido: 'abierta' },
      PC: { ...base, estadoPedido: 'cerrada', aceptaOtrosEstados: true },
    };
    for (const [id, a] of Object.entries(alertas)) {
      await setDoc(doc(db, 'pedidosClientes', id), a);
      await setDoc(doc(db, 'pedidosClientes', id, 'privado', 'contacto'), { clienteWhatsapp: '6649998877', codigoHash: HASH, expiraAt: a.expiraAt });
    }
  });
}

before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-alertas-otros-estados',
    firestore: { rules: reglas, host: '127.0.0.1', port: 8181 },
  });
});
after(async () => { await env.cleanup(); });
beforeEach(() => sembrar());

// Igual que crearPedido() en src/app/lib/pedidosClientes/servicio.js.
function crearComoServicio(extra = {}) {
  const db = como('svc');
  const ref = doc(collection(db, 'pedidosClientes'));
  const expiraAt = en5Dias();
  const lote = writeBatch(db);
  lote.set(ref, {
    vehiculo: { marca: 'Nissan', modelo: 'Sentra', anio: 2005 }, pieza: 'Alternador', estado: 'baja-california',
    estadoPedido: 'abierta', creadoAt: serverTimestamp(), expiraAt, ...extra,
  });
  lote.set(doc(db, 'pedidosClientes', ref.id, 'privado', 'contacto'), { clienteWhatsapp: '6641234567', codigoHash: HASH, expiraAt });
  return lote.commit();
}

// Igual que escucharPedidosClientesOtrosEstados() en src/app/panel/pedidosClientesDatos.js.
const consultaOtrosEstados = (db) => query(
  collection(db, 'pedidosClientes'),
  where('aceptaOtrosEstados', '==', true), where('estadoPedido', '==', 'abierta'), orderBy('creadoAt', 'desc'), limit(50),
);

// Igual que responderPedido() en src/app/panel/pedidosClientesDatos.js.
async function responderComo(yonkeId, pedidoId) {
  let padre;
  await env.withSecurityRulesDisabled(async (ctx) => { padre = (await getDoc(doc(ctx.firestore(), 'pedidosClientes', pedidoId))).data(); });
  return setDoc(doc(como(uid(yonkeId)), 'pedidosClientes', pedidoId, 'respuestas', yonkeId), {
    yonkeId, yonkeNombre: YONKES[yonkeId].nombre, whatsapp: YONKES[yonkeId].whatsapp, tieneLaPieza: true, precio: 1500, nota: 'Envío a todo México',
    creadoAt: serverTimestamp(), expiraAt: padre.expiraAt,
  });
}

describe('crear alertas con aceptaOtrosEstados', () => {
  it('true o false: se permite; sin el campo (como las de antes): se permite', async () => {
    await assertSucceeds(crearComoServicio({ aceptaOtrosEstados: true }));
    await assertSucceeds(crearComoServicio({ aceptaOtrosEstados: false }));
    await assertSucceeds(crearComoServicio());
  });
  it('con algo que no sea true/false se rechaza', async () => {
    await assertFails(crearComoServicio({ aceptaOtrosEstados: 'true' }));
    await assertFails(crearComoServicio({ aceptaOtrosEstados: 1 }));
  });
  it('con la segunda bandera apagada: true se rechaza; false o sin campo, igual que hoy', async () => {
    await sembrar({ config: { habilitado: true } });
    await assertFails(crearComoServicio({ aceptaOtrosEstados: true }));
    await assertSucceeds(crearComoServicio({ aceptaOtrosEstados: false }));
    await assertSucceeds(crearComoServicio());
  });
});

describe('yonke de otro estado que cumple todo (activo, Verificado, envíos nacionales, interruptor encendido)', () => {
  it('lee la alerta que lo acepta y hace la consulta de otros estados', async () => {
    const db = como(uid('YJ'));
    await assertSucceeds(getDoc(doc(db, 'pedidosClientes', 'PA')));
    const snap = await assertSucceeds(getDocs(consultaOtrosEstados(db)));
    if (snap.docs.map((d) => d.id).join() !== 'PA') throw new Error(`esperaba solo PA, llegó ${snap.docs.map((d) => d.id)}`);
  });
  it('NO lee alertas que no lo aceptan, de antes (sin el campo), ni cerradas', async () => {
    const db = como(uid('YJ'));
    await assertFails(getDoc(doc(db, 'pedidosClientes', 'PN')));
    await assertFails(getDoc(doc(db, 'pedidosClientes', 'PX')));
    await assertFails(getDoc(doc(db, 'pedidosClientes', 'PC')));
  });
  it('NO puede consultar sin el filtro aceptaOtrosEstados == true', async () => {
    const db = como(uid('YJ'));
    await assertFails(getDocs(query(collection(db, 'pedidosClientes'), where('estadoPedido', '==', 'abierta'))));
    await assertFails(getDocs(query(collection(db, 'pedidosClientes'), where('estado', '==', 'baja-california'), where('estadoPedido', '==', 'abierta'))));
  });
  it('NUNCA lee el WhatsApp del cliente (privado/contacto)', async () => {
    await assertFails(getDoc(doc(como(uid('YJ')), 'pedidosClientes', 'PA', 'privado', 'contacto')));
  });
  it('responde una vez la alerta que lo acepta; no las demás', async () => {
    await assertSucceeds(responderComo('YJ', 'PA'));
    await assertFails(responderComo('YJ', 'PA')); // segunda vez: ya existe
    await assertFails(responderComo('YJ', 'PN'));
    await assertFails(responderComo('YJ', 'PX'));
    await assertFails(responderComo('YJ', 'PC'));
  });
});

describe('si le falta UNA condición, no ve ni responde nada de otros estados', () => {
  for (const [id, motivo] of [['YS', 'interruptor apagado'], ['YE', 'sin envíos nacionales'], ['YV', 'sin Verificado'], ['YI', 'inactivo']]) {
    it(motivo, async () => {
      const db = como(uid(id));
      await assertFails(getDoc(doc(db, 'pedidosClientes', 'PA')));
      await assertFails(getDocs(consultaOtrosEstados(db)));
      await assertFails(responderComo(id, 'PA'));
    });
  }
  it('segunda bandera apagada: ni el yonke que cumple todo', async () => {
    await sembrar({ config: { habilitado: true, otrosEstados: false } });
    const db = como(uid('YJ'));
    await assertFails(getDoc(doc(db, 'pedidosClientes', 'PA')));
    await assertFails(getDocs(consultaOtrosEstados(db)));
    await assertFails(responderComo('YJ', 'PA'));
  });
});

describe('yonke del mismo estado: igual que hoy', () => {
  it('lee y responde las alertas de su estado, acepten o no otros estados', async () => {
    const db = como(uid('YB'));
    for (const id of ['PA', 'PN', 'PX']) await assertSucceeds(getDoc(doc(db, 'pedidosClientes', id)));
    await assertSucceeds(getDocs(query(collection(db, 'pedidosClientes'), where('estado', '==', 'baja-california'), where('estadoPedido', '==', 'abierta'))));
    await assertSucceeds(responderComo('YB', 'PX'));
    await assertFails(getDoc(doc(db, 'pedidosClientes', 'PA', 'privado', 'contacto')));
  });
});

describe('interruptor en el perfil del yonke (verAlertasOtrosEstados)', () => {
  it('el dueño lo enciende y lo apaga (solo true/false)', async () => {
    const ref = doc(como(uid('YS')), 'yonkes', 'YS');
    await assertSucceeds(updateDoc(ref, { verAlertasOtrosEstados: true }));
    await assertSucceeds(updateDoc(ref, { verAlertasOtrosEstados: false }));
    await assertFails(updateDoc(ref, { verAlertasOtrosEstados: 'sí' }));
  });
  it('no puede tocar el de otro yonke', async () => {
    await assertFails(updateDoc(doc(como(uid('YJ')), 'yonkes', 'YS'), { verAlertasOtrosEstados: true }));
  });
  it('sigue sin poder darse envíos nacionales ni Verificado', async () => {
    const ref = doc(como(uid('YE')), 'yonkes', 'YE');
    await assertFails(updateDoc(ref, { enviosNacionales: true }));
    await assertFails(updateDoc(doc(como(uid('YV')), 'yonkes', 'YV'), { verificado: true }));
  });
});
