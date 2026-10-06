// Pruebas de reglas de Firestore para cotizaciones del taller.
// Estructura: talleres/{id}/cotizaciones/{folio} (datos y total en centavos)
//             talleres/{id}/cotizaciones/{folio}/renglones/{0..19} (cada renglón)
// Corren contra el emulador con el archivo real ../../firestore.rules.
// Comando (desde la raíz del repo):  npm run test:rules
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, collection, setDoc, updateDoc, getDoc, getDocs, deleteDoc, query, where, orderBy, limit, writeBatch, serverTimestamp } from 'firebase/firestore';

const reglas = readFileSync(new URL('../../firestore.rules', import.meta.url), 'utf8');
let env;

const FOLIO = 'C251006-7KQ4';

async function sembrar() {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    const aceptacion = { version: 'prueba', fecha: new Date() };
    await setDoc(doc(db, 'usuarios', 'adm'), { rol: 'admin', email: 'admin@prueba.mx' });
    await setDoc(doc(db, 'yonkes', 'Y1'), { nombre: 'Yonke uno', activo: true, ownerUid: 'y1' });
    await setDoc(doc(db, 'usuarios', 'y1'), { rol: 'yonke', yonkeId: 'Y1', email: 'y1@prueba.mx', fechaRegistro: new Date() });
    await setDoc(doc(db, 'talleres', 'T1'), { nombre: 'Taller uno', whatsapp: '6641234567', ciudad: 'Tijuana', logoUrl: '', ownerUid: 't1', activo: true, creadoAt: new Date(), aceptacionLegal: aceptacion });
    await setDoc(doc(db, 'usuarios', 't1'), { rol: 'taller', tallerId: 'T1', email: 't1@prueba.mx', fechaRegistro: new Date() });
    await setDoc(doc(db, 'talleres', 'T2'), { nombre: 'Taller dos', whatsapp: '6649999999', ciudad: 'Ensenada', logoUrl: '', ownerUid: 't2', activo: true, creadoAt: new Date(), aceptacionLegal: aceptacion });
    await setDoc(doc(db, 'usuarios', 't2'), { rol: 'taller', tallerId: 'T2', email: 't2@prueba.mx', fechaRegistro: new Date() });
    await setDoc(doc(db, 'talleres', 'T3'), { nombre: 'Taller desactivado', whatsapp: '6648888888', ciudad: 'Mexicali', logoUrl: '', ownerUid: 't3', activo: false, creadoAt: new Date(), aceptacionLegal: aceptacion });
    await setDoc(doc(db, 'usuarios', 't3'), { rol: 'taller', tallerId: 'T3', email: 't3@prueba.mx', fechaRegistro: new Date() });
    // Cotización existente de T1 con 3 renglones, y una de T3 (taller desactivado)
    await escribirCotizacionConRenglones(db, 'T1', 'C251006-AAAA', 3);
    await escribirCotizacionConRenglones(db, 'T3', 'C251006-BBBB', 1);
  });
}

function cotizacion(tallerId, extra = {}) {
  return {
    tallerId,
    estado: 'borrador',
    archivada: false,
    cliente: { nombre: 'Juan Pérez', telefono: '6641234567' },
    vehiculo: { marca: 'Nissan', modelo: 'Sentra', anio: 2001, placas: 'ABC123', kilometraje: 150000 },
    observaciones: 'Incluye mano de obra',
    vigenciaDias: 15,
    totalCentavos: 0,
    numRenglones: 1,
    creadoAt: serverTimestamp(),
    actualizadoAt: serverTimestamp(),
    ...extra,
  };
}
const renglon = (extra = {}) => ({ tipo: 'manoObra', descripcion: 'Cambio de balatas', cantidad: 1, precioUnitario: 500, ...extra });
const renglones = (n) => Array.from({ length: n }, (_, i) => renglon({ descripcion: `Renglón ${i + 1}` }));

async function escribirCotizacionConRenglones(db, tallerId, folio, n) {
  await setDoc(doc(db, 'talleres', tallerId, 'cotizaciones', folio), {
    tallerId, estado: 'borrador', archivada: false, cliente: { nombre: 'Ana' },
    vehiculo: { marca: 'Nissan', modelo: 'Sentra', anio: 2001 }, observaciones: '', vigenciaDias: 15,
    totalCentavos: 50000 * n, numRenglones: n, creadoAt: new Date(), actualizadoAt: new Date(),
  });
  for (let i = 0; i < n; i++) {
    await setDoc(doc(db, 'talleres', tallerId, 'cotizaciones', folio, 'renglones', String(i)), renglon());
  }
}

const como = (uid) => (uid ? env.authenticatedContext(uid).firestore() : env.unauthenticatedContext().firestore());
const cot = (uid, tallerId, folio = FOLIO) => doc(como(uid), 'talleres', tallerId, 'cotizaciones', folio);
const ren = (uid, tallerId, numero, folio = FOLIO) => doc(como(uid), 'talleres', tallerId, 'cotizaciones', folio, 'renglones', String(numero));
const colRenglones = (uid, tallerId, folio = FOLIO) => collection(como(uid), 'talleres', tallerId, 'cotizaciones', folio, 'renglones');

// Una edición debe conservar el creadoAt original (la regla lo compara). La app hace lo mismo.
async function creadoAtDe(uid, tallerId, folio = FOLIO) {
  const snap = await getDoc(cot(uid, tallerId, folio));
  return snap.data().creadoAt;
}

// Guarda una cotización con sus renglones en UN lote, como hace la app.
// borrar = números de renglón a eliminar (los que sobran al editar).
async function guardarLote(uid, tallerId, folio, datosCot, lista, borrar = []) {
  const db = como(uid);
  const lote = writeBatch(db);
  lote.set(doc(db, 'talleres', tallerId, 'cotizaciones', folio), datosCot);
  lista.forEach((r, i) => lote.set(doc(db, 'talleres', tallerId, 'cotizaciones', folio, 'renglones', String(i)), r));
  borrar.forEach((i) => lote.delete(doc(db, 'talleres', tallerId, 'cotizaciones', folio, 'renglones', String(i))));
  await lote.commit();
}

before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-cotizaciones',
    firestore: { rules: reglas, host: '127.0.0.1', port: 8181 },
  });
});
after(async () => { await env.cleanup(); });

describe('guardado en lote (cotización + renglones)', () => {
  it('guarda una cotización con 1 renglón en un lote', async () => {
    await sembrar();
    await assertSucceeds(guardarLote('t1', 'T1', 'C251006-NUEV', cotizacion('T1', { totalCentavos: 50000, numRenglones: 1 }), renglones(1)));
  });
  it('lote REAL de 21 documentos (cotización + 20 renglones) con el dueño', async () => {
    await sembrar();
    await assertSucceeds(guardarLote('t1', 'T1', 'C251006-V20A', cotizacion('T1', { totalCentavos: 1000000, numRenglones: 20 }), renglones(20)));
    const snap = await getDocs(colRenglones('t1', 'T1', 'C251006-V20A'));
    assert.equal(snap.size, 20);
  });
  it('editar con MENOS renglones borra los sobrantes (3 -> 1)', async () => {
    await sembrar();
    const creadoAt = await creadoAtDe('t1', 'T1', 'C251006-AAAA');
    await assertSucceeds(guardarLote('t1', 'T1', 'C251006-AAAA', cotizacion('T1', { totalCentavos: 50000, numRenglones: 1, creadoAt }), renglones(1), [1, 2]));
    const snap = await getDocs(colRenglones('t1', 'T1', 'C251006-AAAA'));
    assert.equal(snap.size, 1);
  });
  it('editar con MÁS renglones agrega los nuevos (3 -> 8)', async () => {
    await sembrar();
    const creadoAt = await creadoAtDe('t1', 'T1', 'C251006-AAAA');
    await assertSucceeds(guardarLote('t1', 'T1', 'C251006-AAAA', cotizacion('T1', { totalCentavos: 400000, numRenglones: 8, creadoAt }), renglones(8)));
    const snap = await getDocs(colRenglones('t1', 'T1', 'C251006-AAAA'));
    assert.equal(snap.size, 8);
  });
  it('si UN renglón del lote es inválido, no se escribe nada (todo o nada)', async () => {
    await sembrar();
    const malo = [...renglones(20)];
    malo[7] = renglon({ precioUnitario: -5 });
    await assertFails(guardarLote('t1', 'T1', 'C251006-ATOM', cotizacion('T1', { totalCentavos: 0, numRenglones: 20 }), malo));
    const existe = await getDoc(cot('t1', 'T1', 'C251006-ATOM'));
    assert.equal(existe.exists(), false);
  });
  it('un lote de edición nunca supera 21 operaciones (20 renglones + 1 cotización)', async () => {
    await sembrar();
    // 20 renglones a 1: se escriben 1 + cotización y se borran 19 sobrantes => 21 operaciones
    const creadoAt = await creadoAtDe('t1', 'T1', 'C251006-AAAA');
    await assertSucceeds(guardarLote('t1', 'T1', 'C251006-AAAA', cotizacion('T1', { totalCentavos: 1, numRenglones: 1, creadoAt }), renglones(1), Array.from({ length: 19 }, (_, i) => i + 1)));
  });
});

describe('renglones: nombres y límites', () => {
  it('acepta nombres 0 y 19', async () => {
    await sembrar();
    await assertSucceeds(setDoc(ren('t1', 'T1', 0), renglon()));
    await assertSucceeds(setDoc(ren('t1', 'T1', 19), renglon()));
  });
  for (const nombre of ['20', '-1', '01', '100', 'a', '1a']) {
    it(`rechaza el renglón con nombre "${nombre}"`, async () => {
      await sembrar();
      await assertFails(setDoc(doc(como('t1'), 'talleres', 'T1', 'cotizaciones', FOLIO, 'renglones', nombre), renglon()));
    });
  }
  it('rechaza precio negativo', async () => {
    await sembrar();
    await assertFails(setDoc(ren('t1', 'T1', 0), renglon({ precioUnitario: -1 })));
  });
  it('rechaza precio por encima del tope', async () => {
    await sembrar();
    await assertFails(setDoc(ren('t1', 'T1', 0), renglon({ precioUnitario: 1000001 })));
  });
  it('rechaza cantidad cero y con decimales', async () => {
    await sembrar();
    await assertFails(setDoc(ren('t1', 'T1', 0), renglon({ cantidad: 0 })));
    await assertFails(setDoc(ren('t1', 'T1', 0), renglon({ cantidad: 1.5 })));
  });
  it('rechaza descripción vacía o de 201 letras', async () => {
    await sembrar();
    await assertFails(setDoc(ren('t1', 'T1', 0), renglon({ descripcion: '' })));
    await assertFails(setDoc(ren('t1', 'T1', 0), renglon({ descripcion: 'a'.repeat(201) })));
  });
  it('rechaza tipo inválido y campos extra', async () => {
    await sembrar();
    await assertFails(setDoc(ren('t1', 'T1', 0), renglon({ tipo: 'otro' })));
    await assertFails(setDoc(ren('t1', 'T1', 0), renglon({ yonkeId: 'Y1' })));
  });
  it('acepta precios con decimales (la app los redondea a centavos)', async () => {
    await sembrar();
    await assertSucceeds(setDoc(ren('t1', 'T1', 0), renglon({ precioUnitario: 0.3 })));
  });
  it('el dueño puede borrar sus renglones', async () => {
    await sembrar();
    await assertSucceeds(deleteDoc(ren('t1', 'T1', 0, 'C251006-AAAA')));
  });
});

describe('cotización: datos y total', () => {
  it('crea una cotización válida', async () => {
    await sembrar();
    await assertSucceeds(setDoc(cot('t1', 'T1', 'C251006-OK01'), cotizacion('T1')));
  });
  it('rechaza total negativo y número de renglones fuera de 1 a 20', async () => {
    await sembrar();
    await assertFails(setDoc(cot('t1', 'T1', 'C251006-BAD1'), cotizacion('T1', { totalCentavos: -1 })));
    await assertFails(setDoc(cot('t1', 'T1', 'C251006-BAD2'), cotizacion('T1', { numRenglones: 0 })));
    await assertFails(setDoc(cot('t1', 'T1', 'C251006-BAD3'), cotizacion('T1', { numRenglones: 21 })));
  });
  it('rechaza un total con decimales (se guarda en centavos enteros)', async () => {
    await sembrar();
    await assertFails(setDoc(cot('t1', 'T1', 'C251006-BAD4'), cotizacion('T1', { totalCentavos: 10.5 })));
  });
  it('rechaza campos extra, como la lista de renglones antigua', async () => {
    await sembrar();
    await assertFails(setDoc(cot('t1', 'T1', 'C251006-BAD5'), cotizacion('T1', { renglones: [renglon()] })));
  });
  it('rechaza estado, año, vigencia y observaciones inválidos', async () => {
    await sembrar();
    await assertFails(setDoc(cot('t1', 'T1', 'C251006-BAD6'), cotizacion('T1', { estado: 'pagada' })));
    await assertFails(setDoc(cot('t1', 'T1', 'C251006-BAD7'), cotizacion('T1', { vehiculo: { marca: 'N', modelo: 'S', anio: 1800 } })));
    await assertFails(setDoc(cot('t1', 'T1', 'C251006-BAD8'), cotizacion('T1', { vigenciaDias: 91 })));
    await assertFails(setDoc(cot('t1', 'T1', 'C251006-BAD9'), cotizacion('T1', { observaciones: 'a'.repeat(1001) })));
  });
  it('rechaza un folio en minúsculas', async () => {
    await sembrar();
    await assertFails(setDoc(cot('t1', 'T1', 'c251006-min1'), cotizacion('T1')));
  });
  it('rechaza un segundo documento con el mismo folio', async () => {
    await sembrar();
    await assertSucceeds(setDoc(cot('t1', 'T1', 'C251006-SAME'), cotizacion('T1')));
    await assertFails(setDoc(cot('t1', 'T1', 'C251006-SAME'), cotizacion('T1')));
  });
  it('archiva (no borra)', async () => {
    await sembrar();
    await assertSucceeds(updateDoc(cot('t1', 'T1', 'C251006-AAAA'), { archivada: true, actualizadoAt: serverTimestamp() }));
  });
  it('quita los datos del cliente y las placas', async () => {
    await sembrar();
    await assertSucceeds(updateDoc(cot('t1', 'T1', 'C251006-AAAA'), {
      cliente: {}, vehiculo: { marca: 'Nissan', modelo: 'Sentra', anio: 2001 }, actualizadoAt: serverTimestamp(),
    }));
  });
  it('no puede cambiar tallerId ni la fecha de creación', async () => {
    await sembrar();
    await assertFails(updateDoc(cot('t1', 'T1', 'C251006-AAAA'), { tallerId: 'T2', actualizadoAt: serverTimestamp() }));
    await assertFails(updateDoc(cot('t1', 'T1', 'C251006-AAAA'), { creadoAt: serverTimestamp(), actualizadoAt: serverTimestamp() }));
  });
  it('la lista de activas (20 por página) funciona y usa el total guardado', async () => {
    await sembrar();
    const q = query(collection(como('t1'), 'talleres', 'T1', 'cotizaciones'), where('archivada', '==', false), orderBy('actualizadoAt', 'desc'), limit(20));
    const snap = await getDocs(q);
    assert.ok(snap.size >= 1);
    assert.equal(typeof snap.docs[0].data().totalCentavos, 'number');
  });
});

describe('ajenos, roles y taller desactivado', () => {
  it('otro taller no lee cotizaciones ni renglones de T1', async () => {
    await sembrar();
    await assertFails(getDoc(cot('t2', 'T1', 'C251006-AAAA')));
    await assertFails(getDoc(ren('t2', 'T1', 0, 'C251006-AAAA')));
  });
  it('otro taller no escribe ni borra renglones de T1', async () => {
    await sembrar();
    await assertFails(setDoc(ren('t2', 'T1', 5, 'C251006-AAAA'), renglon()));
    await assertFails(deleteDoc(ren('t2', 'T1', 0, 'C251006-AAAA')));
  });
  it('otro taller no crea cotizaciones en T1', async () => {
    await sembrar();
    await assertFails(setDoc(cot('t2', 'T1', 'C251006-XXXX'), cotizacion('T1')));
  });
  it('yonke no lee, no escribe y no borra renglones ni cotizaciones de un taller', async () => {
    await sembrar();
    await assertFails(getDoc(cot('y1', 'T1', 'C251006-AAAA')));
    await assertFails(getDoc(ren('y1', 'T1', 0, 'C251006-AAAA')));
    await assertFails(setDoc(ren('y1', 'T1', 0, 'C251006-AAAA'), renglon()));
    await assertFails(deleteDoc(ren('y1', 'T1', 0, 'C251006-AAAA')));
  });
  it('visitante sin sesión no lee ni escribe', async () => {
    await sembrar();
    await assertFails(getDoc(cot(null, 'T1', 'C251006-AAAA')));
    await assertFails(setDoc(cot(null, 'T1', 'C251006-XXXX'), cotizacion('T1')));
  });
  it('taller desactivado no crea cotizaciones ni renglones', async () => {
    await sembrar();
    await assertFails(setDoc(cot('t3', 'T3', 'C251006-NUEV'), cotizacion('T3')));
    await assertFails(setDoc(ren('t3', 'T3', 0, 'C251006-BBBB'), renglon()));
  });
  it('taller desactivado no edita cotizaciones ni renglones', async () => {
    await sembrar();
    await assertFails(updateDoc(cot('t3', 'T3', 'C251006-BBBB'), { observaciones: 'x', actualizadoAt: serverTimestamp() }));
    await assertFails(setDoc(ren('t3', 'T3', 0, 'C251006-BBBB'), renglon({ precioUnitario: 1 })));
  });
  it('taller desactivado sí lee sus cotizaciones y renglones', async () => {
    await sembrar();
    await assertSucceeds(getDoc(cot('t3', 'T3', 'C251006-BBBB')));
    await assertSucceeds(getDoc(ren('t3', 'T3', 0, 'C251006-BBBB')));
  });
  it('el taller no puede borrar la cotización completa', async () => {
    await sembrar();
    await assertFails(deleteDoc(cot('t1', 'T1', 'C251006-AAAA')));
  });
});

describe('admin', () => {
  it('lee cotizaciones y renglones de cualquier taller', async () => {
    await sembrar();
    await assertSucceeds(getDoc(cot('adm', 'T1', 'C251006-AAAA')));
    await assertSucceeds(getDoc(ren('adm', 'T1', 2, 'C251006-AAAA')));
  });
  it('borra una cotización completa en un lote: primero sus renglones, luego la cotización', async () => {
    await sembrar();
    const db = como('adm');
    const lote = writeBatch(db);
    for (let i = 0; i < 3; i++) lote.delete(doc(db, 'talleres', 'T1', 'cotizaciones', 'C251006-AAAA', 'renglones', String(i)));
    lote.delete(doc(db, 'talleres', 'T1', 'cotizaciones', 'C251006-AAAA'));
    await assertSucceeds(lote.commit());
    const restos = await getDocs(colRenglones('adm', 'T1', 'C251006-AAAA'));
    assert.equal(restos.size, 0);
  });
});
