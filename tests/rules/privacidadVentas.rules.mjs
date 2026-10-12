// Pruebas de reglas: privacidad de ventas.
// - ventasPublicas/{folio}: copia sin datos personales para /calificar. Cualquiera lee UNA por folio
//   (get), nadie lista salvo el admin; el yonke dueño la crea junto con su venta; el admin la crea
//   (botón "Copiar ventas a públicas", seguro de repetir), la cambia o la borra.
// - yonkes/{id}/privado/*: solo el admin.
// - resenasPlataforma: públicas solo las aprobadas.
// - ventas: solo el yonke dueño y el admin la leen.
// Corren contra el emulador con el archivo real ../../firestore.rules (npm run test:rules).
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import {
  addDoc, collection, deleteDoc, deleteField, doc, getDoc, getDocs, query, setDoc, updateDoc, where, writeBatch,
} from 'firebase/firestore';

const reglas = readFileSync(new URL('../../firestore.rules', import.meta.url), 'utf8');
let env;

// Igual que src/lib/ventasPublicas.ts (idVentaPublica / datosVentaPublica): solo pieza, vehículo y yonke.
const idVentaPublica = (numeroPedido) => (typeof numeroPedido === 'string' ? numeroPedido.trim().toUpperCase().replace(/\//g, '-') || null : null);
const datosVentaPublica = (ventaId, v) => ({
  ventaId,
  yonkeId: v.yonkeId,
  piezaVendida: typeof v.piezaVendida === 'string' ? v.piezaVendida : null,
  vehiculo: v.vehiculo ? { marca: v.vehiculo.marca ?? null, modelo: v.vehiculo.modelo ?? null, ano: v.vehiculo.ano ?? null } : null,
});

const VENTA_Y1 = {
  reservaId: 'R1', yonkeId: 'Y1', numeroPedido: 'MYV-1011-1234', nombreCliente: 'Ana López', piezaVendida: 'Faro',
  vehiculo: { marca: 'Nissan', modelo: 'Sentra', ano: 2005 }, monto: 500, fecha: new Date(),
};

async function sembrar({ ventasExtra = 0 } = {}) {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'usuarios', 'adm'), { rol: 'admin', email: 'admin@prueba.mx' });
    await setDoc(doc(db, 'yonkes', 'Y1'), { nombre: 'Yonke uno', activo: true, ownerUid: 'o1', email: 'viejo@prueba.mx' });
    await setDoc(doc(db, 'usuarios', 'o1'), { rol: 'yonke', yonkeId: 'Y1', email: 'o1@prueba.mx' });
    await setDoc(doc(db, 'yonkes', 'Y2'), { nombre: 'Yonke dos', activo: true, ownerUid: 'o2' });
    await setDoc(doc(db, 'usuarios', 'o2'), { rol: 'yonke', yonkeId: 'Y2', email: 'o2@prueba.mx' });
    await setDoc(doc(db, 'ventas', 'V1'), VENTA_Y1);
    await setDoc(doc(db, 'ventas', 'V2'), { yonkeId: 'Y2', origen: 'manual', numeroPedido: 'VM-1011-5555', piezaVendida: 'Motor', monto: 9000, fecha: new Date() });
    await setDoc(doc(db, 'ventas', 'V3'), { yonkeId: 'Y1', numeroPedido: ' myv/1011/77 ', piezaVendida: 'Puerta', monto: 1, fecha: new Date() });
    await setDoc(doc(db, 'ventas', 'V4'), { yonkeId: 'Y2', piezaVendida: 'Sin folio', monto: 1, fecha: new Date() });
    for (let i = 0; i < ventasExtra; i++) {
      await setDoc(doc(db, 'ventas', `X${i}`), { yonkeId: i % 2 ? 'Y1' : 'Y2', numeroPedido: `MYV-0101-${1000 + i}`, nombreCliente: `Cliente ${i}`, piezaVendida: 'Pieza', monto: i, fecha: new Date() });
    }
    await setDoc(doc(db, 'yonkes', 'Y1', 'privado', 'contacto'), { email: 'o1-privado@prueba.mx' });
    await setDoc(doc(db, 'resenasPlataforma', 'RA'), { estrellas: 5, comentario: 'Bien', aprobada: true, fecha: new Date() });
    await setDoc(doc(db, 'resenasPlataforma', 'RN'), { estrellas: 1, comentario: 'Pendiente', aprobada: false, fecha: new Date() });
  });
}

const como = (uid) => (uid ? env.authenticatedContext(uid).firestore() : env.unauthenticatedContext().firestore());
const copiaRef = (uid, folio) => doc(como(uid), 'ventasPublicas', folio);
const sembrarCopia = (folio, datos) => env.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), 'ventasPublicas', folio), datos));

// Lo que hace hoy confirmar una reservación (src/app/panel/reservaciones/page.js): venta + copia en un lote.
function confirmarReservacion(uid, yonkeId, numeroPedido, extraCopia = {}) {
  const db = como(uid);
  const ventaRef = doc(collection(db, 'ventas'));
  const venta = { reservaId: 'R9', yonkeId, numeroPedido, nombreCliente: 'Luis', piezaVendida: 'Faro', vehiculo: { marca: 'Ford', modelo: 'Focus', ano: 2010 }, monto: 1, fecha: new Date() };
  const lote = writeBatch(db);
  lote.set(ventaRef, venta);
  lote.set(doc(db, 'ventasPublicas', idVentaPublica(numeroPedido)), { ...datosVentaPublica(ventaRef.id, venta), ...extraCopia });
  return lote.commit();
}

// Mismo código que respaldarVentasPublicas() en src/app/admin/page.js ("Copiar ventas a públicas").
async function copiarVentasAPublicas(uid) {
  const db = como(uid);
  const snap = await getDocs(collection(db, 'ventas'));
  let copiadas = 0, sinFolio = 0, enBatch = 0;
  let batch = writeBatch(db);
  for (const d of snap.docs) {
    const id = idVentaPublica(d.data().numeroPedido);
    if (!id || typeof d.data().yonkeId !== 'string') { sinFolio++; continue; }
    batch.set(doc(db, 'ventasPublicas', id), datosVentaPublica(d.id, d.data()));
    copiadas++; enBatch++;
    if (enBatch >= 400) { await batch.commit(); batch = writeBatch(db); enBatch = 0; }
  }
  if (enBatch > 0) await batch.commit();
  return { copiadas, sinFolio, total: snap.size };
}

before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-privacidad-ventas',
    firestore: { rules: reglas, host: '127.0.0.1', port: 8181 },
  });
});
after(async () => { await env.cleanup(); });

describe('ventasPublicas: lectura', () => {
  it('cualquiera (sin sesión) lee UNA copia por su folio', async () => {
    await sembrar();
    await sembrarCopia('MYV-1011-1234', datosVentaPublica('V1', VENTA_Y1));
    await assertSucceeds(getDoc(copiaRef(null, 'MYV-1011-1234')));
    await assertSucceeds(getDoc(copiaRef(null, 'NO-EXISTE')));
  });
  it('nadie lista la colección (sin sesión, yonke ni con filtro); el admin sí', async () => {
    await sembrar();
    await sembrarCopia('MYV-1011-1234', datosVentaPublica('V1', VENTA_Y1));
    await assertFails(getDocs(collection(como(null), 'ventasPublicas')));
    await assertFails(getDocs(collection(como('o1'), 'ventasPublicas')));
    await assertFails(getDocs(query(collection(como('o1'), 'ventasPublicas'), where('yonkeId', '==', 'Y1'))));
    await assertSucceeds(getDocs(collection(como('adm'), 'ventasPublicas')));
    await assertSucceeds(getDocs(query(collection(como('adm'), 'ventasPublicas'), where('yonkeId', '==', 'Y1'))));
  });
  it('"Calificar" completo sin sesión: copia por folio + calificaciones de esa venta + calificar', async () => {
    await sembrar();
    await sembrarCopia('MYV-1011-1234', datosVentaPublica('V1', VENTA_Y1));
    const snap = await getDoc(copiaRef(null, 'MYV-1011-1234'));
    assert.equal(snap.data().ventaId, 'V1');
    assert.equal(snap.data().nombreCliente, undefined);
    await assertSucceeds(getDocs(query(collection(como(null), 'calificaciones'), where('ventaId', '==', 'V1'))));
    await assertSucceeds(addDoc(collection(como(null), 'calificaciones'), { ventaId: 'V1', yonkeId: 'Y1', estrellas: 5, comentario: '', fecha: new Date() }));
  });
});

describe('ventasPublicas: el yonke dueño crea la copia con su venta', () => {
  it('confirmar una reservación: venta + copia en un lote', async () => {
    await sembrar();
    await assertSucceeds(confirmarReservacion('o1', 'Y1', 'MYV-1012-4321'));
  });
  it('la copia de una venta suya ya guardada (folio normalizado: trim, mayúsculas, "/" → "-")', async () => {
    await sembrar();
    await assertSucceeds(setDoc(copiaRef('o1', 'MYV-1011-77'), datosVentaPublica('V3', { yonkeId: 'Y1', piezaVendida: 'Puerta' })));
  });
  it('rechaza copias con nombre del cliente, monto u otros campos extra', async () => {
    await sembrar();
    await assertFails(confirmarReservacion('o1', 'Y1', 'MYV-1012-0001', { nombreCliente: 'Luis' }));
    await assertFails(confirmarReservacion('o1', 'Y1', 'MYV-1012-0002', { monto: 1 }));
    await assertFails(confirmarReservacion('o1', 'Y1', 'MYV-1012-0003', { telefonoCliente: '664' }));
    await assertFails(confirmarReservacion('o1', 'Y1', 'MYV-1012-0004', { vehiculo: { marca: 'Ford', placas: 'ABC123' } }));
  });
  it('rechaza copias de ventas ajenas, a nombre de otro yonke o con otro folio', async () => {
    await sembrar();
    await assertFails(setDoc(copiaRef('o1', 'VM-1011-5555'), datosVentaPublica('V2', { yonkeId: 'Y2' })));
    await assertFails(setDoc(copiaRef('o1', 'VM-1011-5555'), datosVentaPublica('V2', { yonkeId: 'Y1' })));
    await assertFails(setDoc(copiaRef('o1', 'OTRO-FOLIO'), datosVentaPublica('V1', VENTA_Y1)));
    await assertFails(setDoc(copiaRef('o1', 'MYV-9999-0000'), datosVentaPublica('NO_EXISTE', { yonkeId: 'Y1' })));
    await assertFails(setDoc(copiaRef(null, 'MYV-1011-1234'), datosVentaPublica('V1', VENTA_Y1)));
  });
  it('el yonke no cambia ni borra copias (ni las suyas)', async () => {
    await sembrar();
    await sembrarCopia('MYV-1011-1234', datosVentaPublica('V1', VENTA_Y1));
    await assertFails(updateDoc(copiaRef('o1', 'MYV-1011-1234'), { piezaVendida: 'Otra' }));
    await assertFails(deleteDoc(copiaRef('o1', 'MYV-1011-1234')));
  });
  it('PENDIENTE conocido: si el folio ya tiene copia (folio repetido), la copia nueva se rechaza', async () => {
    await sembrar();
    await sembrarCopia('MYV-1012-4321', datosVentaPublica('V1', VENTA_Y1));
    await assertFails(confirmarReservacion('o1', 'Y1', 'MYV-1012-4321'));
  });
});

describe('ventasPublicas: admin y botón "Copiar ventas a públicas"', () => {
  it('copia TODAS las ventas (de todos los yonkes) en un lote, sin datos personales; omite las sin folio', async () => {
    await sembrar({ ventasExtra: 40 });
    const r = await copiarVentasAPublicas('adm');
    assert.deepEqual(r, { copiadas: 43, sinFolio: 1, total: 44 });
    await env.withSecurityRulesDisabled(async (ctx) => {
      const copias = await getDocs(collection(ctx.firestore(), 'ventasPublicas'));
      assert.equal(copias.size, 43);
      for (const c of copias.docs) {
        assert.deepEqual(Object.keys(c.data()).sort(), ['piezaVendida', 'vehiculo', 'ventaId', 'yonkeId']);
      }
      assert.equal((await getDoc(doc(ctx.firestore(), 'ventasPublicas', 'MYV-1011-77'))).data().ventaId, 'V3');
    });
  });
  it('es seguro correrlo dos veces (mismo resultado)', async () => {
    await sembrar({ ventasExtra: 10 });
    const primera = await copiarVentasAPublicas('adm');
    const segunda = await copiarVentasAPublicas('adm');
    assert.deepEqual(segunda, primera);
    await env.withSecurityRulesDisabled(async (ctx) => {
      assert.equal((await getDocs(collection(ctx.firestore(), 'ventasPublicas'))).size, primera.copiadas);
    });
  });
  it('un yonke no puede usar el botón (ni leer todas las ventas ajenas para copiarlas)', async () => {
    await sembrar();
    await assertFails(copiarVentasAPublicas('o1'));
  });
  it('el admin cambia y borra copias, pero tampoco con datos personales', async () => {
    await sembrar();
    await sembrarCopia('MYV-1011-1234', datosVentaPublica('V1', VENTA_Y1));
    await assertSucceeds(updateDoc(copiaRef('adm', 'MYV-1011-1234'), { piezaVendida: 'Faro izquierdo' }));
    await assertFails(updateDoc(copiaRef('adm', 'MYV-1011-1234'), { nombreCliente: 'Ana' }));
    await assertSucceeds(deleteDoc(copiaRef('adm', 'MYV-1011-1234')));
  });
});

describe('yonkes/{id}/privado: solo el admin', () => {
  it('el admin lee y escribe el correo privado (alta, edición y "mover correos a privado")', async () => {
    await sembrar();
    const db = como('adm');
    await assertSucceeds(getDoc(doc(db, 'yonkes', 'Y1', 'privado', 'contacto')));
    await assertSucceeds(setDoc(doc(db, 'yonkes', 'Y2', 'privado', 'contacto'), { email: 'nuevo@prueba.mx' }, { merge: true }));
    await assertSucceeds(getDocs(collection(db, 'yonkes', 'Y1', 'privado')));
    await assertSucceeds(deleteDoc(doc(db, 'yonkes', 'Y1', 'privado', 'contacto')));
  });
  it('"mover correos a privado": copia a privado y quita el correo de la ficha, en un lote', async () => {
    await sembrar();
    const db = como('adm');
    const lote = writeBatch(db);
    lote.set(doc(db, 'yonkes', 'Y1', 'privado', 'contacto'), { email: 'viejo@prueba.mx' }, { merge: true });
    lote.update(doc(db, 'yonkes', 'Y1'), { email: deleteField() });
    await assertSucceeds(lote.commit());
  });
  it('ni el dueño, ni otro yonke, ni sin sesión', async () => {
    await sembrar();
    for (const uid of ['o1', 'o2', null]) {
      await assertFails(getDoc(doc(como(uid), 'yonkes', 'Y1', 'privado', 'contacto')));
      await assertFails(setDoc(doc(como(uid), 'yonkes', 'Y1', 'privado', 'contacto'), { email: 'x@x.mx' }));
    }
  });
});

describe('resenasPlataforma: públicas solo las aprobadas', () => {
  it('sin sesión: la consulta de la página principal (aprobada == true) sí; una no aprobada no', async () => {
    await sembrar();
    await assertSucceeds(getDocs(query(collection(como(null), 'resenasPlataforma'), where('aprobada', '==', true))));
    await assertSucceeds(getDoc(doc(como(null), 'resenasPlataforma', 'RA')));
    await assertFails(getDoc(doc(como(null), 'resenasPlataforma', 'RN')));
    await assertFails(getDocs(collection(como(null), 'resenasPlataforma')));
    await assertFails(getDocs(collection(como('o1'), 'resenasPlataforma')));
  });
  it('el admin las lee todas; dejar una reseña sigue abierto', async () => {
    await sembrar();
    await assertSucceeds(getDocs(collection(como('adm'), 'resenasPlataforma')));
    await assertSucceeds(addDoc(collection(como(null), 'resenasPlataforma'), { estrellas: 4, comentario: '', aprobada: false, respuestaAdmin: '', fecha: new Date() }));
  });
});

describe('ventas: lectura (antes de cerrarla, sigue abierta)', () => {
  it('cualquiera la lee todavía (se cierra en el siguiente commit)', async () => {
    await sembrar();
    await assertSucceeds(getDoc(doc(como(null), 'ventas', 'V1')));
  });
});
