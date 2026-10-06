// Pruebas de reglas de Firestore para cotizaciones del taller.
// Estructura: talleres/{id}/cotizaciones/{folio} (datos, total en centavos, expiraAt, avisoVersion)
//             talleres/{id}/cotizaciones/{folio}/renglones/{0..19} (cada renglón con el mismo expiraAt)
// Versión de términos y bandera de datos del cliente: config/cotizaciones.
// Corren contra el emulador con el archivo real ../../firestore.rules.
// Comando (desde la raíz del repo):  npm run test:rules
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, collection, setDoc, updateDoc, getDoc, getDocs, deleteDoc, writeBatch, serverTimestamp } from 'firebase/firestore';

const reglas = readFileSync(new URL('../../firestore.rules', import.meta.url), 'utf8');
let env;
const DIA = 86400000;
const ahora = () => Date.now();
const expiraNueva = () => new Date(ahora() + 88 * DIA);      // lo que pone la app al crear
const expiraVencida = () => new Date(ahora() - DIA);
const expiraFutura = () => new Date(ahora() + 80 * DIA);     // cotización ya existente en el seed
const C = 'C251006-7KQ4';
const C2 = 'C251006-BBBB';

async function sembrar({ config = true, versionTaller = 'v1' } = {}) {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    if (config) await setDoc(doc(db, 'config', 'cotizaciones'), { terminosVersion: 'v1', avisoTallerVersion: 'aviso-1', datosClienteHabilitados: true, resumenCambios: 'x' });
    await setDoc(doc(db, 'usuarios', 'adm'), { rol: 'admin', email: 'a@x.mx' });
    await setDoc(doc(db, 'usuarios', 'y1'), { rol: 'yonke', yonkeId: 'Y1', email: 'y@x.mx' });
    await setDoc(doc(db, 'yonkes', 'Y1'), { nombre: 'Yonke', activo: true, ownerUid: 'y1' });
    await setDoc(doc(db, 'talleres', 'T1'), taller('t1', true, versionTaller));
    await setDoc(doc(db, 'usuarios', 't1'), { rol: 'taller', tallerId: 'T1', email: 't1@x.mx' });
    await setDoc(doc(db, 'talleres', 'T2'), taller('t2', true, versionTaller));
    await setDoc(doc(db, 'usuarios', 't2'), { rol: 'taller', tallerId: 'T2', email: 't2@x.mx' });
    await setDoc(doc(db, 'talleres', 'T3'), taller('t3', false, versionTaller));
    await setDoc(doc(db, 'usuarios', 't3'), { rol: 'taller', tallerId: 'T3', email: 't3@x.mx' });
    await escribirCotizacion(db, 'T1', C, 2);
    await escribirCotizacion(db, 'T3', C2, 1);
  });
}

function taller(owner, activo, version) {
  return {
    nombre: 'Taller', whatsapp: '6641234567', ciudad: 'Tijuana', logoUrl: '', ownerUid: owner, activo,
    creadoAt: new Date(), aceptacionVersion: version,
    avisoPrivacidad: { modo: 'generado', versionPlantilla: 'aviso-1', fecha: new Date() },
  };
}

function cot(tallerId, extra = {}) {
  return {
    tallerId, estado: 'borrador', archivada: false,
    cliente: { nombre: 'Juan Pérez', telefono: '6641234567' },
    vehiculo: { marca: 'Nissan', modelo: 'Sentra', anio: 2001, placas: 'ABC123', kilometraje: 150000 },
    observaciones: 'Incluye mano de obra', vigenciaDias: 15,
    totalCentavos: 100000, numRenglones: 1,
    creadoAt: serverTimestamp(), actualizadoAt: serverTimestamp(),
    expiraAt: expiraNueva(), avisoVersion: 'aviso-1',
    ...extra,
  };
}
const renglon = (exp, extra = {}) => ({ tipo: 'manoObra', descripcion: 'Cambio de balatas', cantidad: 1, precioUnitario: 500, expiraAt: exp, ...extra });

async function escribirCotizacion(db, tallerId, folio, n) {
  const exp = expiraFutura();
  await setDoc(doc(db, 'talleres', tallerId, 'cotizaciones', folio), {
    tallerId, estado: 'borrador', archivada: false, cliente: { nombre: 'Ana' },
    vehiculo: { marca: 'Nissan', modelo: 'Sentra', anio: 2001 }, observaciones: '', vigenciaDias: 15,
    totalCentavos: 50000 * n, numRenglones: n, creadoAt: new Date(ahora() - 5 * DIA), actualizadoAt: new Date(),
    expiraAt: exp, avisoVersion: 'aviso-1',
  });
  for (let i = 0; i < n; i++) {
    await setDoc(doc(db, 'talleres', tallerId, 'cotizaciones', folio, 'renglones', String(i)), renglon(exp));
  }
}

const como = (uid) => (uid ? env.authenticatedContext(uid).firestore() : env.unauthenticatedContext().firestore());
const cref = (uid, folio = C, tallerId = 'T1') => doc(como(uid), 'talleres', tallerId, 'cotizaciones', folio);
const rref = (uid, n, folio = C, tallerId = 'T1') => doc(como(uid), 'talleres', tallerId, 'cotizaciones', folio, 'renglones', String(n));
const expiraDe = async (uid, folio = C, tallerId = 'T1') => (await getDoc(doc(como(uid), 'talleres', tallerId, 'cotizaciones', folio))).data().expiraAt;
const colRenglones = (uid, folio = C, tallerId = 'T1') => collection(como(uid), 'talleres', tallerId, 'cotizaciones', folio, 'renglones');

// Lote como lo hace la app: cotización + renglones (+ borrado de sobrantes)
async function lote(uid, tallerId, folio, datos, renglones, expira, borrar = []) {
  const db = como(uid);
  const b = writeBatch(db);
  b.set(doc(db, 'talleres', tallerId, 'cotizaciones', folio), datos);
  renglones.forEach((r, i) => b.set(doc(db, 'talleres', tallerId, 'cotizaciones', folio, 'renglones', String(i)), renglon(expira, r)));
  borrar.forEach((i) => b.delete(doc(db, 'talleres', tallerId, 'cotizaciones', folio, 'renglones', String(i))));
  await b.commit();
}

async function conVersion(v) {
  await env.withSecurityRulesDisabled(async (c) => { await updateDoc(doc(c.firestore(), 'config', 'cotizaciones'), { terminosVersion: v }); });
}
async function conBandera(valor) {
  await env.withSecurityRulesDisabled(async (c) => { await updateDoc(doc(c.firestore(), 'config', 'cotizaciones'), { datosClienteHabilitados: valor }); });
}
async function conActivo(tallerId, valor) {
  await env.withSecurityRulesDisabled(async (c) => { await updateDoc(doc(c.firestore(), 'talleres', tallerId), { activo: valor }); });
}

before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-cotizaciones',
    firestore: { rules: reglas, host: '127.0.0.1', port: 8181 },
  });
});
after(async () => { await env.cleanup(); });

describe('taller activo y con versión vigente', () => {
  it('crea una cotización válida', async () => {
    await sembrar();
    await assertSucceeds(setDoc(cref('t1', 'C251006-NEW1'), cot('T1')));
  });
  it('edita una cotización propia (cambia observaciones y fecha de actualización)', async () => {
    await sembrar();
    await assertSucceeds(updateDoc(cref('t1'), { observaciones: 'nueva', actualizadoAt: serverTimestamp() }));
  });
  it('archiva una cotización propia (la marca, no la borra)', async () => {
    await sembrar();
    await assertSucceeds(updateDoc(cref('t1'), { archivada: true, actualizadoAt: serverTimestamp() }));
  });
  it('lee sus cotizaciones', async () => {
    await sembrar();
    await assertSucceeds(getDoc(cref('t1')));
  });
  it('lote REAL de 21 documentos (cotización + 20 renglones) pasa', async () => {
    await sembrar();
    const exp = expiraNueva();
    const renglones20 = Array.from({ length: 20 }, (_, i) => ({ descripcion: `Renglón ${i + 1}` }));
    await assertSucceeds(lote('t1', 'T1', 'C251006-L21A', cot('T1', { numRenglones: 20, totalCentavos: 1000000, expiraAt: exp }), renglones20, exp));
    const snap = await getDocs(colRenglones('t1', 'C251006-L21A'));
    assert.equal(snap.size, 20);
  });
  it('quitar 19 renglones en un lote (de 20 a 1) pasa', async () => {
    await sembrar();
    const exp = await expiraDe('t1');
    const creadoAt = (await getDoc(cref('t1'))).data().creadoAt;
    await assertSucceeds(lote('t1', 'T1', C, cot('T1', { numRenglones: 1, totalCentavos: 500, expiraAt: exp, creadoAt }), [{}], exp, [1]));
    const snap = await getDocs(colRenglones('t1'));
    assert.equal(snap.size, 1);
  });
  it('un lote con un renglón inválido no escribe nada (todo o nada)', async () => {
    await sembrar();
    const exp = expiraNueva();
    const mal = Array.from({ length: 5 }, () => ({}));
    mal[3] = { precioUnitario: -5 };
    await assertFails(lote('t1', 'T1', 'C251006-ATOM', cot('T1', { numRenglones: 5, expiraAt: exp }), mal, exp));
    const existe = await getDoc(cref('t1', 'C251006-ATOM'));
    assert.equal(existe.exists(), false);
  });
});

describe('taller desactivado', () => {
  it('no puede crear una cotización', async () => {
    await sembrar();
    await assertFails(setDoc(cref('t3', 'C251006-NUEV', 'T3'), cot('T3')));
  });
  it('no puede editar una cotización ni sus renglones', async () => {
    await sembrar();
    await assertFails(updateDoc(cref('t3', C2, 'T3'), { observaciones: 'x', actualizadoAt: serverTimestamp() }));
    await assertFails(setDoc(rref('t3', 0, C2, 'T3'), renglon(expiraFutura(), { precioUnitario: 1 })));
  });
  it('sí puede leer sus cotizaciones', async () => {
    await sembrar();
    await assertSucceeds(getDoc(cref('t3', C2, 'T3')));
  });
  it('sí puede quitar datos del cliente (excepción)', async () => {
    await sembrar();
    await assertSucceeds(updateDoc(cref('t3', C2, 'T3'), { cliente: {}, vehiculo: { marca: 'Nissan', modelo: 'Sentra', anio: 2001 }, actualizadoAt: serverTimestamp() }));
  });
});

describe('versión vieja: solo lectura, con la excepción de quitar datos', () => {
  it('crear y editar quedan bloqueados', async () => {
    await sembrar();
    await conVersion('v2');
    await assertFails(setDoc(cref('t1', 'C251006-OLD1'), cot('T1')));
    await assertFails(updateDoc(cref('t1'), { observaciones: 'nueva', actualizadoAt: serverTimestamp() }));
  });
  it('crear o editar renglones quedan bloqueados', async () => {
    await sembrar();
    await conVersion('v2');
    await assertFails(setDoc(rref('t1', 5), renglon(expiraFutura())));
    await assertFails(setDoc(rref('t1', 0), renglon(expiraFutura(), { precioUnitario: 9 })));
  });
  it('borrar renglones queda bloqueado', async () => {
    await sembrar();
    await conVersion('v2');
    await assertFails(deleteDoc(rref('t1', 1)));
  });
  it('quitar datos (vaciar cliente y placas) SÍ', async () => {
    await sembrar();
    await conVersion('v2');
    await assertSucceeds(updateDoc(cref('t1'), { cliente: {}, vehiculo: { marca: 'Nissan', modelo: 'Sentra', anio: 2001 }, actualizadoAt: serverTimestamp() }));
  });
  it('quitar datos + cambiar observaciones NO', async () => {
    await sembrar();
    await conVersion('v2');
    await assertFails(updateDoc(cref('t1'), { cliente: {}, vehiculo: { marca: 'Nissan', modelo: 'Sentra', anio: 2001 }, observaciones: 'x', actualizadoAt: serverTimestamp() }));
  });
  it('quitar datos + cambiar total NO', async () => {
    await sembrar();
    await conVersion('v2');
    await assertFails(updateDoc(cref('t1'), { cliente: {}, vehiculo: { marca: 'Nissan', modelo: 'Sentra', anio: 2001 }, totalCentavos: 1, actualizadoAt: serverTimestamp() }));
  });
  it('quitar datos + cambiar estado NO', async () => {
    await sembrar();
    await conVersion('v2');
    await assertFails(updateDoc(cref('t1'), { cliente: {}, vehiculo: { marca: 'Nissan', modelo: 'Sentra', anio: 2001 }, estado: 'cerrada', actualizadoAt: serverTimestamp() }));
  });
  it('quitar datos + cambiar fecha de creación o de expiración NO', async () => {
    await sembrar();
    await conVersion('v2');
    await assertFails(updateDoc(cref('t1'), { cliente: {}, vehiculo: { marca: 'Nissan', modelo: 'Sentra', anio: 2001 }, creadoAt: serverTimestamp(), actualizadoAt: serverTimestamp() }));
    await assertFails(updateDoc(cref('t1'), { cliente: {}, vehiculo: { marca: 'Nissan', modelo: 'Sentra', anio: 2001 }, expiraAt: expiraNueva(), actualizadoAt: serverTimestamp() }));
  });
  it('dejar un nombre de cliente NO', async () => {
    await sembrar();
    await conVersion('v2');
    await assertFails(updateDoc(cref('t1'), { cliente: { nombre: 'Juan' }, vehiculo: { marca: 'Nissan', modelo: 'Sentra', anio: 2001 }, actualizadoAt: serverTimestamp() }));
  });
  it('dejar las placas NO', async () => {
    await sembrar();
    await conVersion('v2');
    await assertFails(updateDoc(cref('t1'), { cliente: {}, vehiculo: { marca: 'Nissan', modelo: 'Sentra', anio: 2001, placas: 'ABC123' }, actualizadoAt: serverTimestamp() }));
  });
  it('cambiar la marca al quitar datos NO', async () => {
    await sembrar();
    await conVersion('v2');
    await assertFails(updateDoc(cref('t1'), { cliente: {}, vehiculo: { marca: 'Ford', modelo: 'Sentra', anio: 2001 }, actualizadoAt: serverTimestamp() }));
  });
  it('borrar la cotización completa (taller) NO', async () => {
    await sembrar();
    await conVersion('v2');
    await assertFails(deleteDoc(cref('t1')));
  });
  it('quitar datos de una cotización ajena NO', async () => {
    await sembrar();
    await conVersion('v2');
    await assertFails(updateDoc(cref('t2'), { cliente: {}, vehiculo: { marca: 'Nissan', modelo: 'Sentra', anio: 2001 }, actualizadoAt: serverTimestamp() }));
  });
  it('sin config/cotizaciones, quitar datos sigue permitido (la excepción no lee config)', async () => {
    await sembrar({ config: false });
    await assertSucceeds(updateDoc(cref('t1'), { cliente: {}, vehiculo: { marca: 'Nissan', modelo: 'Sentra', anio: 2001 }, actualizadoAt: serverTimestamp() }));
  });
});

describe('falla cerrada: falta config/cotizaciones', () => {
  it('crear una cotización NO', async () => {
    await sembrar({ config: false });
    await assertFails(setDoc(cref('t1', 'C251006-NOCF'), cot('T1')));
  });
  it('editar una cotización (normal) NO', async () => {
    await sembrar({ config: false });
    await assertFails(updateDoc(cref('t1'), { observaciones: 'x', actualizadoAt: serverTimestamp() }));
  });
});

describe('expiración de 88 días', () => {
  it('crear con expiración de 10 días NO', async () => {
    await sembrar();
    await assertFails(setDoc(cref('t1', 'C251006-EXP1'), cot('T1', { expiraAt: new Date(ahora() + 10 * DIA) })));
  });
  it('crear con expiración de 88 días SÍ (tolerancia de ±5 minutos)', async () => {
    await sembrar();
    await assertSucceeds(setDoc(cref('t1', 'C251006-EXP2'), cot('T1', { expiraAt: new Date(ahora() + 88 * DIA + 60000) })));
  });
  it('editar la expiración NO', async () => {
    await sembrar();
    await assertFails(updateDoc(cref('t1'), { expiraAt: expiraNueva(), actualizadoAt: serverTimestamp() }));
  });
  it('una cotización vencida no se puede editar', async () => {
    await env.clearFirestore();
    await env.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      await setDoc(doc(db, 'config', 'cotizaciones'), { terminosVersion: 'v1', avisoTallerVersion: 'aviso-1', datosClienteHabilitados: true });
      await setDoc(doc(db, 'talleres', 'T1'), taller('t1', true, 'v1'));
      await setDoc(doc(db, 'usuarios', 't1'), { rol: 'taller', tallerId: 'T1', email: 't1@x.mx' });
      await setDoc(doc(db, 'talleres', 'T1', 'cotizaciones', C), cot('T1', { expiraAt: expiraVencida() }));
    });
    await assertFails(updateDoc(cref('t1'), { observaciones: 'x', actualizadoAt: serverTimestamp() }));
  });
  it('un renglón con expiraAt distinto al de su cotización NO', async () => {
    await sembrar();
    await assertFails(setDoc(rref('t1', 5), renglon(new Date(ahora() + 3 * DIA))));
  });
  it('un renglón con expiraAt igual al de la cotización SÍ', async () => {
    await sembrar();
    const exp = (await getDoc(cref('t1'))).data().expiraAt;
    await assertSucceeds(setDoc(rref('t1', 5), renglon(exp)));
  });
});

describe('renglones: nombres, valores y límites', () => {
  it('acepta los nombres 0 y 19', async () => {
    await sembrar();
    const exp = await expiraDe('t1');
    await assertSucceeds(setDoc(rref('t1', 0), renglon(exp)));
    await assertSucceeds(setDoc(rref('t1', 19), renglon(exp)));
  });
  for (const nombre of ['20', '-1', '01', '100', 'a', '1a']) {
    it(`rechaza el renglón con nombre "${nombre}"`, async () => {
      await sembrar();
      await assertFails(setDoc(doc(como('t1'), 'talleres', 'T1', 'cotizaciones', C, 'renglones', nombre), renglon(expiraFutura())));
    });
  }
  it('rechaza precio negativo, precio por encima del tope, cantidad 0 y con decimales', async () => {
    await sembrar();
    await assertFails(setDoc(rref('t1', 0), renglon(expiraFutura(), { precioUnitario: -1 })));
    await assertFails(setDoc(rref('t1', 0), renglon(expiraFutura(), { precioUnitario: 1000001 })));
    await assertFails(setDoc(rref('t1', 0), renglon(expiraFutura(), { cantidad: 0 })));
    await assertFails(setDoc(rref('t1', 0), renglon(expiraFutura(), { cantidad: 1.5 })));
  });
  it('rechaza descripción vacía y campos extra en el renglón', async () => {
    await sembrar();
    await assertFails(setDoc(rref('t1', 0), renglon(expiraFutura(), { descripcion: '' })));
    await assertFails(setDoc(rref('t1', 0), renglon(expiraFutura(), { yonkeId: 'Y1' })));
  });
  it('acepta precios con decimales (0.1 y 0.3)', async () => {
    await sembrar();
    const exp = await expiraDe('t1');
    await assertSucceeds(setDoc(rref('t1', 0), renglon(exp, { precioUnitario: 0.1 })));
    await assertSucceeds(setDoc(rref('t1', 1), renglon(exp, { precioUnitario: 0.3 })));
  });
  it('el dueño puede borrar sus renglones (taller activo y versión vigente)', async () => {
    await sembrar();
    await assertSucceeds(deleteDoc(rref('t1', 1)));
  });
});

describe('datos de la cotización', () => {
  const casos = [
    ['vigencia de 61 días', { vigenciaDias: 61 }],
    ['vigencia de 0 días', { vigenciaDias: 0 }],
    ['estado inválido', { estado: 'pagada' }],
    ['año fuera de rango', { vehiculo: { marca: 'N', modelo: 'S', anio: 1800 } }],
    ['campo extra en el vehículo', { vehiculo: { marca: 'N', modelo: 'S', anio: 2001, color: 'rojo' } }],
    ['campo extra en el cliente', { cliente: { nombre: 'x', correo: 'x@x.mx' } }],
    ['teléfono con letras', { cliente: { telefono: 'abc' } }],
    ['placas de más de 12 caracteres', { vehiculo: { marca: 'N', modelo: 'S', anio: 2001, placas: 'ABCDEFGHIJKLM' } }],
    ['kilometraje negativo', { vehiculo: { marca: 'N', modelo: 'S', anio: 2001, kilometraje: -1 } }],
    ['total con decimales', { totalCentavos: 10.5 }],
    ['observaciones de 1001 caracteres', { observaciones: 'a'.repeat(1001) }],
    ['campo de la lista de renglones antigua', { renglones: [{}] }],
    ['avisoVersion distinto del aviso del taller', { avisoVersion: 'aviso-viejo' }],
    ['cambiar tallerId', { tallerId: 'T2' }],
  ];
  for (const [nombre, extra] of casos) {
    it(`rechaza: ${nombre}`, async () => {
      await sembrar();
      await assertFails(setDoc(cref('t1', 'C251006-BAD1'), cot('T1', extra)));
    });
  }
  it('rechaza un folio en minúsculas y un folio repetido', async () => {
    await sembrar();
    await assertFails(setDoc(cref('t1', 'c251006-min1'), cot('T1')));
    await assertSucceeds(setDoc(cref('t1', 'C251006-SAME'), cot('T1')));
    await assertFails(setDoc(cref('t1', 'C251006-SAME'), cot('T1')));
  });
  it('acepta vigencia de 60 días', async () => {
    await sembrar();
    await assertSucceeds(setDoc(cref('t1', 'C251006-V60A'), cot('T1', { vigenciaDias: 60 })));
  });
});

describe('bandera de datos del cliente', () => {
  it('apagada: nombre NO, placas NO, sin datos SÍ', async () => {
    await sembrar();
    await conBandera(false);
    await assertFails(setDoc(cref('t1', 'C251006-BF01'), cot('T1')));
    await assertFails(setDoc(cref('t1', 'C251006-BF02'), cot('T1', { cliente: {} })));
    await assertSucceeds(setDoc(cref('t1', 'C251006-BF03'), cot('T1', { cliente: {}, vehiculo: { marca: 'N', modelo: 'S', anio: 2001 } })));
  });
  it('encendida: nombre SÍ', async () => {
    await sembrar();
    await conBandera(true);
    await assertSucceeds(setDoc(cref('t1', 'C251006-BF04'), cot('T1')));
  });
});

describe('ajenos, roles y lectura', () => {
  it('otro taller no lee cotizaciones ni renglones de T1', async () => {
    await sembrar();
    await assertFails(getDoc(cref('t2')));
    await assertFails(getDoc(rref('t2', 0)));
  });
  it('otro taller no crea ni edita en T1', async () => {
    await sembrar();
    await assertFails(setDoc(cref('t2', 'C251006-XXXX'), cot('T1')));
    await assertFails(updateDoc(cref('t2'), { observaciones: 'x', actualizadoAt: serverTimestamp() }));
  });
  it('un yonke no lee ni escribe cotizaciones', async () => {
    await sembrar();
    await assertFails(getDoc(cref('y1')));
    await assertFails(setDoc(cref('y1', 'C251006-XXXX'), cot('T1')));
  });
  it('un visitante no lee ni escribe', async () => {
    await sembrar();
    await assertFails(getDoc(cref(null)));
    await assertFails(setDoc(cref(null, 'C251006-XXXX'), cot('T1')));
  });
  it('el admin lee cotizaciones y renglones de cualquier taller', async () => {
    await sembrar();
    await assertSucceeds(getDoc(cref('adm')));
    await assertSucceeds(getDoc(rref('adm', 0)));
  });
  it('el admin borra una cotización completa en un lote (renglones primero)', async () => {
    await sembrar();
    const db = como('adm');
    const b = writeBatch(db);
    for (let i = 0; i < 2; i++) b.delete(doc(db, 'talleres', 'T1', 'cotizaciones', C, 'renglones', String(i)));
    b.delete(doc(db, 'talleres', 'T1', 'cotizaciones', C));
    await assertSucceeds(b.commit());
  });
});

describe('taller activo: la app no debe mostrar vencidas, pero las reglas solo impiden editarlas', () => {
  it('la lista ordenada por expiración y filtrada por vigencia se puede consultar', async () => {
    await sembrar();
    const { query, where, orderBy, limit } = await import('firebase/firestore');
    const q = query(collection(como('t1'), 'talleres', 'T1', 'cotizaciones'), where('archivada', '==', false), where('expiraAt', '>', new Date()), orderBy('expiraAt', 'desc'), limit(20));
    await assertSucceeds(getDocs(q));
  });
});
