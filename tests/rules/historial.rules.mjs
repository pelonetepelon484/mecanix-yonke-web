// Pruebas de reglas de Firestore para el historial de servicios del taller (etapa 2).
// talleres/{id}/historial/{vehiculoId}: un documento por vehículo con sus servicios dentro, que
// solo salen de órdenes ENTREGADAS. Sin nombre ni teléfono del cliente. Bandera:
// config/historialTaller.habilitado. Premium vigente. Borrado: expiraAt = ahora + 548 días.
// Comando (desde la raíz del repo):  npm run test:rules
import { describe, it, before, after } from 'node:test';
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { arrayUnion, collection, deleteDoc, doc, getDoc, getDocs, query, serverTimestamp, setDoc, updateDoc, where } from 'firebase/firestore';

const reglas = readFileSync(new URL('../../firestore.rules', import.meta.url), 'utf8');
let env;
const DIA = 86400000;
const enDias = (n) => new Date(Date.now() + n * DIA);
const ENTREGA = new Date(Date.now() - 2 * DIA);
const ENTREGA2 = new Date(Date.now() - 1 * DIA);
const OE = 'O251011-ENTR';   // entregada, Nissan Sentra 2001, placas "abc 123", 150,000 km
const OE2 = 'O251012-ENT2';  // entregada, mismo vehículo, sin placas, 152,000 km
const OS = 'O251013-SINP';   // entregada, Toyota Corolla 2020, sin placas
const ON = 'O251014-NOEN';   // sin entregar
const V = 'veh1';

function taller(owner, extra = {}) {
  return {
    nombre: 'Taller', whatsapp: '6641234567', ciudad: 'Tijuana', logoUrl: '', ownerUid: owner, activo: true,
    creadoAt: new Date(), aceptacionVersion: 'v1',
    avisoPrivacidad: { modo: 'generado', versionPlantilla: 'aviso-1', fecha: new Date() },
    plan: 'premium', premiumHasta: enDias(30),
    ...extra,
  };
}
// vehiculo: lo que cambia del vehículo; con placas: null la orden va sin placas.
function orden(extra = {}, vehiculo = {}) {
  const v = { marca: 'Nissan', modelo: 'Sentra', anio: 2001, kilometraje: 150000, placas: 'abc 123', ...vehiculo };
  if (v.placas === null) delete v.placas;
  return {
    tallerId: 'T1', estado: 'entregado', cliente: { nombre: 'Juan', telefono: '6641112233' },
    vehiculo: v,
    fallaReportada: '', observaciones: '', estadoRecepcion: '', pertenencias: '',
    trabajos: [{ descripcion: 'Cambio de balatas', cantidad: 1, precioUnitario: 500 }],
    piezas: [{ descripcion: 'Balatas delanteras', cantidad: 1, precioUnitario: 400 }],
    totalCentavos: 90000, creadoAt: ENTREGA, actualizadoAt: ENTREGA, expiraAt: enDias(30),
    avisoVersion: 'aviso-orden-1', garantiaDias: 30, fechaEntrega: ENTREGA,
    ...extra,
  };
}
const servicio = (extra = {}) => ({ folio: OE, fecha: ENTREGA, kilometraje: 150000, descripcion: 'Cambio de balatas', piezas: ['Balatas delanteras'], ...extra });
// Documento del vehículo, como lo arma la app, para CREAR con la orden OE.
function vehiculo(extra = {}) {
  return {
    placas: 'ABC123', marca: 'Nissan', modelo: 'Sentra', anio: 2001,
    servicios: [servicio()], folios: [OE], ultimoFolio: OE, ultimoKm: 150000, ultimoServicioAt: ENTREGA,
    creadoAt: serverTimestamp(), actualizadoAt: serverTimestamp(), expiraAt: enDias(548),
    ...extra,
  };
}
const sin = (o, ...llaves) => Object.fromEntries(Object.entries(o).filter(([k]) => !llaves.includes(k)));

async function sembrar({ configHistorial = { habilitado: true }, conVehiculo = false } = {}) {
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
    await setDoc(doc(db, 'talleres', 'T1', 'ordenes', OE2), orden({ fechaEntrega: ENTREGA2 }, { kilometraje: 152000, placas: null }));
    await setDoc(doc(db, 'talleres', 'T1', 'ordenes', OS), orden({}, { marca: 'Toyota', modelo: 'Corolla', anio: 2020, placas: null }));
    await setDoc(doc(db, 'talleres', 'T1', 'ordenes', ON), sin(orden({ estado: 'listo' }), 'garantiaDias', 'fechaEntrega'));
    if (conVehiculo) {
      await setDoc(doc(db, 'talleres', 'T1', 'historial', V), { ...vehiculo(), creadoAt: ENTREGA, actualizadoAt: ENTREGA, expiraAt: enDias(546) });
    }
  });
}
async function conTaller(campos, id = 'T1') {
  await env.withSecurityRulesDisabled(async (c) => { await updateDoc(doc(c.firestore(), 'talleres', id), campos); });
}
const como = (uid) => (uid ? env.authenticatedContext(uid).firestore() : env.unauthenticatedContext().firestore());
const href = (uid, id = V, tallerId = 'T1') => doc(como(uid), 'talleres', tallerId, 'historial', id);
// Segundo servicio (orden OE2) sobre el vehículo sembrado, como lo arma la app.
function agregarOE2(extra = {}) {
  const s2 = servicio({ folio: OE2, fecha: ENTREGA2, kilometraje: 152000 });
  return {
    ...vehiculo(), creadoAt: ENTREGA,
    servicios: [servicio(), s2], folios: [OE, OE2], ultimoFolio: OE2, ultimoKm: 152000, ultimoServicioAt: ENTREGA2,
    actualizadoAt: serverTimestamp(), expiraAt: enDias(548),
    ...extra,
  };
}

before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-historial',
    firestore: { rules: reglas, host: '127.0.0.1', port: 8181 },
  });
});
after(async () => { await env.cleanup(); });

describe('crear un vehículo desde una orden entregada', () => {
  it('con las placas de la orden (en mayúsculas y sin espacios)', async () => {
    await sembrar();
    await assertSucceeds(setDoc(href('t1'), vehiculo()));
  });
  it('orden sin placas: el taller las escribe', async () => {
    await sembrar();
    const s = servicio({ folio: OS });
    await assertSucceeds(setDoc(href('t1'), vehiculo({ placas: 'XYZ-9', marca: 'Toyota', modelo: 'Corolla', anio: 2020, servicios: [s], folios: [OS], ultimoFolio: OS })));
  });
  it('marca y modelo se comparan sin importar mayúsculas', async () => {
    await sembrar();
    await assertSucceeds(setDoc(href('t1'), vehiculo({ marca: 'NISSAN', modelo: 'sentra' })));
  });
  it('orden sin entregar, inexistente o de otro vehículo: no', async () => {
    await sembrar();
    await assertFails(setDoc(href('t1'), vehiculo({ servicios: [servicio({ folio: ON })], folios: [ON], ultimoFolio: ON })));
    await assertFails(setDoc(href('t1'), vehiculo({ servicios: [servicio({ folio: 'O999999-XXXX' })], folios: ['O999999-XXXX'], ultimoFolio: 'O999999-XXXX' })));
    await assertFails(setDoc(href('t1'), vehiculo({ anio: 2002 })));
    await assertFails(setDoc(href('t1'), vehiculo({ modelo: 'Tsuru' })));
  });
  it('placas distintas a las de la orden, vacías, largas o con otros caracteres: no', async () => {
    await sembrar();
    await assertFails(setDoc(href('t1'), vehiculo({ placas: 'ZZZ999' })));
    await assertFails(setDoc(href('t1'), vehiculo({ placas: '' })));
    await assertFails(setDoc(href('t1'), sin(vehiculo(), 'placas')));
    await assertFails(setDoc(href('t1'), vehiculo({ placas: 'ABC 123' })));
    await assertFails(setDoc(href('t1'), vehiculo({ placas: 'ABCDEFGHIJKLM' })));
  });
  it('NUNCA datos del cliente ni campos extra (en el vehículo o en el servicio)', async () => {
    await sembrar();
    await assertFails(setDoc(href('t1'), vehiculo({ telefono: '6641112233' })));
    await assertFails(setDoc(href('t1'), vehiculo({ cliente: { nombre: 'Juan' } })));
    await assertFails(setDoc(href('t1'), vehiculo({ servicios: [servicio({ telefono: '6641112233' })] })));
    await assertFails(setDoc(href('t1'), vehiculo({ servicios: [servicio({ cliente: 'Juan' })] })));
  });
  it('el servicio debe ser el de la orden: misma fecha de entrega y kilometraje', async () => {
    await sembrar();
    await assertFails(setDoc(href('t1'), vehiculo({ servicios: [servicio({ fecha: new Date() })] })));
    await assertFails(setDoc(href('t1'), vehiculo({ servicios: [servicio({ kilometraje: 1 })] })));
    await assertFails(setDoc(href('t1'), vehiculo({ servicios: [sin(servicio(), 'kilometraje')] })));
  });
  it('descripción de más de 1000 o más de 20 piezas: no', async () => {
    await sembrar();
    await assertSucceeds(setDoc(href('t1', 'v1000'), vehiculo({ servicios: [servicio({ descripcion: 'x'.repeat(1000) })] })));
    await assertFails(setDoc(href('t1', 'v1001'), vehiculo({ servicios: [servicio({ descripcion: 'x'.repeat(1001) })] })));
    await assertFails(setDoc(href('t1', 'v21'), vehiculo({ servicios: [servicio({ piezas: Array(21).fill('p') })] })));
  });
  it('fecha de borrado: ahora + 548 días (±5 min); otra fecha no', async () => {
    await sembrar();
    await assertFails(setDoc(href('t1'), vehiculo({ expiraAt: enDias(600) })));
    await assertFails(setDoc(href('t1'), vehiculo({ expiraAt: enDias(547) })));
    await assertFails(setDoc(href('t1'), vehiculo({ creadoAt: new Date() })));
  });
  it('con más de un servicio al crear, o folios que no cuadran: no', async () => {
    await sembrar();
    await assertFails(setDoc(href('t1'), vehiculo({ servicios: [servicio(), servicio({ folio: OE2 })], folios: [OE, OE2], ultimoFolio: OE2 })));
    await assertFails(setDoc(href('t1'), vehiculo({ folios: [OE2] })));
  });
});

describe('quién puede escribir', () => {
  it('sin config/historialTaller o con habilitado false: nadie (falla cerrada)', async () => {
    await sembrar({ configHistorial: null });
    await assertFails(setDoc(href('t1'), vehiculo()));
    await sembrar({ configHistorial: { habilitado: false } });
    await assertFails(setDoc(href('t1'), vehiculo()));
  });
  it('sin Premium o con Premium vencido: no', async () => {
    await sembrar();
    await conTaller({ plan: 'freemium', premiumHasta: null });
    await assertFails(setDoc(href('t1'), vehiculo()));
    await conTaller({ plan: 'premium', premiumHasta: enDias(-1) });
    await assertFails(setDoc(href('t1'), vehiculo()));
  });
  it('con términos viejos o taller desactivado: no', async () => {
    await sembrar();
    await conTaller({ aceptacionVersion: 'v0' });
    await assertFails(setDoc(href('t1'), vehiculo()));
    await conTaller({ aceptacionVersion: 'v1', activo: false });
    await assertFails(setDoc(href('t1'), vehiculo()));
  });
  it('otro taller no escribe en mi historial', async () => {
    await sembrar();
    await assertFails(setDoc(href('t2'), vehiculo()));
  });
});

describe('agregar un servicio a un vehículo que ya existe', () => {
  it('agrega la segunda orden (sin placas en la orden) y mueve la fecha de borrado', async () => {
    await sembrar({ conVehiculo: true });
    await assertSucceeds(setDoc(href('t1'), agregarOE2()));
  });
  it('la misma orden dos veces: no', async () => {
    await sembrar({ conVehiculo: true });
    await assertFails(setDoc(href('t1'), { ...agregarOE2(), servicios: [servicio(), servicio()], folios: [OE, OE], ultimoFolio: OE }));
  });
  it('cambiar o borrar un servicio anterior, o reemplazar en vez de agregar: no', async () => {
    await sembrar({ conVehiculo: true });
    const s2 = servicio({ folio: OE2, fecha: ENTREGA2, kilometraje: 152000 });
    await assertFails(setDoc(href('t1'), agregarOE2({ servicios: [servicio({ descripcion: 'Cambiado' }), s2] })));
    await assertFails(setDoc(href('t1'), agregarOE2({ servicios: [s2], folios: [OE2] })));
  });
  it('cambiar placas, vehículo o fecha de creación: no', async () => {
    await sembrar({ conVehiculo: true });
    await assertFails(setDoc(href('t1'), agregarOE2({ placas: 'OTRA1' })));
    await assertFails(setDoc(href('t1'), agregarOE2({ marca: 'NISSAN' })));
    await assertFails(setDoc(href('t1'), agregarOE2({ creadoAt: new Date() })));
  });
  it('una orden de OTRO vehículo no entra en este documento', async () => {
    await sembrar({ conVehiculo: true });
    const s = servicio({ folio: OS });
    await assertFails(setDoc(href('t1'), agregarOE2({ servicios: [servicio(), s], folios: [OE, OS], ultimoFolio: OS })));
  });
  it('tope de 60 servicios', async () => {
    await sembrar();
    const folios = Array.from({ length: 60 }, (_, i) => `O${String(250000 + i)}-AAAA`);
    await env.withSecurityRulesDisabled(async (c) => {
      await setDoc(doc(c.firestore(), 'talleres', 'T1', 'historial', V), {
        ...vehiculo(), servicios: folios.map((f) => servicio({ folio: f })), folios, ultimoFolio: folios[59],
        creadoAt: ENTREGA, actualizadoAt: ENTREGA, expiraAt: enDias(546),
      });
    });
    const s2 = servicio({ folio: OE2, fecha: ENTREGA2, kilometraje: 152000 });
    await assertFails(setDoc(href('t1'), agregarOE2({ servicios: [...folios.map((f) => servicio({ folio: f })), s2], folios: [...folios, OE2] })));
  });
  it('sin Premium ya no agrega (pero ve y borra, ver abajo)', async () => {
    await sembrar({ conVehiculo: true });
    await conTaller({ plan: 'freemium', premiumHasta: null });
    await assertFails(setDoc(href('t1'), agregarOE2()));
  });
});

describe('leer y borrar', () => {
  it('el dueño lee, busca por placas y por folio; el admin también; otro taller no', async () => {
    await sembrar({ conVehiculo: true });
    await assertSucceeds(getDoc(href('t1')));
    await assertSucceeds(getDocs(query(collection(como('t1'), 'talleres', 'T1', 'historial'), where('placas', '==', 'ABC123'))));
    await assertSucceeds(getDocs(query(collection(como('t1'), 'talleres', 'T1', 'historial'), where('folios', 'array-contains', OE))));
    await assertSucceeds(getDoc(href('adm')));
    await assertFails(getDoc(href('t2')));
    await assertFails(getDoc(href(null)));
  });
  it('el dueño borra SIEMPRE: con términos viejos, sin Premium o desactivado', async () => {
    await sembrar({ conVehiculo: true });
    await conTaller({ aceptacionVersion: 'v0', plan: 'freemium', premiumHasta: null, activo: false });
    await assertSucceeds(deleteDoc(href('t1')));
  });
  it('con la bandera apagada, el dueño igual puede borrar', async () => {
    await sembrar({ conVehiculo: true, configHistorial: { habilitado: false } });
    await assertSucceeds(deleteDoc(href('t1')));
  });
  it('otro taller no borra; el admin sí', async () => {
    await sembrar({ conVehiculo: true });
    await assertFails(deleteDoc(href('t2')));
    await assertSucceeds(deleteDoc(href('adm')));
  });
  it('arrayUnion directo (sin agregar el servicio) no pasa', async () => {
    await sembrar({ conVehiculo: true });
    await assertFails(updateDoc(href('t1'), { folios: arrayUnion(OE2) }));
  });
});
