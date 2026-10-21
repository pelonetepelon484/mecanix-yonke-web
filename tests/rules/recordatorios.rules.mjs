// Pruebas de reglas de Firestore para los recordatorios del historial del taller (etapa 3).
// recordatorios[] (hasta 10) y proximoAviso dentro de talleres/{id}/historial/{vehiculoId}.
// Incluye los casos más pesados que genera la app, por el límite de 1,000 revisiones de Firestore.
// Comando (desde la raíz del repo):  npm run test:rules
import { describe, it, before, after } from 'node:test';
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { collection, deleteDoc, doc, getDocs, orderBy, query, serverTimestamp, setDoc, updateDoc, where } from 'firebase/firestore';

const reglas = readFileSync(new URL('../../firestore.rules', import.meta.url), 'utf8');
let env;
const DIA = 86400000;
const BASE = Date.UTC(2026, 9, 1, 18, 0, 0);
const enDias = (n) => new Date(Date.now() + n * DIA);
const ENTREGA = new Date(Date.now() - 2 * DIA);
const ENTREGA2 = new Date(Date.now() - 1 * DIA);
const OE = 'O251011-ENTR';
const OE2 = 'O251012-ENT2';
const V = 'veh1';

function taller(owner, extra = {}) {
  return {
    nombre: 'Taller', whatsapp: '6641234567', ciudad: 'Tijuana', logoUrl: '', ownerUid: owner, activo: true,
    creadoAt: new Date(), aceptacionVersion: 'v1',
    avisoPrivacidad: { modo: 'generado', versionPlantilla: 'aviso-1', fecha: new Date() },
    plan: 'premium', premiumHasta: enDias(30), ...extra,
  };
}
function orden(extra = {}, vehiculo = {}) {
  return {
    tallerId: 'T1', estado: 'entregado', cliente: {},
    vehiculo: { marca: 'Nissan', modelo: 'Sentra', anio: 2001, kilometraje: 150000, ...vehiculo },
    fallaReportada: '', observaciones: '', estadoRecepcion: '', pertenencias: '', trabajos: [], piezas: [],
    totalCentavos: 0, creadoAt: ENTREGA, actualizadoAt: ENTREGA, expiraAt: enDias(30),
    avisoVersion: 'aviso-orden-1', garantiaDias: 30, fechaEntrega: ENTREGA, ...extra,
  };
}
const servicio = (extra = {}) => ({ folio: OE, fecha: ENTREGA, kilometraje: 150000, descripcion: 'Cambio de aceite', piezas: [], ...extra });
// Recordatorio n: fecha BASE + n días, aviso 15 días antes.
const rec = (n, extra = {}) => ({
  id: `rec${String(n).padStart(4, '0')}`, tipo: `Servicio ${n}`, fecha: new Date(BASE + n * DIA), avisarDiasAntes: 15,
  folio: OE, estado: 'pendiente', creadoAt: new Date(BASE), ...extra,
});
// El menor (fecha - días) de los pendientes, como la app.
function proximo(lista) {
  const avisos = lista.filter((r) => r.estado === 'pendiente').map((r) => r.fecha.getTime() - r.avisarDiasAntes * DIA);
  return avisos.length ? new Date(Math.min(...avisos)) : null;
}
// Vehículo creado con la orden OE (como la app), con recordatorios.
function vehiculo(recordatorios = [], extra = {}) {
  return {
    placas: 'ABC123', marca: 'Nissan', modelo: 'Sentra', anio: 2001,
    servicios: [servicio()], folios: [OE], ultimoFolio: OE, ultimoKm: 150000, ultimoServicioAt: ENTREGA,
    recordatorios, proximoAviso: proximo(recordatorios),
    creadoAt: serverTimestamp(), actualizadoAt: serverTimestamp(), expiraAt: enDias(548),
    ...extra,
  };
}
const EXPIRA_SEMBRADO = enDias(500);
// Vehículo ya guardado (sembrado sin reglas). sinCampos: como los de producción de la etapa 2.
async function sembrar({ recordatorios = [], sinCampos = false, configHistorial = { habilitado: true } } = {}) {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'config', 'cotizaciones'), { terminosVersion: 'v1', avisoTallerVersion: 'aviso-1' });
    if (configHistorial) await setDoc(doc(db, 'config', 'historialTaller'), configHistorial);
    await setDoc(doc(db, 'usuarios', 'adm'), { rol: 'admin', email: 'a@x.mx' });
    await setDoc(doc(db, 'talleres', 'T1'), taller('t1'));
    await setDoc(doc(db, 'usuarios', 't1'), { rol: 'taller', tallerId: 'T1', email: 't1@x.mx' });
    await setDoc(doc(db, 'talleres', 'T2'), taller('t2'));
    await setDoc(doc(db, 'usuarios', 't2'), { rol: 'taller', tallerId: 'T2', email: 't2@x.mx' });
    await setDoc(doc(db, 'talleres', 'T1', 'ordenes', OE), orden());
    await setDoc(doc(db, 'talleres', 'T1', 'ordenes', OE2), orden({ fechaEntrega: ENTREGA2 }, { kilometraje: 152000 }));
    const v = { ...vehiculo(recordatorios), creadoAt: ENTREGA, actualizadoAt: ENTREGA, expiraAt: EXPIRA_SEMBRADO };
    if (sinCampos) { delete v.recordatorios; delete v.proximoAviso; }
    await setDoc(doc(db, 'talleres', 'T1', 'historial', V), v);
  });
}
async function conTaller(campos) {
  await env.withSecurityRulesDisabled(async (c) => { await updateDoc(doc(c.firestore(), 'talleres', 'T1'), campos); });
}
const como = (uid) => (uid ? env.authenticatedContext(uid).firestore() : env.unauthenticatedContext().firestore());
const href = (uid, id = V) => doc(como(uid), 'talleres', 'T1', 'historial', id);
// Cambio "solo recordatorios" (ruta C), como la app.
const soloRecordatorios = (lista) => ({ recordatorios: lista, proximoAviso: proximo(lista), actualizadoAt: serverTimestamp() });
// Agregar la orden OE2 (ruta B) con la lista de recordatorios resultante.
function agregarOE2(lista, extra = {}) {
  return {
    ...vehiculo(lista), creadoAt: ENTREGA,
    servicios: [servicio(), servicio({ folio: OE2, fecha: ENTREGA2, kilometraje: 152000 })], folios: [OE, OE2], ultimoFolio: OE2,
    ultimoKm: 152000, ultimoServicioAt: ENTREGA2, ...extra,
  };
}
const diez = () => Array.from({ length: 10 }, (_, i) => rec(i + 1));

before(async () => {
  env = await initializeTestEnvironment({ projectId: 'demo-recordatorios', firestore: { rules: reglas, host: '127.0.0.1', port: 8181 } });
});
after(async () => { await env.cleanup(); });

describe('crear y agregar servicio NO tocan recordatorios (se agregan después, ruta C)', () => {
  it('crear: sin recordatorios (vacío o sin el campo) sí; con recordatorios o con proximoAviso no', async () => {
    await sembrar();
    await assertSucceeds(setDoc(href('t1', 'n1'), vehiculo([])));
    const sinCampos = vehiculo([]);
    delete sinCampos.recordatorios; delete sinCampos.proximoAviso;
    await assertSucceeds(setDoc(href('t1', 'n2'), sinCampos));
    await assertFails(setDoc(href('t1', 'n3'), vehiculo([rec(180)])));
    await assertFails(setDoc(href('t1', 'n4'), vehiculo([], { proximoAviso: new Date(BASE) })));
  });
  it('agregar servicio deja los recordatorios igual; si los cambia, no', async () => {
    await sembrar({ recordatorios: [rec(180)] });
    await assertSucceeds(setDoc(href('t1'), agregarOE2([rec(180)])));
    await sembrar({ recordatorios: [rec(180)] });
    await assertFails(setDoc(href('t1'), agregarOE2([rec(180), rec(200, { folio: OE2 })])));
    await sembrar({ recordatorios: [rec(180)] });
    await assertFails(setDoc(href('t1'), agregarOE2([rec(180, { estado: 'atendido' })])));
  });
  it('vehículo de la etapa 2 (sin los campos): agregar servicio igual que antes', async () => {
    await sembrar({ sinCampos: true });
    const sin = agregarOE2([]);
    delete sin.recordatorios; delete sin.proximoAviso;
    await assertSucceeds(setDoc(href('t1'), sin));
  });
});

describe('solo recordatorios (ruta C): agregar, adelantar, días de aviso, atendido, quitar', () => {
  it('agregar recordatorios con proximoAviso = el menor aviso pendiente', async () => {
    await sembrar();
    await assertSucceeds(updateDoc(href('t1'), soloRecordatorios([rec(180), rec(365)])));
  });
  it('agregar uno nuevo y dejar atendido el pendiente del mismo tipo', async () => {
    await sembrar({ recordatorios: [rec(180, { tipo: 'Cambio de aceite' })] });
    await assertSucceeds(updateDoc(href('t1'), soloRecordatorios([rec(180, { tipo: 'Cambio de aceite', estado: 'atendido' }), rec(360, { tipo: 'Cambio de aceite' })])));
  });
  it('adelantar la fecha, cambiar días de aviso, marcar atendido y quitar', async () => {
    await sembrar({ recordatorios: [rec(180), rec(365)] });
    await assertSucceeds(updateDoc(href('t1'), soloRecordatorios([rec(180, { fecha: new Date(BASE + 90 * DIA) }), rec(365)])));
    await sembrar({ recordatorios: [rec(180), rec(365)] });
    await assertSucceeds(updateDoc(href('t1'), soloRecordatorios([rec(180, { avisarDiasAntes: 30 }), rec(365)])));
    await sembrar({ recordatorios: [rec(180), rec(365)] });
    await assertSucceeds(updateDoc(href('t1'), soloRecordatorios([rec(180, { estado: 'atendido' }), rec(365)])));
    await sembrar({ recordatorios: [rec(180), rec(365)] });
    await assertSucceeds(updateDoc(href('t1'), soloRecordatorios([rec(365)])));
    await sembrar({ recordatorios: [rec(180)] });
    await assertSucceeds(updateDoc(href('t1'), soloRecordatorios([])));
  });
  it('proximoAviso que no es el menor, que no coincide, null con pendientes o fecha sin pendientes: no', async () => {
    await sembrar({ recordatorios: [rec(180), rec(365)] });
    const l = [rec(180), rec(365, { avisarDiasAntes: 20 })];
    await assertFails(updateDoc(href('t1'), { ...soloRecordatorios(l), proximoAviso: new Date(BASE + 345 * DIA) }));
    await assertFails(updateDoc(href('t1'), { ...soloRecordatorios(l), proximoAviso: new Date(BASE) }));
    await assertFails(updateDoc(href('t1'), { ...soloRecordatorios(l), proximoAviso: null }));
    await assertFails(updateDoc(href('t1'), { ...soloRecordatorios([rec(1, { estado: 'atendido' })]), proximoAviso: new Date(BASE) }));
  });
  it('forma del recordatorio: campos extra (o personales), tipo, días, estado, id, folio y fecha', async () => {
    const malos = [
      rec(1, { telefono: '6641112233' }), rec(1, { cliente: 'Juan' }), rec(1, { tipo: '' }), rec(1, { tipo: 'x'.repeat(61) }),
      rec(1, { avisarDiasAntes: 61 }), rec(1, { avisarDiasAntes: -1 }), rec(1, { avisarDiasAntes: 1.5 }), rec(1, { estado: 'otro' }),
      rec(1, { id: 'CON MAYUS' }), rec(1, { folio: 'O999999-XXXX' }), rec(1, { fecha: 'mañana', estado: 'atendido' }),
    ];
    for (const r of malos) {
      await sembrar();
      await assertFails(updateDoc(href('t1'), soloRecordatorios([r])));
    }
    await sembrar();
    await assertSucceeds(updateDoc(href('t1'), soloRecordatorios([rec(1, { tipo: 'x'.repeat(60), avisarDiasAntes: 60 })])));
  });
  it('más de 10 recordatorios: no', async () => {
    await sembrar();
    await assertFails(updateDoc(href('t1'), soloRecordatorios(Array.from({ length: 11 }, (_, i) => rec(i)))));
  });
  it('NO mueve expiraAt ni toca servicios, folios, placas o vehículo', async () => {
    await sembrar({ recordatorios: [rec(180)] });
    const l = [rec(180, { avisarDiasAntes: 20 })];
    await assertFails(updateDoc(href('t1'), { ...soloRecordatorios(l), expiraAt: enDias(548) }));
    await assertFails(updateDoc(href('t1'), { ...soloRecordatorios(l), placas: 'OTRA1' }));
    await assertFails(updateDoc(href('t1'), { ...soloRecordatorios(l), servicios: [] }));
    await assertFails(updateDoc(href('t1'), { ...soloRecordatorios(l), folios: [OE, OE2] }));
    await assertFails(updateDoc(href('t1'), { ...soloRecordatorios(l), ultimoKm: 1 }));
    await assertFails(updateDoc(href('t1'), { ...soloRecordatorios(l), actualizadoAt: new Date() }));
  });
  it('vehículo de la etapa 2 (sin recordatorios ni proximoAviso): se le pueden poner', async () => {
    await sembrar({ sinCampos: true });
    await assertSucceeds(updateDoc(href('t1'), soloRecordatorios([rec(30)])));
  });
  it('sin Premium, términos viejos, desactivado, sin bandera u otro taller: no', async () => {
    const l = [rec(180, { avisarDiasAntes: 20 })];
    await sembrar({ recordatorios: [rec(180)] });
    await conTaller({ plan: 'freemium', premiumHasta: null });
    await assertFails(updateDoc(href('t1'), soloRecordatorios(l)));
    await sembrar({ recordatorios: [rec(180)] });
    await conTaller({ aceptacionVersion: 'v0' });
    await assertFails(updateDoc(href('t1'), soloRecordatorios(l)));
    await sembrar({ recordatorios: [rec(180)] });
    await conTaller({ activo: false });
    await assertFails(updateDoc(href('t1'), soloRecordatorios(l)));
    await sembrar({ recordatorios: [rec(180)], configHistorial: { habilitado: false } });
    await assertFails(updateDoc(href('t1'), soloRecordatorios(l)));
    await sembrar({ recordatorios: [rec(180)] });
    await assertFails(updateDoc(href('t2'), soloRecordatorios(l)));
  });
});

describe('casos más pesados de la app con 10 (límite de 1,000 revisiones)', () => {
  it('cambiar el último, quitar el primero o atender uno de en medio', async () => {
    await sembrar({ recordatorios: diez() });
    const a = diez(); a[9] = rec(10, { fecha: new Date(BASE + 2 * DIA) });
    await assertSucceeds(updateDoc(href('t1'), soloRecordatorios(a)));
    await sembrar({ recordatorios: diez() });
    await assertSucceeds(updateDoc(href('t1'), soloRecordatorios(diez().slice(1))));
    await sembrar({ recordatorios: diez() });
    const b = diez(); b[5] = rec(6, { estado: 'atendido' });
    await assertSucceeds(updateDoc(href('t1'), soloRecordatorios(b)));
  });
  // Como lo hace la app con la lista llena: dos guardados (todo junto pasa el límite y se rechaza).
  it('lleno: 1) quitar el atendido más viejo; 2) atender el del mismo tipo y agregar el nuevo', async () => {
    const guardados = diez().map((r, i) => (i === 0 ? { ...r, estado: 'atendido' } : r));
    await sembrar({ recordatorios: guardados });
    const sinViejo = guardados.slice(1);
    await assertSucceeds(updateDoc(href('t1'), soloRecordatorios(sinViejo)));
    const despues = sinViejo.map((r) => (r.id === 'rec0005' ? { ...r, estado: 'atendido' } : r));
    await assertSucceeds(updateDoc(href('t1'), soloRecordatorios([...despues, rec(500, { tipo: 'Servicio 5' })])));
  });
  it('todo junto en un solo guardado pasa el límite y Firestore lo RECHAZA (no lo deja pasar)', async () => {
    const guardados = diez().map((r, i) => (i === 0 ? { ...r, estado: 'atendido' } : r));
    await sembrar({ recordatorios: guardados });
    const despues = guardados.slice(1).map((r) => (r.id === 'rec0005' ? { ...r, estado: 'atendido' } : r));
    await assertFails(updateDoc(href('t1'), soloRecordatorios([...despues, rec(500, { tipo: 'Servicio 5' })])));
  });
});

describe('consultas del panel (índices automáticos) y borrar', () => {
  it('"Servicios por vencer" (proximoAviso <= hoy) y "Se borrarán pronto" (expiraAt <= hoy + 30)', async () => {
    await sembrar({ recordatorios: [rec(1)] });
    const ref = collection(como('t1'), 'talleres', 'T1', 'historial');
    await assertSucceeds(getDocs(query(ref, where('proximoAviso', '<=', new Date()), orderBy('proximoAviso'))));
    await assertSucceeds(getDocs(query(ref, where('expiraAt', '<=', enDias(30)), orderBy('expiraAt'))));
  });
  it('borrar el vehículo sigue igual: el dueño siempre', async () => {
    await sembrar({ recordatorios: diez() });
    await conTaller({ plan: 'freemium', premiumHasta: null, aceptacionVersion: 'v0' });
    await assertSucceeds(deleteDoc(href('t1')));
  });
});
