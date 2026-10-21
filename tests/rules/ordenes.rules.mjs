// Pruebas de reglas de Firestore para las órdenes de servicio del taller (etapa 1).
// Estructura: talleres/{id}/ordenes/{folio} con trabajos y piezas DENTRO (máximo 20 de cada uno).
// Bandera: config/ordenes. Términos vigentes: config/cotizaciones.terminosVersion.
// Borrado (expiraAt): sin entregar = guardado + 88 días; al entregar = entrega + garantía + 8 días.
// Corren contra el emulador con el archivo real ../../firestore.rules.
// Comando (desde la raíz del repo):  npm run test:rules
import { describe, it, before, after } from 'node:test';
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { collection, deleteDoc, deleteField, doc, getDoc, getDocs, orderBy, query, serverTimestamp, setDoc, updateDoc, where, writeBatch } from 'firebase/firestore';

const reglas = readFileSync(new URL('../../firestore.rules', import.meta.url), 'utf8');
let env;
const DIA = 86400000;
const ahora = () => Date.now();
const enDias = (n) => new Date(ahora() + n * DIA);
const O = 'O251011-7KQ4';       // sin entregar, de T1
const OE = 'O251011-ENTR';      // entregada hace 5 días con 30 de garantía, de T1
const ON = 'O251011-NUEV';      // folio para crear
const CREADO = new Date(Date.now() - 10 * DIA);
const ENTREGA = new Date(Date.now() - 5 * DIA);
const EXPIRA_ENTREGADA = new Date(ENTREGA.getTime() + 38 * DIA);   // 30 de garantía + 8
const AVISO = 'aviso-orden-0';

const item = (extra = {}) => ({ descripcion: 'Cambio de balatas', cantidad: 1, precioUnitario: 500, ...extra });

// Cuerpo completo como lo arma la app (ordenes/datos.js), para crear.
function orden(extra = {}) {
  return {
    tallerId: 'T1', estado: 'recibido', cliente: {},
    vehiculo: { marca: 'Nissan', modelo: 'Sentra', anio: 2001, kilometraje: 150000 },
    fallaReportada: 'Ruido al frenar', observaciones: 'Golpe en defensa', estadoRecepcion: 'Rayón en puerta', pertenencias: 'Gato y llanta de refacción',
    trabajos: [item()], piezas: [item({ descripcion: 'Balatas delanteras' })],
    totalCentavos: 100000,
    creadoAt: serverTimestamp(), actualizadoAt: serverTimestamp(),
    expiraAt: enDias(88), avisoVersion: AVISO,
    ...extra,
  };
}
// Cuerpo completo para EDITAR la orden sembrada O (sin entregar).
const edicion = (extra = {}) => orden({ creadoAt: CREADO, ...extra });
// Cuerpo completo para EDITAR la orden entregada OE, sin cambiar nada de la entrega.
const edicionEntregada = (extra = {}) => orden({
  creadoAt: CREADO, estado: 'entregado', garantiaDias: 30, fechaEntrega: ENTREGA, expiraAt: EXPIRA_ENTREGADA, ...extra,
});
// Quita llaves con valor undefined (Firestore no las acepta).
const sin = (o, ...llaves) => Object.fromEntries(Object.entries(o).filter(([k]) => !llaves.includes(k)));

function taller(owner, activo, version) {
  return {
    nombre: 'Taller', whatsapp: '6641234567', ciudad: 'Tijuana', logoUrl: '', ownerUid: owner, activo,
    creadoAt: new Date(), aceptacionVersion: version,
    avisoPrivacidad: { modo: 'generado', versionPlantilla: 'aviso-1', fecha: new Date() },
  };
}

async function sembrar({ configOrdenes = { habilitado: true, datosClienteHabilitados: false, avisoOrdenVersion: AVISO }, versionTaller = 'v1' } = {}) {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'config', 'cotizaciones'), { terminosVersion: 'v1', avisoTallerVersion: 'aviso-1', datosClienteHabilitados: true, resumenCambios: 'x' });
    if (configOrdenes) await setDoc(doc(db, 'config', 'ordenes'), configOrdenes);
    await setDoc(doc(db, 'usuarios', 'adm'), { rol: 'admin', email: 'a@x.mx' });
    await setDoc(doc(db, 'usuarios', 'y1'), { rol: 'yonke', yonkeId: 'Y1', email: 'y@x.mx' });
    await setDoc(doc(db, 'talleres', 'T1'), taller('t1', true, versionTaller));
    await setDoc(doc(db, 'usuarios', 't1'), { rol: 'taller', tallerId: 'T1', email: 't1@x.mx' });
    await setDoc(doc(db, 'talleres', 'T2'), taller('t2', true, versionTaller));
    await setDoc(doc(db, 'usuarios', 't2'), { rol: 'taller', tallerId: 'T2', email: 't2@x.mx' });
    await setDoc(doc(db, 'talleres', 'T3'), taller('t3', false, versionTaller));
    await setDoc(doc(db, 'usuarios', 't3'), { rol: 'taller', tallerId: 'T3', email: 't3@x.mx' });
    await setDoc(doc(db, 'talleres', 'T1', 'ordenes', O), { ...orden(), creadoAt: CREADO, actualizadoAt: CREADO, expiraAt: enDias(78) });
    await setDoc(doc(db, 'talleres', 'T1', 'ordenes', OE), {
      ...orden({ estado: 'entregado', garantiaDias: 30, fechaEntrega: ENTREGA }), creadoAt: CREADO, actualizadoAt: ENTREGA, expiraAt: EXPIRA_ENTREGADA,
    });
    await setDoc(doc(db, 'talleres', 'T3', 'ordenes', O), { ...orden({ tallerId: 'T3' }), creadoAt: CREADO, actualizadoAt: CREADO, expiraAt: enDias(78) });
  });
}

const como = (uid) => (uid ? env.authenticatedContext(uid).firestore() : env.unauthenticatedContext().firestore());
const oref = (uid, folio = O, tallerId = 'T1') => doc(como(uid), 'talleres', tallerId, 'ordenes', folio);
async function conConfig(campos) {
  await env.withSecurityRulesDisabled(async (c) => { await updateDoc(doc(c.firestore(), 'config', 'ordenes'), campos); });
}
async function conVersion(v) {
  await env.withSecurityRulesDisabled(async (c) => { await updateDoc(doc(c.firestore(), 'config', 'cotizaciones'), { terminosVersion: v }); });
}
async function sembrarDatoCliente() {
  await env.withSecurityRulesDisabled(async (c) => {
    await updateDoc(doc(c.firestore(), 'talleres', 'T1', 'ordenes', O), { cliente: { nombre: 'Juan', telefono: '6641112233' }, 'vehiculo.placas': 'ABC123' });
  });
}

before(async () => {
  env = await initializeTestEnvironment({ projectId: 'demo-ordenes', firestore: { rules: reglas, host: '127.0.0.1', port: 8181 } });
});
after(async () => { await env.cleanup(); });

describe('crear órdenes', () => {
  it('crea una orden válida sin entregar (borrado a 88 días)', async () => {
    await sembrar();
    await assertSucceeds(setDoc(oref('t1', ON), orden()));
  });
  it('crea una orden sin trabajos ni piezas todavía (recién recibida)', async () => {
    await sembrar();
    await assertSucceeds(setDoc(oref('t1', ON), orden({ trabajos: [], piezas: [], totalCentavos: 0 })));
  });
  it('20 trabajos y 20 piezas pasan; 21 no', async () => {
    await sembrar();
    const veinte = Array.from({ length: 20 }, () => item());
    await assertSucceeds(setDoc(oref('t1', ON), orden({ trabajos: veinte, piezas: veinte })));
    await assertFails(setDoc(oref('t1', 'O251011-OTRA'), orden({ trabajos: [...veinte, item()] })));
    await assertFails(setDoc(oref('t1', 'O251011-OTRB'), orden({ piezas: [...veinte, item()] })));
  });
  it('trabajos y piezas deben ser listas', async () => {
    await sembrar();
    await assertFails(setDoc(oref('t1', ON), orden({ trabajos: 'no es lista' })));
    await assertFails(setDoc(oref('t1', ON), orden({ piezas: { 0: item() } })));
    await assertFails(setDoc(oref('t1', ON), sin(orden(), 'trabajos')));
  });
  it('las reglas NO revisan cada renglón (límite de 1,000 revisiones): eso lo hace la app (ordenes.ts)', async () => {
    await sembrar();
    // Un renglón raro pasa las reglas a propósito; validarOrden lo rechaza antes de guardar.
    await assertSucceeds(setDoc(oref('t1', ON), orden({ trabajos: [item({ cantidad: 0 })] })));
  });
  it('total: entero, no negativo y con tope', async () => {
    await sembrar();
    await assertSucceeds(setDoc(oref('t1', ON), orden({ totalCentavos: 0 })));
    for (const total of [-1, 10.5, '100', 4000000001]) {
      await assertFails(setDoc(oref('t1', 'O251011-TOT1'), orden({ totalCentavos: total })));
    }
  });
  it('campos de texto nuevos: 500 pasan, 501 no; deben ser texto', async () => {
    await sembrar();
    await assertSucceeds(setDoc(oref('t1', ON), orden({ estadoRecepcion: 'x'.repeat(500), pertenencias: 'x'.repeat(500) })));
    for (const extra of [
      { estadoRecepcion: 'x'.repeat(501) }, { pertenencias: 'x'.repeat(501) },
      { estadoRecepcion: 5 }, { pertenencias: ['gato'] },
      { fallaReportada: 'x'.repeat(1001) }, { observaciones: 'x'.repeat(1001) },
    ]) {
      await assertFails(setDoc(oref('t1', 'O251011-TXT1'), orden(extra)));
    }
  });
  it('los campos de texto son obligatorios (aunque sea vacíos)', async () => {
    await sembrar();
    await assertSucceeds(setDoc(oref('t1', ON), orden({ fallaReportada: '', observaciones: '', estadoRecepcion: '', pertenencias: '' })));
    for (const campo of ['fallaReportada', 'observaciones', 'estadoRecepcion', 'pertenencias']) {
      await assertFails(setDoc(oref('t1', 'O251011-FALT'), sin(orden(), campo)));
    }
  });
  it('sin datos del cliente con la bandera apagada: nombre, teléfono o placas se rechazan', async () => {
    await sembrar();
    await assertFails(setDoc(oref('t1', ON), orden({ cliente: { nombre: 'Juan' } })));
    await assertFails(setDoc(oref('t1', ON), orden({ cliente: { telefono: '6641112233' } })));
    await assertFails(setDoc(oref('t1', ON), orden({ vehiculo: { marca: 'Nissan', modelo: 'Sentra', anio: 2001, placas: 'ABC123' } })));
  });
  it('no acepta VIN, fotos ni otros campos', async () => {
    await sembrar();
    await assertFails(setDoc(oref('t1', ON), orden({ vin: '1HGCM82633A004352' })));
    await assertFails(setDoc(oref('t1', ON), orden({ fotos: ['https://x'] })));
    await assertFails(setDoc(oref('t1', ON), orden({ vehiculo: { marca: 'Nissan', modelo: 'Sentra', anio: 2001, vin: 'X' } })));
  });
  it('folio con formato "O" + 6 dígitos + "-" + 4', async () => {
    await sembrar();
    await assertFails(setDoc(oref('t1', 'C251011-7KQ4'), orden()));
    await assertFails(setDoc(oref('t1', 'orden-1'), orden()));
  });
  it('estado desconocido y versión de aviso distinta se rechazan', async () => {
    await sembrar();
    await assertFails(setDoc(oref('t1', ON), orden({ estado: 'cancelada' })));
    await assertFails(setDoc(oref('t1', ON), orden({ avisoVersion: 'otra' })));
  });
  it('fecha de borrado inventada al crear se rechaza', async () => {
    await sembrar();
    await assertFails(setDoc(oref('t1', ON), orden({ expiraAt: enDias(80) })));
    await assertFails(setDoc(oref('t1', ON), orden({ expiraAt: enDias(400) })));
  });
});

describe('crear ya entregada (entrega + garantía + 8 días)', () => {
  it('con garantía de 30 días: borrado a 38 días de hoy', async () => {
    await sembrar();
    await assertSucceeds(setDoc(oref('t1', ON), orden({ estado: 'entregado', garantiaDias: 30, fechaEntrega: serverTimestamp(), expiraAt: enDias(38) })));
  });
  it('garantía 0 y 365 pasan', async () => {
    await sembrar();
    await assertSucceeds(setDoc(oref('t1', ON), orden({ estado: 'entregado', garantiaDias: 0, fechaEntrega: serverTimestamp(), expiraAt: enDias(8) })));
    await assertSucceeds(setDoc(oref('t1', 'O251011-G365'), orden({ estado: 'entregado', garantiaDias: 365, fechaEntrega: serverTimestamp(), expiraAt: enDias(373) })));
  });
  it('garantía fuera de rango o que no es entero se rechaza', async () => {
    await sembrar();
    for (const [g, d] of [[-1, 7], [366, 374], [1.5, 9.5], ['30', 38]]) {
      await assertFails(setDoc(oref('t1', ON), orden({ estado: 'entregado', garantiaDias: g, fechaEntrega: serverTimestamp(), expiraAt: enDias(d) })));
    }
  });
  it('entregada sin garantía, sin fecha de entrega, o con fecha de entrega inventada se rechaza', async () => {
    await sembrar();
    await assertFails(setDoc(oref('t1', ON), orden({ estado: 'entregado', fechaEntrega: serverTimestamp(), expiraAt: enDias(8) })));
    await assertFails(setDoc(oref('t1', ON), orden({ estado: 'entregado', garantiaDias: 30, expiraAt: enDias(38) })));
    await assertFails(setDoc(oref('t1', ON), orden({ estado: 'entregado', garantiaDias: 30, fechaEntrega: new Date(ahora() - 60 * DIA), expiraAt: enDias(-22) })));
  });
  it('entregada con borrado a 88 días (en vez de garantía + 8) se rechaza', async () => {
    await sembrar();
    await assertFails(setDoc(oref('t1', ON), orden({ estado: 'entregado', garantiaDias: 30, fechaEntrega: serverTimestamp(), expiraAt: enDias(88) })));
  });
  it('sin entregar NO puede llevar garantía ni fecha de entrega', async () => {
    await sembrar();
    await assertFails(setDoc(oref('t1', ON), orden({ garantiaDias: 30 })));
    await assertFails(setDoc(oref('t1', ON), orden({ fechaEntrega: serverTimestamp() })));
  });
});

describe('límite de 1,000 revisiones de Firestore', () => {
  const veinte = () => Array.from({ length: 20 }, (_, i) => item({ descripcion: `Renglón ${i + 1} `.padEnd(200, 'x') }));
  it('crear una orden ENTREGADA con 20 trabajos y 20 piezas sí se guarda', async () => {
    await sembrar();
    await assertSucceeds(setDoc(oref('t1', ON), orden({
      trabajos: veinte(), piezas: veinte(), estado: 'entregado', garantiaDias: 365, fechaEntrega: serverTimestamp(), expiraAt: enDias(373),
    })));
  });
  it('entregar una orden existente con 20 trabajos y 20 piezas sí se guarda', async () => {
    await sembrar();
    await assertSucceeds(setDoc(oref('t1'), edicion({
      trabajos: veinte(), piezas: veinte(), estado: 'entregado', garantiaDias: 30, fechaEntrega: serverTimestamp(), expiraAt: enDias(38),
    })));
  });
  it('cambiar la garantía de una entregada con 20 + 20 sí se guarda', async () => {
    await sembrar();
    await assertSucceeds(setDoc(oref('t1', OE), edicionEntregada({
      trabajos: veinte(), piezas: veinte(), garantiaDias: 90, expiraAt: new Date(ENTREGA.getTime() + 98 * DIA),
    })));
  });
});

describe('editar: fórmulas de la fecha de borrado', () => {
  it('sin entregar: cada guardado recalcula 88 días desde ahora', async () => {
    await sembrar();
    await assertSucceeds(setDoc(oref('t1'), edicion({ estado: 'diagnostico' })));
  });
  it('sin entregar: dejar la fecha anterior o moverla a escondidas se rechaza', async () => {
    await sembrar();
    await assertFails(setDoc(oref('t1'), edicion({ expiraAt: enDias(78) })));
    await assertFails(setDoc(oref('t1'), edicion({ expiraAt: enDias(300) })));
    await assertFails(updateDoc(oref('t1'), { expiraAt: enDias(300), actualizadoAt: serverTimestamp() }));
  });
  it('entregar: fecha de entrega = hora del servidor y borrado = garantía + 8 días', async () => {
    await sembrar();
    await assertSucceeds(setDoc(oref('t1'), edicion({ estado: 'entregado', garantiaDias: 30, fechaEntrega: serverTimestamp(), expiraAt: enDias(38) })));
  });
  it('entregar sin garantía, con fecha de entrega inventada o con borrado movido se rechaza', async () => {
    await sembrar();
    await assertFails(setDoc(oref('t1'), edicion({ estado: 'entregado', fechaEntrega: serverTimestamp(), expiraAt: enDias(8) })));
    await assertFails(setDoc(oref('t1'), edicion({ estado: 'entregado', garantiaDias: 30, fechaEntrega: new Date(ahora() - 30 * DIA), expiraAt: enDias(8) })));
    await assertFails(setDoc(oref('t1'), edicion({ estado: 'entregado', garantiaDias: 30, fechaEntrega: serverTimestamp(), expiraAt: enDias(300) })));
  });
  it('ya entregada: editar sin cambiar la garantía NO mueve el borrado ni la fecha de entrega', async () => {
    await sembrar();
    await assertSucceeds(setDoc(oref('t1', OE), edicionEntregada({ observaciones: 'Se entregó lavado' })));
    await assertFails(setDoc(oref('t1', OE), edicionEntregada({ expiraAt: enDias(88) })));
    await assertFails(setDoc(oref('t1', OE), edicionEntregada({ expiraAt: new Date(EXPIRA_ENTREGADA.getTime() + DIA) })));
    await assertFails(setDoc(oref('t1', OE), edicionEntregada({ fechaEntrega: serverTimestamp() })));
    await assertFails(setDoc(oref('t1', OE), edicionEntregada({ fechaEntrega: new Date(ENTREGA.getTime() + DIA) })));
  });
  it('ya entregada: cambiar la garantía recalcula desde la MISMA fecha de entrega', async () => {
    await sembrar();
    await assertSucceeds(setDoc(oref('t1', OE), edicionEntregada({ garantiaDias: 60, expiraAt: new Date(ENTREGA.getTime() + 68 * DIA) })));
  });
  it('ya entregada: cambiar la garantía con un borrado que no cuadra se rechaza', async () => {
    await sembrar();
    await assertFails(setDoc(oref('t1', OE), edicionEntregada({ garantiaDias: 60 })));
    await assertFails(setDoc(oref('t1', OE), edicionEntregada({ garantiaDias: 60, expiraAt: enDias(68) })));
    await assertFails(setDoc(oref('t1', OE), edicionEntregada({ garantiaDias: 366, expiraAt: new Date(ENTREGA.getTime() + 374 * DIA) })));
  });
  it('regresa de entregada a otro estado: 88 días desde ese guardado, sin garantía ni fecha de entrega', async () => {
    await sembrar();
    await assertSucceeds(setDoc(oref('t1', OE), edicion({ estado: 'reparacion' })));
  });
  it('regresa de entregada: conservar el borrado viejo, la garantía o la fecha de entrega se rechaza', async () => {
    await sembrar();
    await assertFails(setDoc(oref('t1', OE), edicion({ estado: 'reparacion', expiraAt: EXPIRA_ENTREGADA })));
    await assertFails(setDoc(oref('t1', OE), edicion({ estado: 'reparacion', garantiaDias: 30 })));
    await assertFails(setDoc(oref('t1', OE), edicion({ estado: 'reparacion', fechaEntrega: ENTREGA })));
  });
  it('no se puede cambiar la fecha de creación ni la versión del aviso', async () => {
    await sembrar();
    await assertFails(setDoc(oref('t1'), edicion({ creadoAt: new Date() })));
    await assertFails(setDoc(oref('t1'), edicion({ avisoVersion: 'otra' })));
  });
  it('una orden vencida (el TTL aún no la borra) ya no se edita', async () => {
    await sembrar();
    await env.withSecurityRulesDisabled(async (c) => { await updateDoc(doc(c.firestore(), 'talleres', 'T1', 'ordenes', O), { expiraAt: new Date(ahora() - DIA) }); });
    await assertFails(setDoc(oref('t1'), edicion()));
  });
  it('editar con campos de texto de más de 500 se rechaza', async () => {
    await sembrar();
    await assertFails(setDoc(oref('t1'), edicion({ estadoRecepcion: 'x'.repeat(501) })));
    await assertFails(setDoc(oref('t1'), edicion({ pertenencias: 'x'.repeat(501) })));
  });
});

describe('quién puede', () => {
  it('el dueño lee y consulta sus órdenes por estado; el admin también', async () => {
    await sembrar();
    await assertSucceeds(getDoc(oref('t1')));
    await assertSucceeds(getDocs(query(collection(como('t1'), 'talleres', 'T1', 'ordenes'), where('estado', '==', 'recibido'), orderBy('actualizadoAt', 'desc'))));
    await assertSucceeds(getDoc(oref('adm')));
  });
  it('otro taller, un yonke o un visitante no leen ni escriben', async () => {
    await sembrar();
    for (const uid of ['t2', 'y1', null]) {
      await assertFails(getDoc(oref(uid)));
      await assertFails(setDoc(oref(uid), edicion()));
      await assertFails(setDoc(oref(uid, ON), orden()));
    }
  });
  it('taller desactivado no crea ni edita', async () => {
    await sembrar();
    await assertFails(setDoc(oref('t3', ON, 'T3'), orden({ tallerId: 'T3' })));
    await assertFails(setDoc(oref('t3', O, 'T3'), edicion({ tallerId: 'T3' })));
  });
  it('borrar: el dueño activo y el admin sí; otro taller no', async () => {
    await sembrar();
    await assertFails(deleteDoc(oref('t2')));
    await assertSucceeds(deleteDoc(oref('t1')));
    await assertSucceeds(deleteDoc(oref('adm', OE)));
  });
});

describe('falla cerrada y términos', () => {
  it('sin config/ordenes no se crea ni se edita', async () => {
    await sembrar({ configOrdenes: null });
    await assertFails(setDoc(oref('t1', ON), orden()));
    await assertFails(setDoc(oref('t1'), edicion()));
  });
  it('con habilitado != true no se crea ni se edita', async () => {
    await sembrar();
    await conConfig({ habilitado: false });
    await assertFails(setDoc(oref('t1', ON), orden()));
    await assertFails(setDoc(oref('t1'), edicion()));
  });
  // Decisión del abogado: sin términos vigentes SOLO se ve, reimprime y descarga.
  it('con la versión de términos vieja no se crea, ni se edita, ni se borra', async () => {
    await sembrar();
    await conVersion('v2');
    await assertFails(setDoc(oref('t1', ON), orden()));
    await assertFails(setDoc(oref('t1'), edicion()));
    await assertFails(deleteDoc(oref('t1')));
  });
  it('taller desactivado no borra, ni con términos viejos', async () => {
    await sembrar();
    await conVersion('v2');
    await assertFails(deleteDoc(oref('t3', O, 'T3')));
  });
  it('quitar datos del cliente con versión vieja: NO', async () => {
    await sembrar();
    await sembrarDatoCliente();
    await conVersion('v2');
    await assertFails(updateDoc(oref('t1'), { cliente: {}, 'vehiculo.placas': deleteField(), actualizadoAt: serverTimestamp() }));
  });
  it('quitar datos del cliente con términos vigentes: SÍ, aunque la función de órdenes esté apagada, sin mover el borrado', async () => {
    await sembrar();
    await sembrarDatoCliente();
    await env.withSecurityRulesDisabled(async (c) => { await deleteDoc(doc(c.firestore(), 'config', 'ordenes')); });
    await assertSucceeds(updateDoc(oref('t1'), { cliente: {}, 'vehiculo.placas': deleteField(), actualizadoAt: serverTimestamp() }));
  });
  it('"quitar datos" no sirve para colar otros cambios ni mover el borrado', async () => {
    await sembrar();
    await sembrarDatoCliente();
    await assertFails(updateDoc(oref('t1'), { cliente: {}, 'vehiculo.placas': deleteField(), expiraAt: enDias(300), actualizadoAt: serverTimestamp() }));
    await assertFails(updateDoc(oref('t1'), { cliente: {}, estado: 'listo', actualizadoAt: serverTimestamp() }));
  });
  it('con la bandera de datos del cliente encendida, sí se aceptan nombre, teléfono y placas', async () => {
    await sembrar();
    await conConfig({ datosClienteHabilitados: true });
    await assertSucceeds(setDoc(oref('t1', ON), orden({ cliente: { nombre: 'Juan', telefono: '6641112233' }, vehiculo: { marca: 'Nissan', modelo: 'Sentra', anio: 2001, placas: 'ABC123' } })));
  });
});

// ---------- Etapa 2: convertir una cotización en orden (un solo guardado) ----------
// Igual que convertirCotizacionEnOrden() en src/app/panel/taller/ordenes/datos.js: en UN lote se
// crea la orden y se borran la cotización y TODOS sus renglones. Caso máximo: 20 renglones (22 operaciones).
const CZ = 'C251011-CONV';
async function sembrarCotizacion(tallerId = 'T1', n = 20) {
  await env.withSecurityRulesDisabled(async (c) => {
    const db = c.firestore();
    const exp = enDias(80);
    await setDoc(doc(db, 'talleres', tallerId, 'cotizaciones', CZ), {
      tallerId, estado: 'enviada', archivada: false, cliente: { nombre: 'Juan', telefono: '6641112233' },
      vehiculo: { marca: 'Nissan', modelo: 'Sentra', anio: 2001, placas: 'ABC123', kilometraje: 150000 },
      observaciones: 'x', vigenciaDias: 15, totalCentavos: 1, numRenglones: n, creadoAt: CREADO, actualizadoAt: CREADO, expiraAt: exp, avisoVersion: 'aviso-1',
    });
    for (let i = 0; i < n; i++) {
      await setDoc(doc(db, 'talleres', tallerId, 'cotizaciones', CZ, 'renglones', String(i)), {
        tipo: i < n / 2 ? 'pieza' : 'manoObra', descripcion: 'x'.repeat(200), cantidad: 999, precioUnitario: 1000000, expiraAt: exp,
      });
    }
  });
}
async function convertirComo(uid, { tallerId = 'T1', n = 20, extra = {} } = {}) {
  const db = como(uid);
  const lote = writeBatch(db);
  const it = (k) => Array.from({ length: k }, () => item({ descripcion: 'x'.repeat(200), cantidad: 999, precioUnitario: 1000000 }));
  lote.set(doc(db, 'talleres', tallerId, 'ordenes', ON), orden({ tallerId, piezas: it(n / 2), trabajos: it(n / 2), ...extra }));
  for (let i = 0; i < n; i++) lote.delete(doc(db, 'talleres', tallerId, 'cotizaciones', CZ, 'renglones', String(i)));
  lote.delete(doc(db, 'talleres', tallerId, 'cotizaciones', CZ));
  return lote.commit();
}
async function quedaCotizacion(tallerId = 'T1') {
  let r;
  await env.withSecurityRulesDisabled(async (c) => {
    const db = c.firestore();
    const cot = await getDoc(doc(db, 'talleres', tallerId, 'cotizaciones', CZ));
    const ren = await getDocs(collection(db, 'talleres', tallerId, 'cotizaciones', CZ, 'renglones'));
    const ord = await getDoc(doc(db, 'talleres', tallerId, 'ordenes', ON));
    r = { cotizacion: cot.exists(), renglones: ren.size, orden: ord.exists() };
  });
  return r;
}

describe('convertir una cotización en orden (un solo guardado)', () => {
  it('caso máximo (20 renglones): se crea la orden y se borran la cotización y todos sus renglones', async () => {
    await sembrar();
    await sembrarCotizacion();
    await assertSucceeds(convertirComo('t1'));
    const r = await quedaCotizacion();
    if (r.cotizacion || r.renglones !== 0 || !r.orden) throw new Error(`esperaba todo convertido, quedó ${JSON.stringify(r)}`);
  });
  it('con términos viejos se rechaza TODO: la cotización y sus 20 renglones quedan intactos', async () => {
    await sembrar();
    await sembrarCotizacion();
    await conVersion('v2');
    await assertFails(convertirComo('t1'));
    const r = await quedaCotizacion();
    if (!r.cotizacion || r.renglones !== 20 || r.orden) throw new Error(`esperaba nada cambiado, quedó ${JSON.stringify(r)}`);
  });
  it('taller desactivado: se rechaza todo', async () => {
    await sembrar();
    await sembrarCotizacion('T3');
    await assertFails(convertirComo('t3', { tallerId: 'T3' }));
    const r = await quedaCotizacion('T3');
    if (!r.cotizacion || r.renglones !== 20 || r.orden) throw new Error(`esperaba nada cambiado, quedó ${JSON.stringify(r)}`);
  });
  it('con las órdenes apagadas (habilitado != true): se rechaza todo', async () => {
    await sembrar();
    await sembrarCotizacion();
    await conConfig({ habilitado: false });
    await assertFails(convertirComo('t1'));
    const r = await quedaCotizacion();
    if (!r.cotizacion || r.renglones !== 20 || r.orden) throw new Error(`esperaba nada cambiado, quedó ${JSON.stringify(r)}`);
  });
  it('si la orden llevara datos del cliente (bandera apagada): se rechaza todo', async () => {
    await sembrar();
    await sembrarCotizacion();
    await assertFails(convertirComo('t1', { extra: { cliente: { nombre: 'Juan' } } }));
    const r = await quedaCotizacion();
    if (!r.cotizacion || r.renglones !== 20 || r.orden) throw new Error(`esperaba nada cambiado, quedó ${JSON.stringify(r)}`);
  });
  it('otro taller no puede convertir una cotización ajena', async () => {
    await sembrar();
    await sembrarCotizacion();
    await assertFails(convertirComo('t2'));
  });
});

// ---------- Etapa 4: datos del cliente solo con la bandera Y la versión de aviso vigente ----------
const AVISO_NUEVO = 'aviso-orden-1';
const conCliente = { cliente: { nombre: 'Juan Pérez', telefono: '664 111 2233' } };
const vehiculoConPlacas = { vehiculo: { marca: 'Nissan', modelo: 'Sentra', anio: 2001, kilometraje: 150000, placas: 'ABC123' } };

describe('etapa 4: datos del cliente en órdenes', () => {
  it('bandera encendida y aviso vigente: una orden NUEVA lleva nombre, teléfono y placas', async () => {
    await sembrar();
    await conConfig({ datosClienteHabilitados: true, avisoOrdenVersion: AVISO_NUEVO });
    await assertSucceeds(setDoc(oref('t1', ON), orden({ ...conCliente, ...vehiculoConPlacas, avisoVersion: AVISO_NUEVO })));
  });
  it('bandera APAGADA: aunque la versión coincida, se rechazan', async () => {
    await sembrar();
    await conConfig({ datosClienteHabilitados: false, avisoOrdenVersion: AVISO_NUEVO });
    await assertFails(setDoc(oref('t1', ON), orden({ ...conCliente, avisoVersion: AVISO_NUEVO })));
    await assertFails(setDoc(oref('t1', ON), orden({ ...vehiculoConPlacas, avisoVersion: AVISO_NUEVO })));
  });
  it('orden VIEJA (aviso-orden-0): no se le pueden agregar datos del cliente aunque la bandera esté encendida', async () => {
    await sembrar();
    await conConfig({ datosClienteHabilitados: true, avisoOrdenVersion: AVISO_NUEVO });
    await assertFails(setDoc(oref('t1'), edicion(conCliente)));
    await assertFails(setDoc(oref('t1'), edicion(vehiculoConPlacas)));
    // ...pero sí se sigue editando sin datos del cliente
    await assertSucceeds(setDoc(oref('t1'), edicion({ estado: 'diagnostico' })));
  });
  it('orden vieja: tampoco puede "actualizarse" a la versión nueva del aviso para colar datos', async () => {
    await sembrar();
    await conConfig({ datosClienteHabilitados: true, avisoOrdenVersion: AVISO_NUEVO });
    await assertFails(setDoc(oref('t1'), edicion({ ...conCliente, avisoVersion: AVISO_NUEVO })));
  });
  it('orden nueva con datos: se edita y se quitan los datos con términos vigentes; con términos viejos, no', async () => {
    await sembrar();
    await conConfig({ datosClienteHabilitados: true, avisoOrdenVersion: AVISO_NUEVO });
    await env.withSecurityRulesDisabled(async (c) => {
      await setDoc(doc(c.firestore(), 'talleres', 'T1', 'ordenes', ON), { ...orden({ ...conCliente, ...vehiculoConPlacas, avisoVersion: AVISO_NUEVO }), creadoAt: CREADO, actualizadoAt: CREADO, expiraAt: enDias(80) });
    });
    await assertSucceeds(setDoc(oref('t1', ON), orden({ ...conCliente, ...vehiculoConPlacas, avisoVersion: AVISO_NUEVO, creadoAt: CREADO, observaciones: 'x' })));
    await conVersion('v2');
    await assertFails(updateDoc(oref('t1', ON), { cliente: {}, 'vehiculo.placas': deleteField(), actualizadoAt: serverTimestamp() }));
    await conVersion('v1');
    await assertSucceeds(updateDoc(oref('t1', ON), { cliente: {}, 'vehiculo.placas': deleteField(), actualizadoAt: serverTimestamp() }));
  });
  it('caso máximo con datos del cliente: entregada, 20 trabajos y 20 piezas', async () => {
    await sembrar();
    await conConfig({ datosClienteHabilitados: true, avisoOrdenVersion: AVISO_NUEVO });
    const veinte = Array.from({ length: 20 }, () => item({ descripcion: 'x'.repeat(200), cantidad: 999, precioUnitario: 1000000 }));
    await assertSucceeds(setDoc(oref('t1', ON), orden({
      ...conCliente, ...vehiculoConPlacas, avisoVersion: AVISO_NUEVO, trabajos: veinte, piezas: veinte,
      estado: 'entregado', garantiaDias: 365, fechaEntrega: serverTimestamp(), expiraAt: enDias(373),
    })));
  });
  it('convertir con la bandera encendida copia los datos: caso máximo (20 renglones) en un solo guardado', async () => {
    await sembrar();
    await sembrarCotizacion();
    await conConfig({ datosClienteHabilitados: true, avisoOrdenVersion: AVISO_NUEVO });
    await assertSucceeds(convertirComo('t1', { extra: { ...conCliente, ...vehiculoConPlacas, avisoVersion: AVISO_NUEVO } }));
    const r = await quedaCotizacion();
    if (r.cotizacion || r.renglones !== 0 || !r.orden) throw new Error(`esperaba todo convertido, quedó ${JSON.stringify(r)}`);
  });
  it('borrar una orden con datos del cliente: con términos viejos NO; con vigentes SÍ', async () => {
    await sembrar();
    await conConfig({ datosClienteHabilitados: true, avisoOrdenVersion: AVISO_NUEVO });
    await env.withSecurityRulesDisabled(async (c) => {
      await setDoc(doc(c.firestore(), 'talleres', 'T1', 'ordenes', ON), { ...orden({ ...conCliente, avisoVersion: AVISO_NUEVO }), creadoAt: CREADO, actualizadoAt: CREADO, expiraAt: enDias(80) });
    });
    await conVersion('v2');
    await assertFails(deleteDoc(oref('t1', ON)));
    await conVersion('v1');
    await assertSucceeds(deleteDoc(oref('t1', ON)));
  });
});


describe('candado Premium de órdenes (config/ordenes.requierePremium)', () => {
  async function conPlan(campos) {
    await env.withSecurityRulesDisabled(async (c) => { await updateDoc(doc(c.firestore(), 'talleres', 'T1'), campos); });
  }
  const sinEntregar = () => edicion({ fallaReportada: 'Ruido distinto', expiraAt: enDias(88) });

  it('sin el campo (como hoy): un taller Básico crea y edita', async () => {
    await sembrar();
    await assertSucceeds(setDoc(oref('t1', ON), orden()));
    await assertSucceeds(setDoc(oref('t1', O), sinEntregar()));
  });
  it('con requierePremium false: igual que hoy', async () => {
    await sembrar();
    await conConfig({ requierePremium: false });
    await assertSucceeds(setDoc(oref('t1', ON), orden()));
  });
  it('encendido y Básico: NO crea ni edita; SÍ ve, quita datos del cliente y borra', async () => {
    await sembrar({ configOrdenes: { habilitado: true, datosClienteHabilitados: true, avisoOrdenVersion: AVISO, requierePremium: true } });
    await sembrarDatoCliente();
    await assertFails(setDoc(oref('t1', ON), orden()));
    await assertFails(setDoc(oref('t1', O), sinEntregar()));
    await assertSucceeds(getDoc(oref('t1', O)));
    await assertSucceeds(updateDoc(oref('t1', O), { cliente: {}, 'vehiculo.placas': deleteField(), actualizadoAt: serverTimestamp() }));
    await assertSucceeds(deleteDoc(oref('t1', O)));
  });
  it('encendido y Premium vigente (con fecha futura o sin fecha): crea y edita', async () => {
    await sembrar();
    await conConfig({ requierePremium: true });
    await conPlan({ plan: 'premium', premiumHasta: enDias(30) });
    await assertSucceeds(setDoc(oref('t1', ON), orden()));
    await assertSucceeds(setDoc(oref('t1', O), sinEntregar()));
    await conPlan({ plan: 'premium', premiumHasta: deleteField() });
    await assertSucceeds(setDoc(oref('t1', O), sinEntregar()));
  });
  it('encendido y Premium vencido: NO crea ni edita, pero SÍ borra', async () => {
    await sembrar();
    await conConfig({ requierePremium: true });
    await conPlan({ plan: 'premium', premiumHasta: enDias(-1) });
    await assertFails(setDoc(oref('t1', ON), orden()));
    await assertFails(setDoc(oref('t1', O), sinEntregar()));
    await assertSucceeds(deleteDoc(oref('t1', O)));
  });
});
