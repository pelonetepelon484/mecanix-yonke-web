// Pruebas de reglas: límites del plan Básico y Premium (config/planes { limitesActivos }).
// - Interruptor apagado (sin documento, false o un texto "true"): todo como antes (regresión).
// - Encendido: el plan Básico no hace venta manual, reciclaje (compras, materiales, datos fiscales),
//   notas de garantía, ni lee Demanda, ni cambia su página propia (promociones, "sobre nosotros",
//   color, fondo). Sí: inventario, logo, datos del negocio, pedidos y la venta de una reservación.
// - Premium vigente (sin fecha o con fecha futura) puede todo; Premium vencido es Básico.
// - La definición de "Premium vigente" de las reglas coincide con esPremiumVigente() de la app.
// Corren contra el emulador con el archivo real ../../firestore.rules (npm run test:rules).
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import {
  Timestamp, collection, deleteDoc, doc, getDoc, getDocs, query, runTransaction, serverTimestamp, setDoc, updateDoc, where,
} from 'firebase/firestore';
import { esPremiumVigente, casosPremiumVigente } from '../../src/lib/planes.js';

const reglas = readFileSync(new URL('../../firestore.rules', import.meta.url), 'utf8');
let env;
const DIA = 86400000;
const fechaRelativa = (ms) => Timestamp.fromMillis(Date.now() + ms);

// Un yonke por tipo de plan, todos en Baja California, con sus dueños.
const YONKES = {
  B: { dueno: 'ob', plan: 'freemium' },
  BA: { dueno: 'oba', plan: 'basico' },
  P: { dueno: 'op', plan: 'premium' },
  PF: { dueno: 'opf', plan: 'premium', premiumHasta: () => fechaRelativa(30 * DIA) },
  PV: { dueno: 'opv', plan: 'premium', premiumHasta: () => fechaRelativa(-DIA) },
};

async function sembrar({ planes = { limitesActivos: true }, terminos = false } = {}) {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    if (planes !== null) await setDoc(doc(db, 'config', 'planes'), planes);
    if (terminos) await setDoc(doc(db, 'config', 'terminosYonkes'), { version: 'v2', resumenCambios: '' });
    await setDoc(doc(db, 'usuarios', 'adm'), { rol: 'admin', email: 'admin@prueba.mx' });
    for (const [id, y] of Object.entries(YONKES)) {
      const ficha = {
        nombre: `Yonke ${id}`, whatsapp: '6641111111', estado: 'baja-california', activo: true, ownerUid: y.dueno, plan: y.plan,
        branding: { logoUrl: 'https://x/logo.png', colorPrimario: '#111111', colorAcento: '#222222' },
        aceptacionLegal: { version: 'v2', fecha: new Date() },
      };
      if (y.premiumHasta) ficha.premiumHasta = y.premiumHasta();
      await setDoc(doc(db, 'yonkes', id), ficha);
      await setDoc(doc(db, 'usuarios', y.dueno), { rol: 'yonke', yonkeId: id, email: `${y.dueno}@prueba.mx`, fechaRegistro: new Date() });
      await setDoc(doc(db, 'yonkes', id, 'vehiculos', 'V1'), { marca: 'Nissan', modelo: 'Sentra', ano: 2005 });
      await setDoc(doc(db, 'yonkes', id, 'vehiculos', 'V1', 'piezas', 'P1'), { nombre: 'Alternador', disponible: true });
      await setDoc(doc(db, 'yonkes', id, 'materialesReciclaje', 'MR1'), { nombre: 'Cobre', precioPorKilo: 100 });
      await setDoc(doc(db, 'yonkes', id, 'comprasReciclaje', 'CR1'), { total: 100 });
      await setDoc(doc(db, 'yonkes', id, 'notasGarantia', 'N1'), { ventaId: 'X' });
      await setDoc(doc(db, 'reservaciones', `R-${id}`), { yonkeId: id, estado: 'pendiente', nombreCliente: 'Ana', piezaSolicitada: 'Faro' });
    }
    await setDoc(doc(db, 'busquedasResumen', 'BR1'), { estadoGeografico: 'bcn', fecha: Timestamp.now(), pieza: 'Faro' });
  });
}

const como = (uid) => env.authenticatedContext(uid).firestore();
const dueno = (id) => YONKES[id].dueno;

// Lo que el plan Premium agrega (con límites activos).
const accionesPremium = (id) => {
  const db = como(dueno(id));
  return {
    'venta manual': () => setDoc(doc(collection(db, 'ventas')), {
      numeroPedido: 'VM-1', yonkeId: id, origen: 'manual', monto: 300, fecha: new Date(), partSource: 'custom', piezaVendida: 'Otra',
    }),
    'reciclaje: registrar compra': () => setDoc(doc(db, 'yonkes', id, 'comprasReciclaje', 'CR9'), { total: 50 }),
    'reciclaje: editar material': () => updateDoc(doc(db, 'yonkes', id, 'materialesReciclaje', 'MR1'), { precioPorKilo: 120 }),
    'reciclaje: borrar material': () => deleteDoc(doc(db, 'yonkes', id, 'materialesReciclaje', 'MR1')),
    'reciclaje: datos fiscales': () => setDoc(doc(db, 'yonkes', id), { fiscalReciclaje: { ivaPorcentaje: 16 } }, { merge: true }),
    'nota de garantía': () => setDoc(doc(db, 'yonkes', id, 'notasGarantia', 'N9'), { ventaId: 'X' }),
    'Demanda (leer)': () => getDocs(query(collection(db, 'busquedasResumen'), where('estadoGeografico', '==', 'bcn'))),
    'página propia: promociones': () => updateDoc(doc(db, 'yonkes', id), { promoImagenes: [] }),
    'página propia: sobre nosotros': () => updateDoc(doc(db, 'yonkes', id), { 'sitio.sobreNosotros': { texto: 'Hola' } }),
    'página propia: color': () => updateDoc(doc(db, 'yonkes', id), { 'branding.colorPrimario': '#333333', 'branding.colorAcento': '#444444' }),
    'página propia: fondo': () => updateDoc(doc(db, 'yonkes', id), { 'branding.fondoUrl': null }),
  };
};

// Lo que el plan Básico SIEMPRE puede (encendido o apagado).
const accionesBasicas = (id) => {
  const db = como(dueno(id));
  return {
    'inventario: agregar vehículo': () => setDoc(doc(db, 'yonkes', id, 'vehiculos', 'V9'), { marca: 'Ford', modelo: 'Focus', ano: 2010 }),
    'inventario: precio de pieza': () => updateDoc(doc(db, 'yonkes', id, 'vehiculos', 'V1', 'piezas', 'P1'), { precio: 500 }),
    'negocio: logo': () => updateDoc(doc(db, 'yonkes', id), { logoUrl: 'https://x/nuevo.png', 'branding.logoUrl': 'https://x/nuevo.png' }),
    'negocio: quitar logo': () => updateDoc(doc(db, 'yonkes', id), { 'branding.logoUrl': null }),
    'negocio: información, horario y métodos de pago': () => setDoc(doc(db, 'yonkes', id), {
      nombre: 'Nuevo', direccion: 'Calle', telefono: '6640000000', whatsapp: '6640000000', metodosPago: ['efectivo'], horario: { lunes: { abierto: true } },
    }, { merge: true }),
    'negocio: garantía': () => setDoc(doc(db, 'yonkes', id), { garantia: { dias: 30 } }, { merge: true }),
    'marca de actividad': () => updateDoc(doc(db, 'yonkes', id), { ultimaActividadAt: serverTimestamp() }),
    'reservación: confirmar (venta) y completar': async () => {
      await setDoc(doc(collection(db, 'ventas')), { reservaId: `R-${id}`, yonkeId: id, numeroPedido: 'R-1', monto: 1, fecha: new Date() });
      await updateDoc(doc(db, 'reservaciones', `R-${id}`), { estado: 'completada' });
    },
    'ver lo ya capturado de reciclaje y notas': async () => {
      await getDoc(doc(db, 'yonkes', id, 'comprasReciclaje', 'CR1'));
      await getDoc(doc(db, 'yonkes', id, 'materialesReciclaje', 'MR1'));
      await getDoc(doc(db, 'yonkes', id, 'notasGarantia', 'N1'));
    },
  };
};

before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-planes',
    firestore: { rules: reglas, host: '127.0.0.1', port: 8181 },
  });
});
after(async () => { await env.cleanup(); });

describe('interruptor apagado: todo como antes (regresión)', () => {
  for (const [titulo, planes] of [['sin config/planes', null], ['limitesActivos: false', { limitesActivos: false }], ['limitesActivos: "true" (texto)', { limitesActivos: 'true' }]]) {
    it(`${titulo}: un yonke Básico hace todo lo Premium`, async () => {
      for (const nombre of Object.keys(accionesPremium('B'))) {
        await sembrar({ planes });
        await assertSucceeds(accionesPremium('B')[nombre](), nombre);
      }
    });
    it(`${titulo}: un Premium vencido también`, async () => {
      for (const nombre of Object.keys(accionesPremium('PV'))) {
        await sembrar({ planes });
        await assertSucceeds(accionesPremium('PV')[nombre](), nombre);
      }
    });
  }
});

describe('interruptor encendido: plan Básico', () => {
  it('no puede ninguna función Premium (freemium)', async () => {
    for (const nombre of Object.keys(accionesPremium('B'))) {
      await sembrar();
      await assertFails(accionesPremium('B')[nombre](), nombre);
    }
  });
  it('"basico" guardado es lo mismo que "freemium"', async () => {
    for (const nombre of Object.keys(accionesPremium('BA'))) {
      await sembrar();
      await assertFails(accionesPremium('BA')[nombre](), nombre);
    }
  });
  it('un Premium vencido es Básico', async () => {
    for (const nombre of Object.keys(accionesPremium('PV'))) {
      await sembrar();
      await assertFails(accionesPremium('PV')[nombre](), nombre);
    }
  });
  it('sí puede todo lo del plan Básico', async () => {
    for (const nombre of Object.keys(accionesBasicas('B'))) {
      await sembrar();
      await assertSucceeds(accionesBasicas('B')[nombre](), nombre);
    }
  });
  it('sube su logo aunque su ficha no tenga branding todavía', async () => {
    await sembrar();
    await env.withSecurityRulesDisabled((ctx) => updateDoc(doc(ctx.firestore(), 'yonkes', 'B'), { branding: null }));
    await assertSucceeds(updateDoc(doc(como('ob'), 'yonkes', 'B'), { logoUrl: 'https://x/l.png', 'branding.logoUrl': 'https://x/l.png' }));
  });
  it('no puede colar un cambio de color junto con el logo', async () => {
    await sembrar();
    await assertFails(updateDoc(doc(como('ob'), 'yonkes', 'B'), { 'branding.logoUrl': 'https://x/l.png', 'branding.colorPrimario': '#000000' }));
  });
  it('la venta de reservación no sirve para colar una venta manual', async () => {
    await sembrar();
    await assertFails(setDoc(doc(collection(como('ob'), 'ventas')), { reservaId: 'R-B', yonkeId: 'B', origen: 'manual', numeroPedido: 'X', monto: 1, fecha: new Date() }));
    await assertFails(setDoc(doc(collection(como('ob'), 'ventas')), { reservaId: 'R-P', yonkeId: 'B', numeroPedido: 'X', monto: 1, fecha: new Date() }));
  });
});

describe('interruptor encendido: Premium vigente', () => {
  for (const id of ['P', 'PF']) {
    it(`${id === 'P' ? 'sin fecha' : 'con fecha futura'}: puede todo lo Premium y lo Básico`, async () => {
      for (const nombre of Object.keys(accionesPremium(id))) {
        await sembrar();
        await assertSucceeds(accionesPremium(id)[nombre](), nombre);
      }
      for (const nombre of Object.keys(accionesBasicas(id))) {
        await sembrar();
        await assertSucceeds(accionesBasicas(id)[nombre](), nombre);
      }
    });
  }
});

describe('interruptor encendido: admin', () => {
  it('hace todo en un yonke Básico', async () => {
    await sembrar();
    const db = como('adm');
    await assertSucceeds(setDoc(doc(collection(db, 'ventas')), { numeroPedido: 'VM-2', yonkeId: 'B', origen: 'manual', monto: 1, fecha: new Date() }));
    await assertSucceeds(setDoc(doc(db, 'yonkes', 'B', 'comprasReciclaje', 'CR9'), { total: 1 }));
    await assertSucceeds(setDoc(doc(db, 'yonkes', 'B', 'notasGarantia', 'N9'), { ventaId: 'X' }));
    await assertSucceeds(updateDoc(doc(db, 'yonkes', 'B'), { promoImagenes: [], 'branding.colorPrimario': '#000000', fiscalReciclaje: {} }));
    await assertSucceeds(getDocs(query(collection(db, 'busquedasResumen'), where('estadoGeografico', '==', 'bcn'))));
  });
});

describe('"Premium vigente": reglas y app dicen lo mismo', () => {
  for (const caso of casosPremiumVigente) {
    it(`${caso.nombre} → ${caso.esperado ? 'vigente' : 'no vigente'}`, async () => {
      const ahora = Date.now();
      const yonke = { plan: caso.plan };
      if (caso.hastaRelativoMs !== null) yonke.premiumHasta = new Date(ahora + caso.hastaRelativoMs);
      assert.equal(esPremiumVigente(yonke, new Date(ahora)), caso.esperado, 'app');

      await sembrar();
      await env.withSecurityRulesDisabled(async (ctx) => {
        const datos = { nombre: 'Caso', estado: 'baja-california', activo: true, ownerUid: 'oc' };
        if (caso.plan !== undefined) datos.plan = caso.plan;
        if (caso.hastaRelativoMs !== null) datos.premiumHasta = Timestamp.fromMillis(ahora + caso.hastaRelativoMs);
        await setDoc(doc(ctx.firestore(), 'yonkes', 'C'), datos);
        await setDoc(doc(ctx.firestore(), 'usuarios', 'oc'), { rol: 'yonke', yonkeId: 'C', email: 'oc@prueba.mx' });
      });
      const intento = setDoc(doc(como('oc'), 'yonkes', 'C', 'materialesReciclaje', 'M'), { nombre: 'Cobre' });
      await (caso.esperado ? assertSucceeds(intento) : assertFails(intento));
    });
  }
});

describe('límite de lecturas de las reglas (términos + planes encendidos)', () => {
  it('venta manual de una pieza del inventario (transacción) de un Premium vigente pasa', async () => {
    await sembrar({ terminos: true });
    const db = como('op');
    await assertSucceeds(runTransaction(db, async (tx) => {
      const piezaRef = doc(db, 'yonkes', 'P', 'vehiculos', 'V1', 'piezas', 'P1');
      await tx.get(piezaRef);
      tx.update(piezaRef, { disponible: false });
      tx.set(doc(collection(db, 'ventas')), { numeroPedido: 'VM-3', yonkeId: 'P', origen: 'manual', monto: 1, fecha: new Date(), piezaId: 'P1' });
    }));
  });
  it('confirmar una reservación de un Básico con términos y planes encendidos pasa', async () => {
    await sembrar({ terminos: true });
    await assertSucceeds(accionesBasicas('B')['reservación: confirmar (venta) y completar']());
  });
  it('Demanda de un Premium con términos y planes encendidos pasa; un Básico no', async () => {
    await sembrar({ terminos: true });
    await assertSucceeds(accionesPremium('P')['Demanda (leer)']());
    await assertFails(accionesPremium('B')['Demanda (leer)']());
  });
  it('guardar promociones y datos fiscales de un Premium con todo encendido pasa', async () => {
    await sembrar({ terminos: true });
    await assertSucceeds(updateDoc(doc(como('op'), 'yonkes', 'P'), { promoImagenes: [], fiscalReciclaje: { ivaPorcentaje: 16 } }));
  });
});
