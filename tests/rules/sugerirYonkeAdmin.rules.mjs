// Pruebas de reglas: "Sugerir yonke" del admin. El yonke le confirmó por fuera que TIENE la pieza y
// el admin registra la respuesta en su nombre, en pedidos de talleres (solicitudesPiezas) y de
// clientes (pedidosClientes). Banderas: config/solicitudesPiezas.sugerirYonkeAdmin y
// config/pedidosClientes.sugerirYonkeAdmin (solo true exacto). Sin `dia`, sin tope diario y sin
// tocar respuestasDiarias. El yonke y el taller siguen igual que antes.
// Comando (desde la raíz del repo):  npm run test:rules
import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { Timestamp, deleteDoc, doc, getDoc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';

const reglas = readFileSync(new URL('../../firestore.rules', import.meta.url), 'utf8');
let env;
const DIA = 24 * 60 * 60 * 1000;
const en5Dias = () => Timestamp.fromMillis(Date.now() + 5 * DIA);
const vencido = () => Timestamp.fromMillis(Date.now() - DIA);

const YONKES = {
  Y1: { nombre: 'Yonke BC', whatsapp: '6641111111', estado: 'baja-california', activo: true, ownerUid: 'o1' },
  Y2: { nombre: 'Yonke Sonora', whatsapp: '6622222222', estado: 'sonora', activo: true, ownerUid: 'o2' },
  Y3: { nombre: 'Yonke BC inactivo', whatsapp: '6643333333', estado: 'baja-california', activo: false, ownerUid: 'o3' },
};
const vehiculo = { marca: 'Nissan', modelo: 'Sentra', anio: 2005 };

// S1: pedido de taller abierto (BC). P1: pedido de cliente abierto (BC); P2: igual, pero acepta
// otros estados; PV: vencido (aún abierto).
async function sembrar({ configTalleres = { habilitado: true, sugerirYonkeAdmin: true }, configClientes = { habilitado: true, sugerirYonkeAdmin: true } } = {}) {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    if (configTalleres) await setDoc(doc(db, 'config', 'solicitudesPiezas'), configTalleres);
    if (configClientes) await setDoc(doc(db, 'config', 'pedidosClientes'), configClientes);
    await setDoc(doc(db, 'usuarios', 'adm'), { rol: 'admin', email: 'admin@prueba.mx' });
    await setDoc(doc(db, 'usuarios', 'svc'), { rol: 'servicio' });
    await setDoc(doc(db, 'usuarios', 't1'), { rol: 'taller', tallerId: 'T1', email: 't1@prueba.mx' });
    await setDoc(doc(db, 'talleres', 'T1'), {
      nombre: 'Taller Uno', whatsapp: '6641110000', ciudad: 'Tijuana', logoUrl: '', ownerUid: 't1', activo: true,
      creadoAt: new Date(), aceptacionVersion: 'v1', avisoPrivacidad: { modo: 'generado', versionPlantilla: 'aviso-1', fecha: new Date() },
    });
    for (const [id, y] of Object.entries(YONKES)) {
      await setDoc(doc(db, 'yonkes', id), y);
      await setDoc(doc(db, 'usuarios', y.ownerUid), { rol: 'yonke', yonkeId: id, email: `${y.ownerUid}@prueba.mx` });
    }
    await setDoc(doc(db, 'solicitudesPiezas', 'S1'), {
      tallerId: 'T1', tallerNombre: 'Taller Uno', vehiculo, pieza: 'Defensa delantera', nota: '',
      estado: 'baja-california', estadoSolicitud: 'abierta', yonkeElegido: null, creadoAt: Timestamp.now(), expiraAt: en5Dias(),
    });
    for (const [id, expiraAt, extra] of [['P1', en5Dias(), {}], ['P2', en5Dias(), { aceptaOtrosEstados: true }], ['PV', vencido(), {}]]) {
      await setDoc(doc(db, 'pedidosClientes', id), {
        vehiculo, pieza: 'Alternador', estado: 'baja-california', estadoPedido: 'abierta', creadoAt: Timestamp.now(), expiraAt, ...extra,
      });
    }
  });
}

const como = (uid) => env.authenticatedContext(uid).firestore();

async function leer(ruta) {
  let datos;
  await env.withSecurityRulesDisabled(async (ctx) => { const s = await getDoc(doc(ctx.firestore(), ...ruta)); datos = s.exists() ? s.data() : null; });
  return datos;
}
async function cambiar(ruta, cambios) {
  await env.withSecurityRulesDisabled(async (ctx) => { await updateDoc(doc(ctx.firestore(), ...ruta), cambios); });
}

// Respuesta sugerida por el admin (o, con otro uid, el mismo intento hecho por alguien más): siempre
// "precio a tratar", sin precio. extra con { campo: undefined } quita ese campo.
async function sugerir(coleccion, pedidoId, yonkeId, { uid = 'adm', ...extra } = {}) {
  const padre = await leer([coleccion, pedidoId]);
  const y = YONKES[yonkeId];
  const cuerpo = {
    yonkeId, yonkeNombre: y.nombre, whatsapp: y.whatsapp, tieneLaPieza: true, precioATratar: true, nota: 'Confirmó por teléfono',
    creadoAt: serverTimestamp(), expiraAt: padre.expiraAt, creadoPorAdmin: true, creadoPorAdminUid: uid, ...extra,
  };
  for (const k of Object.keys(cuerpo)) if (cuerpo[k] === undefined) delete cuerpo[k];
  return setDoc(doc(como(uid), coleccion, pedidoId, 'respuestas', yonkeId), cuerpo);
}
const sugerirTaller = (yonkeId, extra) => sugerir('solicitudesPiezas', 'S1', yonkeId, extra);
const sugerirCliente = (pedidoId, yonkeId, extra) => sugerir('pedidosClientes', pedidoId, yonkeId, extra);

before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-sugerir-yonke',
    firestore: { rules: reglas, host: '127.0.0.1', port: 8181 },
  });
});
after(async () => { await env.cleanup(); });
beforeEach(() => sembrar());

describe('sugerir yonke: pedidos de talleres (solicitudesPiezas)', () => {
  it('el admin la registra a nombre de un yonke activo del mismo estado', async () => {
    await assertSucceeds(sugerirTaller('Y1'));
    const r = await leer(['solicitudesPiezas', 'S1', 'respuestas', 'Y1']);
    assert.equal(r.creadoPorAdmin, true);
    assert.equal(r.creadoPorAdminUid, 'adm');
  });

  it('NO con la bandera apagada, sin ella, con "true" de texto o con la función de pedidos apagada', async () => {
    for (const configTalleres of [
      { habilitado: true, sugerirYonkeAdmin: false }, { habilitado: true }, { habilitado: true, sugerirYonkeAdmin: 'true' },
      { habilitado: false, sugerirYonkeAdmin: true }, null,
    ]) {
      await sembrar({ configTalleres });
      await assertFails(sugerirTaller('Y1'));
    }
  });

  it('NO con el pedido cerrado o cancelado', async () => {
    for (const estadoSolicitud of ['cerrada', 'cancelada']) {
      await sembrar();
      await cambiar(['solicitudesPiezas', 'S1'], { estadoSolicitud });
      await assertFails(sugerirTaller('Y1'));
    }
  });

  it('NO con un yonke inactivo, inexistente o de otro estado', async () => {
    await assertFails(sugerirTaller('Y3'));
    await assertFails(sugerirTaller('Y2'));
    await assertFails(setDoc(doc(como('adm'), 'solicitudesPiezas', 'S1', 'respuestas', 'NOEXISTE'), {
      yonkeId: 'NOEXISTE', yonkeNombre: 'Fantasma', whatsapp: '6640000000', tieneLaPieza: true, precioATratar: true, nota: '',
      creadoAt: serverTimestamp(), expiraAt: (await leer(['solicitudesPiezas', 'S1'])).expiraAt, creadoPorAdmin: true, creadoPorAdminUid: 'adm',
    }));
  });

  it('NO con nombre o WhatsApp distintos a los del yonke', async () => {
    await assertFails(sugerirTaller('Y1', { yonkeNombre: 'Otro nombre' }));
    await assertFails(sugerirTaller('Y1', { whatsapp: '6649999999' }));
  });

  it('siempre "precio a tratar": NO con precio (de ningún valor), sin precioATratar o en false, ni si "no la tiene"', async () => {
    for (const precio of [1500, 0, null]) await assertFails(sugerirTaller('Y1', { precio }));
    await assertFails(sugerirTaller('Y1', { precioATratar: undefined }));
    await assertFails(sugerirTaller('Y1', { precioATratar: false }));
    await assertFails(sugerirTaller('Y1', { precioATratar: undefined, precio: 1500 }));
    await assertFails(sugerirTaller('Y1', { tieneLaPieza: false }));
  });

  it('NO sin las marcas del admin, con otro uid, con `dia` ni con otro vencimiento', async () => {
    await assertFails(sugerirTaller('Y1', { creadoPorAdmin: undefined }));
    await assertFails(sugerirTaller('Y1', { creadoPorAdmin: false }));
    await assertFails(sugerirTaller('Y1', { creadoPorAdminUid: undefined }));
    await assertFails(sugerirTaller('Y1', { creadoPorAdminUid: 'otro' }));
    await assertFails(sugerirTaller('Y1', { dia: '20261030' }));
    await assertFails(sugerirTaller('Y1', { expiraAt: Timestamp.fromMillis(Date.now() + 9 * DIA) }));
    await assertFails(sugerirTaller('Y1', { creadoAt: Timestamp.now() }));
  });

  it('NO duplica: si el yonke ya respondió (o ya se sugirió), no se puede volver a escribir', async () => {
    await assertSucceeds(sugerirTaller('Y1'));
    await assertFails(sugerirTaller('Y1', { nota: 'Otra vez' }));
  });

  it('nadie más puede: ni el taller, ni otro yonke, ni el servicio', async () => {
    await assertFails(sugerirTaller('Y1', { uid: 't1' }));
    await assertFails(sugerirTaller('Y1', { uid: 'o2' }));
    await assertFails(sugerirTaller('Y1', { uid: 'svc' }));
  });

  it('el yonke sigue igual: responde con precio y sin las marcas; NO puede mandar creadoPorAdmin ni precioATratar', async () => {
    const delYonke = { uid: 'o1', precio: 1500, precioATratar: undefined, creadoPorAdmin: undefined, creadoPorAdminUid: undefined };
    await assertFails(sugerirTaller('Y1', { ...delYonke, creadoPorAdmin: true, creadoPorAdminUid: 'o1' }));
    await assertFails(sugerirTaller('Y1', { ...delYonke, creadoPorAdmin: true }));
    // Tampoco "precio a tratar": el yonke sigue obligado a poner precio > 0.
    await assertFails(sugerirTaller('Y1', { ...delYonke, precioATratar: true }));
    await assertFails(sugerirTaller('Y1', { ...delYonke, precio: undefined, precioATratar: true }));
    await assertFails(sugerirTaller('Y1', { ...delYonke, precio: undefined }));
    await assertSucceeds(sugerirTaller('Y1', delYonke));
  });

  it('el taller sigue igual: puede elegir al yonke sugerido', async () => {
    await assertSucceeds(sugerirTaller('Y1'));
    await assertSucceeds(updateDoc(doc(como('t1'), 'solicitudesPiezas', 'S1'), { estadoSolicitud: 'cerrada', yonkeElegido: 'Y1' }));
  });
});

describe('sugerir yonke: pedidos de clientes (pedidosClientes)', () => {
  it('el admin la registra a nombre de un yonke activo del mismo estado', async () => {
    await assertSucceeds(sugerirCliente('P1', 'Y1'));
    const r = await leer(['pedidosClientes', 'P1', 'respuestas', 'Y1']);
    assert.equal(r.creadoPorAdmin, true);
    assert.equal(r.creadoPorAdminUid, 'adm');
  });

  it('NO con la bandera apagada, sin ella, con "true" de texto o con la función de pedidos apagada', async () => {
    for (const configClientes of [
      { habilitado: true, sugerirYonkeAdmin: false }, { habilitado: true }, { habilitado: true, sugerirYonkeAdmin: 'true' },
      { habilitado: false, sugerirYonkeAdmin: true }, null,
    ]) {
      await sembrar({ configClientes });
      await assertFails(sugerirCliente('P1', 'Y1'));
    }
  });

  it('NO con el pedido cerrado, cancelado o vencido', async () => {
    await assertFails(sugerirCliente('PV', 'Y1'));
    for (const estadoPedido of ['cerrada', 'cancelada']) {
      await sembrar();
      await cambiar(['pedidosClientes', 'P1'], { estadoPedido });
      await assertFails(sugerirCliente('P1', 'Y1'));
    }
  });

  it('otro estado: solo si el cliente aceptó otros estados', async () => {
    await assertFails(sugerirCliente('P1', 'Y2'));
    await assertSucceeds(sugerirCliente('P2', 'Y2'));
  });

  it('NO con un yonke inactivo (ni aunque el pedido acepte otros estados)', async () => {
    await assertFails(sugerirCliente('P1', 'Y3'));
    await assertFails(sugerirCliente('P2', 'Y3'));
  });

  it('NO con nombre o WhatsApp distintos a los del yonke', async () => {
    await assertFails(sugerirCliente('P1', 'Y1', { yonkeNombre: 'Otro nombre' }));
    await assertFails(sugerirCliente('P1', 'Y1', { whatsapp: '6649999999' }));
  });

  it('siempre "precio a tratar": NO con precio (de ningún valor), sin precioATratar o en false, ni si "no la tiene"', async () => {
    for (const precio of [1500, 0, null]) await assertFails(sugerirCliente('P1', 'Y1', { precio }));
    await assertFails(sugerirCliente('P1', 'Y1', { precioATratar: undefined }));
    await assertFails(sugerirCliente('P1', 'Y1', { precioATratar: false }));
    await assertFails(sugerirCliente('P1', 'Y1', { precioATratar: undefined, precio: 1500 }));
    await assertFails(sugerirCliente('P1', 'Y1', { tieneLaPieza: false }));
  });

  it('NO sin las marcas del admin, con otro uid, con `dia` ni con otro vencimiento', async () => {
    await assertFails(sugerirCliente('P1', 'Y1', { creadoPorAdmin: undefined }));
    await assertFails(sugerirCliente('P1', 'Y1', { creadoPorAdmin: false }));
    await assertFails(sugerirCliente('P1', 'Y1', { creadoPorAdminUid: undefined }));
    await assertFails(sugerirCliente('P1', 'Y1', { creadoPorAdminUid: 'otro' }));
    await assertFails(sugerirCliente('P1', 'Y1', { dia: '20261030' }));
    await assertFails(sugerirCliente('P1', 'Y1', { expiraAt: Timestamp.fromMillis(Date.now() + 9 * DIA) }));
  });

  it('con tope diario encendido: el admin no lo usa ni toca el contador respuestasDiarias del yonke', async () => {
    await sembrar({ configClientes: { habilitado: true, sugerirYonkeAdmin: true, limiteRespuestasDiarias: 1 } });
    await assertSucceeds(sugerirCliente('P1', 'Y1'));
    await assertFails(setDoc(doc(como('adm'), 'yonkes', 'Y1', 'respuestasDiarias', '20261030'), { count: 1 }));
  });

  it('NO duplica: si el yonke ya respondió (o ya se sugirió), no se puede volver a escribir', async () => {
    await assertSucceeds(sugerirCliente('P1', 'Y1'));
    await assertFails(sugerirCliente('P1', 'Y1', { nota: 'Otra vez' }));
  });

  it('nadie más puede: ni el servicio, ni un taller, ni otro yonke', async () => {
    await assertFails(sugerirCliente('P1', 'Y1', { uid: 'svc' }));
    await assertFails(sugerirCliente('P1', 'Y1', { uid: 't1' }));
    await assertFails(sugerirCliente('P2', 'Y1', { uid: 'o2' }));
  });

  it('el yonke sigue igual: responde con precio y sin las marcas; NO puede mandar creadoPorAdmin ni precioATratar', async () => {
    const delYonke = { uid: 'o1', precio: 1500, precioATratar: undefined, creadoPorAdmin: undefined, creadoPorAdminUid: undefined };
    await assertFails(sugerirCliente('P1', 'Y1', { ...delYonke, creadoPorAdmin: true, creadoPorAdminUid: 'o1' }));
    await assertFails(sugerirCliente('P1', 'Y1', { ...delYonke, creadoPorAdmin: true }));
    // Tampoco "precio a tratar": el yonke sigue obligado a poner precio > 0.
    await assertFails(sugerirCliente('P1', 'Y1', { ...delYonke, precioATratar: true }));
    await assertFails(sugerirCliente('P1', 'Y1', { ...delYonke, precio: undefined, precioATratar: true }));
    await assertFails(sugerirCliente('P1', 'Y1', { ...delYonke, precio: undefined }));
    await assertSucceeds(sugerirCliente('P1', 'Y1', delYonke));
  });
});

// "Quitar respuesta" (etapa 2 del admin): la regla de siempre ya deja al admin borrar respuestas
// (allow delete: if esAdmin()). Al quitarla, el yonke puede volver a responder o el admin a sugerirlo.
describe('quitar respuesta: el admin sí; el yonke y el taller no', () => {
  const rutas = [['solicitudesPiezas', 'S1'], ['pedidosClientes', 'P1']];
  const delYonke = { uid: 'o1', precio: 1500, precioATratar: undefined, creadoPorAdmin: undefined, creadoPorAdminUid: undefined };
  const borrarComo = (uid, coleccion, id) => deleteDoc(doc(como(uid), coleccion, id, 'respuestas', 'Y1'));

  it('el admin borra la respuesta del yonke y la sugerida por el admin, en las dos colecciones', async () => {
    for (const [coleccion, id] of rutas) {
      await assertSucceeds(sugerir(coleccion, id, 'Y1', delYonke));
      await assertSucceeds(borrarComo('adm', coleccion, id));
      await assertSucceeds(sugerir(coleccion, id, 'Y1'));
      await assertSucceeds(borrarComo('adm', coleccion, id));
    }
  });

  it('el admin la borra aunque la bandera esté apagada o el pedido ya no esté abierto', async () => {
    await sembrar({ configTalleres: { habilitado: true }, configClientes: { habilitado: true } });
    for (const [coleccion, id] of rutas) {
      await assertSucceeds(sugerir(coleccion, id, 'Y1', delYonke));
      await cambiar([coleccion, id], coleccion === 'pedidosClientes' ? { estadoPedido: 'cerrada' } : { estadoSolicitud: 'cancelada' });
      await assertSucceeds(borrarComo('adm', coleccion, id));
    }
  });

  it('el yonke (ni el suyo), otro yonke, el taller y el servicio NO pueden borrar', async () => {
    for (const [coleccion, id] of rutas) {
      await assertSucceeds(sugerir(coleccion, id, 'Y1', delYonke));
      for (const uid of ['o1', 'o2', 't1', 'svc']) await assertFails(borrarComo(uid, coleccion, id));
    }
  });

  it('después de quitarla, el yonke puede volver a responder y el admin a sugerirlo', async () => {
    for (const [coleccion, id] of rutas) {
      await assertSucceeds(sugerir(coleccion, id, 'Y1'));
      await assertSucceeds(borrarComo('adm', coleccion, id));
      await assertSucceeds(sugerir(coleccion, id, 'Y1', delYonke));
      await assertSucceeds(borrarComo('adm', coleccion, id));
      await assertSucceeds(sugerir(coleccion, id, 'Y1'));
    }
  });
});
