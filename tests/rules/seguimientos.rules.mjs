// Pruebas de reglas del seguimiento público de órdenes (etapa 1).
// seguimientos/{sha256 hex del token}: solo datos públicos; el token vive en la orden.
// Campos nuevos de la orden: seguimientoToken, notaSeguimiento, primeraEntregaAt (solo órdenes con
// aviso en avisosConSeguimiento()). Bandera: config/ordenes.seguimientoHabilitado.
// Corren contra el emulador con el archivo real ../../firestore.rules.
// Comando (desde la raíz del repo):  npm run test:rules
import { describe, it, before, after } from 'node:test';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { collection, deleteDoc, deleteField, doc, getDoc, getDocs, serverTimestamp, setDoc, updateDoc, writeBatch } from 'firebase/firestore';

const reglas = readFileSync(new URL('../../firestore.rules', import.meta.url), 'utf8');
let env;
const DIA = 86400000;
const enDias = (n) => new Date(Date.now() + n * DIA);
const V3 = 'aviso-orden-3';          // versión con seguimiento (de prueba; el texto no importa aquí)
const V2 = 'aviso-orden-2';          // versión anterior, sin seguimiento
const O = 'O261020-SEG1';            // orden v3 sin entregar
const OE = 'O261020-ENT1';           // orden v3 entregada hace 5 días (30 de garantía), con enlace activo
const OV = 'O261020-VIE1';           // orden v2 (sin seguimiento)
const ON = 'O261020-NUEV';
const CREADO = new Date(Date.now() - 10 * DIA);
const ENTREGA = new Date(Date.now() - 5 * DIA);
const EXPIRA_ENTREGADA = new Date(ENTREGA.getTime() + 38 * DIA);
const TOKEN_E = 'E'.repeat(40) + 'abc';          // 43 caracteres
const TOKEN_N = 'N'.repeat(40) + '_-z';
const TOKEN_N2 = 'M'.repeat(40) + 'x_1';
const huella = (t) => createHash('sha256').update(t).digest('hex');

const item = (extra = {}) => ({ descripcion: 'Cambio de balatas', cantidad: 1, precioUnitario: 500, ...extra });
const veinte = () => Array.from({ length: 20 }, () => item({ descripcion: 'x'.repeat(200), cantidad: 999, precioUnitario: 1000000 }));
const conCliente = { cliente: { nombre: 'Juan Pérez', telefono: '6641112233' } };
const VEH = { marca: 'Nissan', modelo: 'Sentra', anio: 2001, kilometraje: 150000, placas: 'ABC1234' };

// Cuerpo completo como lo arma la app.
function orden(extra = {}) {
  return {
    tallerId: 'T1', estado: 'recibido', cliente: {}, vehiculo: { ...VEH },
    fallaReportada: 'Ruido al frenar', observaciones: 'Golpe', estadoRecepcion: 'Rayón', pertenencias: 'Gato',
    trabajos: [item()], piezas: [item()], totalCentavos: 100000,
    creadoAt: serverTimestamp(), actualizadoAt: serverTimestamp(), expiraAt: enDias(88), avisoVersion: V3,
    ...extra,
  };
}
// Edición de la entregada OE sin cambiar la entrega.
const edicionE = (extra = {}) => orden({
  ...conCliente, creadoAt: CREADO, estado: 'entregado', garantiaDias: 30, fechaEntrega: ENTREGA, expiraAt: EXPIRA_ENTREGADA,
  primeraEntregaAt: ENTREGA, seguimientoToken: TOKEN_E, notaSeguimiento: 'Listo para recoger', ...extra,
});
const edicionO = (extra = {}) => orden({ ...conCliente, creadoAt: CREADO, ...extra });
const sin = (o, ...llaves) => Object.fromEntries(Object.entries(o).filter(([k]) => !llaves.includes(k)));

// Seguimiento como lo arma la app.
function seg(extra = {}) {
  return {
    tallerId: 'T1', folio: OE, tallerNombre: 'Taller Peña', tallerWhatsapp: '6641234567',
    marca: 'Nissan', modelo: 'Sentra', anio: 2001, estado: 'entregado', nota: 'Listo para recoger',
    actualizadoAt: serverTimestamp(), expiraAt: new Date(ENTREGA.getTime() + 30 * DIA),
    ...extra,
  };
}

function taller(owner, extra = {}) {
  return {
    nombre: 'Taller Peña', whatsapp: '6641234567', ciudad: 'Tijuana', logoUrl: '', ownerUid: owner, activo: true,
    creadoAt: new Date(), aceptacionVersion: 'v1',
    avisoPrivacidad: { modo: 'generado', versionPlantilla: 'aviso-1', fecha: new Date() },
    plan: 'premium', premiumHasta: enDias(30),
    ...extra,
  };
}

const CONFIG = { habilitado: true, datosClienteHabilitados: true, avisoOrdenVersion: V3, requierePremium: true, seguimientoHabilitado: true };

async function sembrar({ config = CONFIG, tallerExtra = {} } = {}) {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'config', 'cotizaciones'), { terminosVersion: 'v1', avisoTallerVersion: 'aviso-1', resumenCambios: 'x' });
    if (config) await setDoc(doc(db, 'config', 'ordenes'), config);
    await setDoc(doc(db, 'usuarios', 'adm'), { rol: 'admin', email: 'a@x.mx' });
    await setDoc(doc(db, 'usuarios', 'srv'), { rol: 'servicio', email: 's@x.mx' });
    await setDoc(doc(db, 'talleres', 'T1'), taller('t1', tallerExtra));
    await setDoc(doc(db, 'usuarios', 't1'), { rol: 'taller', tallerId: 'T1', email: 't1@x.mx' });
    await setDoc(doc(db, 'talleres', 'T2'), taller('t2'));
    await setDoc(doc(db, 'usuarios', 't2'), { rol: 'taller', tallerId: 'T2', email: 't2@x.mx' });
    const o = (extra) => ({ ...orden({ ...conCliente, ...extra }), creadoAt: CREADO, actualizadoAt: CREADO });
    await setDoc(doc(db, 'talleres', 'T1', 'ordenes', O), o({ expiraAt: enDias(78) }));
    await setDoc(doc(db, 'talleres', 'T1', 'ordenes', OV), o({ expiraAt: enDias(78), avisoVersion: V2 }));
    await setDoc(doc(db, 'talleres', 'T1', 'ordenes', OE), o({
      estado: 'entregado', garantiaDias: 30, fechaEntrega: ENTREGA, expiraAt: EXPIRA_ENTREGADA,
      primeraEntregaAt: ENTREGA, seguimientoToken: TOKEN_E, notaSeguimiento: 'Listo para recoger',
    }));
    await setDoc(doc(db, 'seguimientos', huella(TOKEN_E)), { ...seg(), actualizadoAt: ENTREGA });
  });
}

const como = (uid) => (uid ? env.authenticatedContext(uid).firestore() : env.unauthenticatedContext().firestore());
const oref = (db, folio, tallerId = 'T1') => doc(db, 'talleres', tallerId, 'ordenes', folio);
const sref = (db, token) => doc(db, 'seguimientos', huella(token));
async function conConfig(campos) {
  await env.withSecurityRulesDisabled(async (c) => { await updateDoc(doc(c.firestore(), 'config', 'ordenes'), campos); });
}
async function conTaller(campos) {
  await env.withSecurityRulesDisabled(async (c) => { await updateDoc(doc(c.firestore(), 'talleres', 'T1'), campos); });
}
async function existe(ruta) {
  let r = false;
  await env.withSecurityRulesDisabled(async (c) => { r = (await getDoc(doc(c.firestore(), ...ruta))).exists(); });
  return r;
}

// Lotes como los arma la app.
function guardarConSeg(uid, folio, cuerpo, token, segCuerpo) {
  const db = como(uid);
  const b = writeBatch(db);
  b.set(oref(db, folio), cuerpo);
  b.set(sref(db, token), segCuerpo);
  return b.commit();
}

before(async () => {
  env = await initializeTestEnvironment({ projectId: 'demo-seguimientos', firestore: { rules: reglas, host: '127.0.0.1', port: 8181 } });
});
after(async () => { await env.cleanup(); });

describe('límite de 1,000 revisiones: caso máximo (20 trabajos + 20 piezas, con datos del cliente)', () => {
  it('crear una orden v3 YA entregada (primeraEntregaAt = hora del servidor)', async () => {
    await sembrar();
    await assertSucceeds(setDoc(oref(como('t1'), ON), orden({
      ...conCliente, trabajos: veinte(), piezas: veinte(), estado: 'entregado', garantiaDias: 365,
      fechaEntrega: serverTimestamp(), primeraEntregaAt: serverTimestamp(), expiraAt: enDias(373),
    })));
  });
  it('editar la entregada con enlace activo, en lote con su seguimiento', async () => {
    await sembrar();
    await assertSucceeds(guardarConSeg('t1', OE, edicionE({ trabajos: veinte(), piezas: veinte(), notaSeguimiento: 'Garantía vigente' }), TOKEN_E, seg({ nota: 'Garantía vigente' })));
  });
  it('activar el enlace (token nuevo + crear seguimiento) en una entregada', async () => {
    await sembrar();
    await env.withSecurityRulesDisabled(async (c) => {
      await updateDoc(oref(c.firestore(), OE), { seguimientoToken: deleteField() });
      await deleteDoc(sref(c.firestore(), TOKEN_E));
    });
    await assertSucceeds(guardarConSeg('t1', OE, edicionE({ trabajos: veinte(), piezas: veinte(), seguimientoToken: TOKEN_N }), TOKEN_N, seg()));
  });
  it('entregar AHORA una orden con enlace activo (primeraEntregaAt nueva)', async () => {
    await sembrar();
    await env.withSecurityRulesDisabled(async (c) => {
      await updateDoc(oref(c.firestore(), O), { seguimientoToken: TOKEN_N });
      await setDoc(sref(c.firestore(), TOKEN_N), { ...seg({ folio: O, estado: 'recibido', nota: '', expiraAt: enDias(78) }), actualizadoAt: CREADO });
    });
    await assertSucceeds(guardarConSeg('t1', O, edicionO({
      trabajos: veinte(), piezas: veinte(), estado: 'entregado', garantiaDias: 365, fechaEntrega: serverTimestamp(),
      primeraEntregaAt: serverTimestamp(), expiraAt: enDias(373), seguimientoToken: TOKEN_N,
    }), TOKEN_N, seg({ folio: O, nota: '', expiraAt: enDias(29) })));
  });
  it('reactivar: borrar el enlace viejo y crear uno nuevo en el mismo lote', async () => {
    await sembrar();
    const db = como('t1');
    const b = writeBatch(db);
    b.set(oref(db, OE), edicionE({ trabajos: veinte(), piezas: veinte(), seguimientoToken: TOKEN_N }));
    b.delete(sref(db, TOKEN_E));
    b.set(sref(db, TOKEN_N), seg());
    await assertSucceeds(b.commit());
  });
  it('control: el mismo caso máximo con el seguimiento desincronizado SÍ se rechaza', async () => {
    await sembrar();
    await assertFails(guardarConSeg('t1', OE, edicionE({ trabajos: veinte(), piezas: veinte(), notaSeguimiento: 'Garantía vigente' }), TOKEN_E, seg({ nota: 'Otra nota' })));
    await assertFails(guardarConSeg('t1', OE, sin(edicionE({ trabajos: veinte(), piezas: veinte(), estado: 'listo', expiraAt: enDias(88) }), 'garantiaDias', 'fechaEntrega'), TOKEN_E, seg()));
    // ...y guardar la orden sola, sin reescribir su enlace activo, también.
    await assertFails(setDoc(oref(como('t1'), OE), edicionE({ trabajos: veinte(), piezas: veinte() })));
  });
  it('borrar la orden con su enlace en el mismo lote', async () => {
    await sembrar();
    await env.withSecurityRulesDisabled(async (c) => {
      await updateDoc(oref(c.firestore(), OE), { trabajos: veinte(), piezas: veinte() });
    });
    const db = como('t1');
    const b = writeBatch(db);
    b.delete(oref(db, OE));
    b.delete(sref(db, TOKEN_E));
    await assertSucceeds(b.commit());
  });
});

// ---------- Funcionamiento ----------

// Activar el enlace de una orden que no lo tiene (O: v3, sin entregar, borrado a 78 días).
function activarO(uid, { orden: o = {}, seguimiento: s = {}, token = TOKEN_N } = {}) {
  const db = como(uid);
  const b = writeBatch(db);
  b.set(oref(db, O), edicionO({ seguimientoToken: token, ...o }));
  b.set(sref(db, token), seg({ folio: O, estado: 'recibido', nota: '', expiraAt: enDias(88), ...s }));
  return b.commit();
}

describe('campos nuevos de la orden', () => {
  it('al crear: nunca token ni nota; v3 entregada exige primeraEntregaAt = hora del servidor', async () => {
    await sembrar();
    const db = como('t1');
    await assertFails(setDoc(oref(db, ON), orden({ seguimientoToken: TOKEN_N })));
    await assertFails(setDoc(oref(db, ON), orden({ notaSeguimiento: 'hola' })));
    const entregada = { estado: 'entregado', garantiaDias: 30, fechaEntrega: serverTimestamp(), expiraAt: enDias(38) };
    await assertFails(setDoc(oref(db, ON), orden(entregada)));
    await assertFails(setDoc(oref(db, ON), orden({ ...entregada, primeraEntregaAt: enDias(-1) })));
    await assertSucceeds(setDoc(oref(db, ON), orden({ ...entregada, primeraEntregaAt: serverTimestamp() })));
  });
  it('sin entregar no lleva primeraEntregaAt', async () => {
    await sembrar();
    await assertFails(setDoc(oref(como('t1'), ON), orden({ primeraEntregaAt: serverTimestamp() })));
  });
  it('orden con aviso anterior (v2): sin campos de seguimiento, y se sigue guardando igual que antes', async () => {
    await sembrar();
    await conConfig({ avisoOrdenVersion: V2 });
    const db = como('t1');
    const entregada = { avisoVersion: V2, estado: 'entregado', garantiaDias: 30, fechaEntrega: serverTimestamp(), expiraAt: enDias(38) };
    await assertSucceeds(setDoc(oref(db, ON), orden(entregada)));
    await assertFails(setDoc(oref(db, OV), orden({ ...conCliente, creadoAt: CREADO, avisoVersion: V2, notaSeguimiento: 'x' })));
    await assertFails(setDoc(oref(db, OV), orden({ ...conCliente, creadoAt: CREADO, avisoVersion: V2, ...entregada, primeraEntregaAt: serverTimestamp() })));
    await assertSucceeds(setDoc(oref(db, OV), orden({ ...conCliente, creadoAt: CREADO, ...entregada })));
  });
  it('al entregar por primera vez una v3, primeraEntregaAt es obligatoria (hora del servidor)', async () => {
    await sembrar();
    const db = como('t1');
    const entregar = { estado: 'entregado', garantiaDias: 30, fechaEntrega: serverTimestamp(), expiraAt: enDias(38) };
    await assertFails(setDoc(oref(db, O), edicionO(entregar)));
    await assertSucceeds(setDoc(oref(db, O), edicionO({ ...entregar, primeraEntregaAt: serverTimestamp() })));
  });
  it('primeraEntregaAt no cambia nunca, aunque la orden regrese y se vuelva a entregar', async () => {
    await sembrar();
    // Regresa a "listo": conserva primeraEntregaAt; su enlace (vence a los 30 días de la entrega) se reescribe.
    const listo = sin(edicionE({ estado: 'listo', expiraAt: enDias(88) }), 'garantiaDias', 'fechaEntrega');
    await assertFails(guardarConSeg('t1', OE, sin(listo, 'primeraEntregaAt'), TOKEN_E, seg({ estado: 'listo' })));
    await assertFails(guardarConSeg('t1', OE, { ...listo, primeraEntregaAt: new Date() }, TOKEN_E, seg({ estado: 'listo' })));
    await assertSucceeds(guardarConSeg('t1', OE, listo, TOKEN_E, seg({ estado: 'listo' })));
    // Se vuelve a entregar: fecha de entrega nueva, pero el enlace NO se alarga.
    const otraVez = edicionE({ fechaEntrega: serverTimestamp(), expiraAt: enDias(38) });
    await assertFails(guardarConSeg('t1', OE, otraVez, TOKEN_E, seg({ expiraAt: enDias(29) })));
    await assertSucceeds(guardarConSeg('t1', OE, otraVez, TOKEN_E, seg()));
  });
  it('nota de 200 como máximo; token con formato de 43 caracteres', async () => {
    await sembrar();
    await assertFails(guardarConSeg('t1', OE, edicionE({ notaSeguimiento: 'x'.repeat(201) }), TOKEN_E, seg({ nota: 'x'.repeat(201) })));
    await assertSucceeds(guardarConSeg('t1', OE, edicionE({ notaSeguimiento: 'x'.repeat(200) }), TOKEN_E, seg({ nota: 'x'.repeat(200) })));
    await assertFails(activarO('t1', { token: 'corto' }));
    await assertFails(activarO('t1', { token: 'E'.repeat(42) + '!' }));
  });
});

describe('activar el enlace', () => {
  it('con todo en regla se activa', async () => {
    await sembrar();
    await assertSucceeds(activarO('t1'));
  });
  it('bandera apagada o sin el campo: no', async () => {
    await sembrar({ config: { ...CONFIG, seguimientoHabilitado: false } });
    await assertFails(activarO('t1'));
    await sembrar({ config: sin(CONFIG, 'seguimientoHabilitado') });
    await assertFails(activarO('t1'));
  });
  it('Premium SIEMPRE: sin plan o vencido no, aunque requierePremium esté apagado', async () => {
    await sembrar({ config: { ...CONFIG, requierePremium: false }, tallerExtra: { plan: 'freemium' } });
    await assertFails(activarO('t1'));
    await sembrar({ config: { ...CONFIG, requierePremium: false }, tallerExtra: { premiumHasta: enDias(-1) } });
    await assertFails(activarO('t1'));
  });
  it('taller desactivado o términos viejos: no', async () => {
    await sembrar({ tallerExtra: { activo: false } });
    await assertFails(activarO('t1'));
    await sembrar({ tallerExtra: { aceptacionVersion: 'v0' } });
    await assertFails(activarO('t1'));
  });
  it('orden con aviso anterior (v2): no', async () => {
    await sembrar();
    const db = como('t1');
    const b = writeBatch(db);
    b.set(oref(db, OV), orden({ ...conCliente, creadoAt: CREADO, avisoVersion: V2, seguimientoToken: TOKEN_N }));
    b.set(sref(db, TOKEN_N), seg({ folio: OV, estado: 'recibido', nota: '', expiraAt: enDias(88) }));
    await assertFails(b.commit());
  });
  it('otro taller no puede activar el enlace de una orden ajena', async () => {
    await sembrar();
    await assertFails(activarO('t2'));
  });
  it('el enlace solo lleva los campos públicos y debe coincidir con la orden y el taller', async () => {
    await sembrar();
    await assertFails(activarO('t1', { seguimiento: { placas: 'ABC1234' } }));
    await assertFails(activarO('t1', { seguimiento: { cliente: 'Juan' } }));
    await assertFails(activarO('t1', { seguimiento: { estado: 'listo' } }));
    await assertFails(activarO('t1', { seguimiento: { marca: 'Ford' } }));
    await assertFails(activarO('t1', { seguimiento: { tallerNombre: 'Otro' } }));
    await assertFails(activarO('t1', { seguimiento: { tallerWhatsapp: '6640000000' } }));
    await assertFails(activarO('t1', { seguimiento: { nota: 'algo' } }));
    await assertFails(activarO('t1', { seguimiento: { expiraAt: enDias(90) } }));    // más que la orden
    await assertFails(activarO('t1', { seguimiento: { actualizadoAt: new Date() } }));
    // Falta un campo obligatorio (lote armado a mano: activarO completaría el cuerpo).
    const db = como('t1');
    const b = writeBatch(db);
    b.set(oref(db, O), edicionO({ seguimientoToken: TOKEN_N }));
    b.set(sref(db, TOKEN_N), sin(seg({ folio: O, estado: 'recibido', nota: '', expiraAt: enDias(88) }), 'tallerWhatsapp'));
    await assertFails(b.commit());
  });
  it('una entregada: el enlace vence a más tardar 30 días después de la primera entrega', async () => {
    await sembrar();
    await env.withSecurityRulesDisabled(async (c) => {
      await updateDoc(oref(c.firestore(), OE), { seguimientoToken: deleteField() });
      await deleteDoc(sref(c.firestore(), TOKEN_E));
    });
    await assertFails(guardarConSeg('t1', OE, edicionE({ seguimientoToken: TOKEN_N }), TOKEN_N, seg({ expiraAt: new Date(ENTREGA.getTime() + 31 * DIA) })));
    await assertSucceeds(guardarConSeg('t1', OE, edicionE({ seguimientoToken: TOKEN_N }), TOKEN_N, seg()));
  });
  it('la huella es el SHA-256 en minúsculas: en mayúsculas o de otro token, no', async () => {
    await sembrar();
    const db = como('t1');
    const b = writeBatch(db);
    b.set(oref(db, O), edicionO({ seguimientoToken: TOKEN_N }));
    b.set(doc(db, 'seguimientos', huella(TOKEN_N).toUpperCase()), seg({ folio: O, estado: 'recibido', nota: '', expiraAt: enDias(88) }));
    await assertFails(b.commit());
    const b2 = writeBatch(db);
    b2.set(oref(db, O), edicionO({ seguimientoToken: TOKEN_N }));
    b2.set(sref(db, TOKEN_N2), seg({ folio: O, estado: 'recibido', nota: '', expiraAt: enDias(88) }));
    await assertFails(b2.commit());
  });
  it('un enlace no se puede crear solo (sin poner el token en la orden en el mismo lote)', async () => {
    await sembrar();
    await assertFails(setDoc(sref(como('t1'), TOKEN_N), seg({ folio: O, estado: 'recibido', nota: '', expiraAt: enDias(88) })));
  });
  it('reactivar exige borrar el enlace anterior en el mismo lote', async () => {
    await sembrar();
    await assertFails(guardarConSeg('t1', OE, edicionE({ seguimientoToken: TOKEN_N }), TOKEN_N, seg()));
  });
});

describe('mantenerlo al día', () => {
  it('guardar la orden sin reescribir su enlace activo: no', async () => {
    await sembrar();
    await assertFails(setDoc(oref(como('t1'), OE), edicionE({ observaciones: 'lavado' })));
  });
  it('sin Premium (requierePremium apagado) sí se mantiene: el enlace no pide Premium al actualizarse', async () => {
    await sembrar({ config: { ...CONFIG, requierePremium: false }, tallerExtra: { plan: 'freemium' } });
    await assertSucceeds(guardarConSeg('t1', OE, edicionE({ notaSeguimiento: 'Garantía vigente' }), TOKEN_E, seg({ nota: 'Garantía vigente' })));
  });
  it('con la bandera apagada, un enlace que ya existía se sigue manteniendo', async () => {
    await sembrar({ config: { ...CONFIG, seguimientoHabilitado: false } });
    await assertSucceeds(guardarConSeg('t1', OE, edicionE({ notaSeguimiento: '' }), TOKEN_E, seg({ nota: '' })));
  });
  it('si el taller cambia su nombre, el enlace copia el nuevo', async () => {
    await sembrar();
    await conTaller({ nombre: 'Taller Peña e Hijos' });
    await assertFails(guardarConSeg('t1', OE, edicionE(), TOKEN_E, seg()));
    await assertSucceeds(guardarConSeg('t1', OE, edicionE(), TOKEN_E, seg({ tallerNombre: 'Taller Peña e Hijos' })));
  });
  it('"Quitar datos del cliente" funciona con el enlace activo (el enlace no tiene datos del cliente)', async () => {
    await sembrar();
    await assertSucceeds(updateDoc(oref(como('t1'), OE), { cliente: {}, 'vehiculo.placas': deleteField(), actualizadoAt: serverTimestamp() }));
  });
});

describe('desactivar el enlace', () => {
  it('el dueño lo borra sin Premium, con términos viejos y con el taller desactivado', async () => {
    await sembrar({ tallerExtra: { plan: 'freemium', aceptacionVersion: 'v0', activo: false } });
    await assertSucceeds(deleteDoc(sref(como('t1'), TOKEN_E)));
    if (await existe(['seguimientos', huella(TOKEN_E)])) throw new Error('el enlace debía borrarse');
  });
  it('otro taller no; el admin sí; uno que ya no existe, sin error', async () => {
    await sembrar();
    await assertFails(deleteDoc(sref(como('t2'), TOKEN_E)));
    await assertSucceeds(deleteDoc(sref(como('adm'), TOKEN_E)));
    await assertSucceeds(deleteDoc(sref(como('t1'), TOKEN_E)));
  });
  it('desactivado, la orden se vuelve a guardar sola (no queda bloqueada)', async () => {
    await sembrar();
    await assertSucceeds(deleteDoc(sref(como('t1'), TOKEN_E)));
    await assertSucceeds(setDoc(oref(como('t1'), OE), edicionE({ observaciones: 'lavado' })));
  });
  it('quitar el token de la orden solo si su enlace ya no existe', async () => {
    await sembrar();
    await assertFails(setDoc(oref(como('t1'), OE), sin(edicionE(), 'seguimientoToken')));
    await assertSucceeds(deleteDoc(sref(como('t1'), TOKEN_E)));
    await assertSucceeds(setDoc(oref(como('t1'), OE), sin(edicionE(), 'seguimientoToken')));
  });
});

describe('quién lee', () => {
  it('servicio y admin leen uno; el dueño el suyo; nadie más', async () => {
    await sembrar();
    await assertSucceeds(getDoc(sref(como('srv'), TOKEN_E)));
    await assertSucceeds(getDoc(sref(como('adm'), TOKEN_E)));
    await assertSucceeds(getDoc(sref(como('t1'), TOKEN_E)));
    await assertFails(getDoc(sref(como('t2'), TOKEN_E)));
    await assertFails(getDoc(sref(como(null), TOKEN_E)));
  });
  it('listar: solo el admin (el servicio no puede recorrer la colección)', async () => {
    await sembrar();
    await assertFails(getDocs(collection(como('srv'), 'seguimientos')));
    await assertFails(getDocs(collection(como('t1'), 'seguimientos')));
    await assertSucceeds(getDocs(collection(como('adm'), 'seguimientos')));
  });
  it('uno que no existe: con sesión se sabe que no existe; sin sesión, no', async () => {
    await sembrar();
    await assertSucceeds(getDoc(sref(como('t2'), TOKEN_N)));
    await assertFails(getDoc(sref(como(null), TOKEN_N)));
  });
  it('el servicio NO lee órdenes ni talleres', async () => {
    await sembrar();
    await assertFails(getDoc(oref(como('srv'), OE)));
    await assertFails(getDoc(doc(como('srv'), 'talleres', 'T1')));
  });
});

describe('borrar la orden', () => {
  it('con enlace activo: sola no; en lote con su enlace sí', async () => {
    await sembrar();
    await assertFails(deleteDoc(oref(como('t1'), OE)));
    const db = como('t1');
    const b = writeBatch(db);
    b.delete(oref(db, OE));
    b.delete(sref(db, TOKEN_E));
    await assertSucceeds(b.commit());
  });
  it('con el enlace ya desactivado, o sin enlace, se borra sola como siempre', async () => {
    await sembrar();
    await assertSucceeds(deleteDoc(oref(como('t1'), O)));
    await assertSucceeds(deleteDoc(sref(como('t1'), TOKEN_E)));
    await assertSucceeds(deleteDoc(oref(como('t1'), OE)));
  });
});
