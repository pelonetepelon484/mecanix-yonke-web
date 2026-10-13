// Pruebas de reglas: inventario de vehículos completos de las alertas (yonkes/{id}/vehiculosAlerta)
// y límite diario de respuestas del plan Básico (yonkes/{id}/respuestasDiarias/{día de Tijuana}).
// Corren contra el emulador con el archivo real ../../firestore.rules.
// Comando (desde la raíz del repo):  npm run test:rules
import { describe, it, before, after, beforeEach } from 'node:test';
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import {
  Timestamp, deleteDoc, doc, getDoc, getDocs, collection, serverTimestamp, setDoc, updateDoc, writeBatch,
} from 'firebase/firestore';

const reglas = readFileSync(new URL('../../firestore.rules', import.meta.url), 'utf8');
let env;

const anonimo = () => env.unauthenticatedContext().firestore();
const como = (uid) => env.authenticatedContext(uid).firestore();
const DIA = 24 * 60 * 60 * 1000;
const enDias = (n) => Timestamp.fromMillis(Date.now() + n * DIA);

// Igual que diaTijuana() en src/lib/vehiculosAlerta.ts.
function diaTijuana(fecha = new Date()) {
  const partes = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Tijuana', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(fecha);
  const parte = (t) => partes.find((p) => p.type === t).value;
  return `${parte('year')}${parte('month')}${parte('day')}`;
}

const CONFIG_BASE = { habilitado: true, inventarioVehiculos: true };

// Y1: Básico de BC. Y2: Premium vigente de BC. Y3: Premium vencido de BC. Cuatro alertas abiertas de BC.
async function sembrar({ config = CONFIG_BASE } = {}) {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    if (config) await setDoc(doc(db, 'config', 'pedidosClientes'), config);
    await setDoc(doc(db, 'usuarios', 'adm'), { rol: 'admin', email: 'admin@prueba.mx' });
    const yonkes = [
      ['Y1', 'o1', {}],
      ['Y2', 'o2', { plan: 'premium' }],
      ['Y3', 'o3', { plan: 'premium', premiumHasta: Timestamp.fromMillis(Date.now() - DIA) }],
    ];
    for (const [id, uid, extra] of yonkes) {
      await setDoc(doc(db, 'yonkes', id), { nombre: `Yonke ${id}`, whatsapp: '6641111111', estado: 'baja-california', activo: true, ownerUid: uid, ...extra });
      await setDoc(doc(db, 'usuarios', uid), { rol: 'yonke', yonkeId: id, email: `${uid}@prueba.mx`, fechaRegistro: new Date() });
    }
    for (const id of ['P1', 'P2', 'P3', 'P4']) {
      await setDoc(doc(db, 'pedidosClientes', id), {
        vehiculo: { marca: 'Honda', modelo: 'Civic', anio: 2020 }, pieza: 'Alternador', estado: 'baja-california',
        estadoPedido: 'abierta', creadoAt: Timestamp.now(), expiraAt: enDias(5),
      });
    }
  });
}

async function sembrarVehiculo(yonkeId, id, datos = {}) {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'yonkes', yonkeId, 'vehiculosAlerta', id), {
      yonkeId, marca: 'Honda', modelo: 'Civic', ano: 2020, piezasAlerta: ['Alternador'], piezasVendidas: [],
      creadoAt: Timestamp.now(), venceEn: enDias(20), estado: 'activo', ...datos,
    });
  });
}

before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-vehiculos-alerta',
    firestore: { rules: reglas, host: '127.0.0.1', port: 8181 },
  });
});
after(async () => { await env.cleanup(); });
beforeEach(() => sembrar());

// ---------- Límite diario ----------

const YONKE = { Y1: 'o1', Y2: 'o2', Y3: 'o3' };

// extra con { campo: undefined } quita ese campo (Firestore no acepta undefined).
function cuerpoRespuesta(yonkeId, extra = {}) {
  const cuerpo = {
    yonkeId, yonkeNombre: `Yonke ${yonkeId}`, whatsapp: '6641111111', tieneLaPieza: true, precio: 1500, nota: '',
    creadoAt: serverTimestamp(), expiraAt: enDias(5), ...extra,
  };
  for (const k of Object.keys(cuerpo)) if (cuerpo[k] === undefined) delete cuerpo[k];
  return cuerpo;
}

// Igual que responderPedido() sin límite.
function responderSinContador(yonkeId, pedidoId, extra = {}) {
  return setDoc(doc(como(YONKE[yonkeId]), 'pedidosClientes', pedidoId, 'respuestas', yonkeId), cuerpoRespuesta(yonkeId, extra));
}

// Igual que responderPedido() con límite: respuesta + contador en el mismo guardado.
async function responderConContador(yonkeId, pedidoId, { dia = diaTijuana(), nuevoConteo, extra = {} } = {}) {
  const db = como(YONKE[yonkeId]);
  let actual = 0;
  await env.withSecurityRulesDisabled(async (ctx) => {
    const snap = await getDoc(doc(ctx.firestore(), 'yonkes', yonkeId, 'respuestasDiarias', dia));
    actual = snap.exists() ? snap.data().count : 0;
  });
  const lote = writeBatch(db);
  lote.set(doc(db, 'pedidosClientes', pedidoId, 'respuestas', yonkeId), cuerpoRespuesta(yonkeId, { dia, ...extra }));
  lote.set(doc(db, 'yonkes', yonkeId, 'respuestasDiarias', dia), { count: nuevoConteo ?? actual + 1 });
  return lote.commit();
}

describe('límite diario de respuestas (plan Básico)', () => {
  it('sin limiteRespuestasDiarias todo es como antes: responde sin contador', async () => {
    await assertSucceeds(responderSinContador('Y1', 'P1'));
    await assertSucceeds(responderSinContador('Y1', 'P2'));
    await assertSucceeds(responderSinContador('Y1', 'P3'));
  });

  it('con límite 2, el Básico responde 2 alertas ("La tengo" y "No la tengo") y la tercera se rechaza', async () => {
    await sembrar({ config: { ...CONFIG_BASE, limiteRespuestasDiarias: 2 } });
    await assertSucceeds(responderConContador('Y1', 'P1'));
    await assertSucceeds(responderConContador('Y1', 'P2', { extra: { tieneLaPieza: false, precio: undefined } }));
    await assertFails(responderConContador('Y1', 'P3'));
  });

  it('con límite, el Básico no puede responder sin el contador ni con un día que no es hoy en Tijuana', async () => {
    await sembrar({ config: { ...CONFIG_BASE, limiteRespuestasDiarias: 5 } });
    await assertFails(responderSinContador('Y1', 'P1'));
    await assertFails(responderConContador('Y1', 'P1', { dia: '20200101' }));
  });

  it('el contador solo sube de uno en uno: no se puede saltar ni regresar', async () => {
    await sembrar({ config: { ...CONFIG_BASE, limiteRespuestasDiarias: 5 } });
    await assertFails(responderConContador('Y1', 'P1', { nuevoConteo: 0 }));
    await assertSucceeds(responderConContador('Y1', 'P1'));
    const db = como('o1');
    const ref = doc(db, 'yonkes', 'Y1', 'respuestasDiarias', diaTijuana());
    await assertFails(setDoc(ref, { count: 0 }));
    await assertFails(deleteDoc(ref));
  });

  it('Premium vigente responde sin límite y sin contador; Premium vencido cuenta como Básico', async () => {
    await sembrar({ config: { ...CONFIG_BASE, limiteRespuestasDiarias: 1 } });
    await assertSucceeds(responderSinContador('Y2', 'P1'));
    await assertSucceeds(responderSinContador('Y2', 'P2'));
    await assertFails(responderSinContador('Y3', 'P1'));
  });

  it('el contador lo leen solo su dueño y el admin', async () => {
    await sembrar({ config: { ...CONFIG_BASE, limiteRespuestasDiarias: 5 } });
    await assertSucceeds(responderConContador('Y1', 'P1'));
    await assertSucceeds(getDoc(doc(como('o1'), 'yonkes', 'Y1', 'respuestasDiarias', diaTijuana())));
    await assertSucceeds(getDoc(doc(como('adm'), 'yonkes', 'Y1', 'respuestasDiarias', diaTijuana())));
    await assertFails(getDoc(doc(como('o2'), 'yonkes', 'Y1', 'respuestasDiarias', diaTijuana())));
    await assertFails(getDoc(doc(anonimo(), 'yonkes', 'Y1', 'respuestasDiarias', diaTijuana())));
    await assertFails(setDoc(doc(como('o2'), 'yonkes', 'Y1', 'respuestasDiarias', diaTijuana()), { count: 2 }));
  });
});

// ---------- Vehículos completos ----------

const ID = 'honda_civic_2020';
const nuevo = (yonkeId, extra = {}) => ({
  yonkeId, marca: 'Honda', modelo: 'Civic', ano: 2020, piezasAlerta: ['Alternador'], piezasVendidas: [],
  creadoAt: serverTimestamp(), venceEn: enDias(30), estado: 'activo', ...extra,
});

describe('vehiculosAlerta: alta', () => {
  it('el dueño lo crea con la bandera encendida; cualquiera lo lee (también sin cuenta)', async () => {
    await assertSucceeds(setDoc(doc(como('o1'), 'yonkes', 'Y1', 'vehiculosAlerta', ID), nuevo('Y1')));
    await assertSucceeds(getDoc(doc(anonimo(), 'yonkes', 'Y1', 'vehiculosAlerta', ID)));
    await assertSucceeds(getDocs(collection(anonimo(), 'yonkes', 'Y1', 'vehiculosAlerta')));
  });

  it('sin la bandera inventarioVehiculos (o sin config) nadie lo crea', async () => {
    await sembrar({ config: { habilitado: true } });
    await assertFails(setDoc(doc(como('o1'), 'yonkes', 'Y1', 'vehiculosAlerta', ID), nuevo('Y1')));
    await sembrar({ config: null });
    await assertFails(setDoc(doc(como('o1'), 'yonkes', 'Y1', 'vehiculosAlerta', ID), nuevo('Y1')));
  });

  it('otro yonke o alguien sin cuenta no lo crea en un yonke ajeno', async () => {
    await assertFails(setDoc(doc(como('o2'), 'yonkes', 'Y1', 'vehiculosAlerta', ID), nuevo('Y1')));
    await assertFails(setDoc(doc(anonimo(), 'yonkes', 'Y1', 'vehiculosAlerta', ID), nuevo('Y1')));
  });

  it('rechaza vencimientos distintos de 30 días, piezas vendidas de entrada o campos de más', async () => {
    const ref = doc(como('o1'), 'yonkes', 'Y1', 'vehiculosAlerta', ID);
    await assertFails(setDoc(ref, nuevo('Y1', { venceEn: enDias(60) })));
    await assertFails(setDoc(ref, nuevo('Y1', { piezasVendidas: ['Faro'] })));
    await assertFails(setDoc(ref, nuevo('Y1', { clienteWhatsapp: '6641234567' })));
    await assertFails(setDoc(ref, nuevo('Y2')));
  });
});

describe('vehiculosAlerta: cambios', () => {
  it('"Ya lo vendí": el dueño agrega piezas vendidas, aunque la bandera esté apagada', async () => {
    await sembrarVehiculo('Y1', ID);
    await assertSucceeds(updateDoc(doc(como('o1'), 'yonkes', 'Y1', 'vehiculosAlerta', ID), { piezasVendidas: ['Alternador'] }));
    await sembrar({ config: null });
    await sembrarVehiculo('Y1', ID);
    await assertSucceeds(updateDoc(doc(como('o1'), 'yonkes', 'Y1', 'vehiculosAlerta', ID), { piezasVendidas: ['Faro'] }));
  });

  it('otro yonke no lo cambia ni lo borra; el dueño no cambia marca, modelo ni año', async () => {
    await sembrarVehiculo('Y1', ID);
    await assertFails(updateDoc(doc(como('o2'), 'yonkes', 'Y1', 'vehiculosAlerta', ID), { piezasVendidas: ['Alternador'] }));
    await assertFails(deleteDoc(doc(como('o2'), 'yonkes', 'Y1', 'vehiculosAlerta', ID)));
    await assertFails(updateDoc(doc(como('o1'), 'yonkes', 'Y1', 'vehiculosAlerta', ID), { modelo: 'Accord' }));
  });

  it('renovar uno vencido: 30 días desde hoy y piezas vendidas en cero', async () => {
    await sembrarVehiculo('Y1', ID, { venceEn: enDias(-2), piezasVendidas: ['Faro'] });
    const ref = doc(como('o1'), 'yonkes', 'Y1', 'vehiculosAlerta', ID);
    await assertFails(updateDoc(ref, { venceEn: enDias(30), renovadoAt: serverTimestamp() }));
    await assertSucceeds(updateDoc(ref, { venceEn: enDias(30), piezasVendidas: [], renovadoAt: serverTimestamp(), estado: 'activo' }));
  });

  it('el Básico no alarga uno vigente; "Sigo manteniendo" (Premium vigente) sí, sin tocar piezas vendidas', async () => {
    await sembrarVehiculo('Y1', ID);
    await assertFails(updateDoc(doc(como('o1'), 'yonkes', 'Y1', 'vehiculosAlerta', ID), { venceEn: enDias(30), renovadoAt: serverTimestamp() }));
    await assertFails(updateDoc(doc(como('o1'), 'yonkes', 'Y1', 'vehiculosAlerta', ID), { venceEn: enDias(30), piezasVendidas: [], renovadoAt: serverTimestamp() }));

    await sembrarVehiculo('Y2', ID, { piezasVendidas: ['Faro'] });
    await sembrarVehiculo('Y2', 'nissan_sentra_2005', { marca: 'Nissan', modelo: 'Sentra', ano: 2005 });
    const db = como('o2');
    const lote = writeBatch(db);
    for (const id of [ID, 'nissan_sentra_2005']) lote.update(doc(db, 'yonkes', 'Y2', 'vehiculosAlerta', id), { venceEn: enDias(30), renovadoAt: serverTimestamp() });
    await assertSucceeds(lote.commit());
    await assertFails(updateDoc(doc(db, 'yonkes', 'Y2', 'vehiculosAlerta', ID), { venceEn: enDias(30), piezasVendidas: [], renovadoAt: serverTimestamp() }));

    await sembrarVehiculo('Y3', ID);
    await assertFails(updateDoc(doc(como('o3'), 'yonkes', 'Y3', 'vehiculosAlerta', ID), { venceEn: enDias(30), renovadoAt: serverTimestamp() }));
  });

  it('"Quitar vehículo": el dueño y el admin lo borran', async () => {
    await sembrarVehiculo('Y1', ID);
    await assertSucceeds(deleteDoc(doc(como('o1'), 'yonkes', 'Y1', 'vehiculosAlerta', ID)));
    await sembrarVehiculo('Y1', ID);
    await assertSucceeds(deleteDoc(doc(como('adm'), 'yonkes', 'Y1', 'vehiculosAlerta', ID)));
  });
});

describe('vehiculosAlerta: varias unidades', () => {
  const ref = (uid, yonkeId = 'Y1') => doc(como(uid), 'yonkes', yonkeId, 'vehiculosAlerta', ID);

  it('alta con 1 unidad y sin ventas (y también sin los campos nuevos, como la versión anterior)', async () => {
    await assertSucceeds(setDoc(ref('o1'), nuevo('Y1', { unidades: 1, ventasPiezas: {} })));
    await sembrar();
    await assertSucceeds(setDoc(ref('o1'), nuevo('Y1')));
    await sembrar();
    await assertFails(setDoc(ref('o1'), nuevo('Y1', { unidades: 3 })));
    await assertFails(setDoc(ref('o1'), nuevo('Y1', { ventasPiezas: { alternador: 1 } })));
  });

  it('vender y deshacer: el dueño cambia el conteo, también en un registro viejo; otro yonke no', async () => {
    await sembrarVehiculo('Y1', ID, { piezasVendidas: ['Faro'] });
    await assertSucceeds(updateDoc(ref('o1'), { ventasPiezas: { faro: 1, alternador: 1 }, piezasVendidas: ['Faro', 'Alternador'] }));
    await assertSucceeds(updateDoc(ref('o1'), { ventasPiezas: { faro: 1 }, piezasVendidas: ['Faro'] }));
    await assertFails(updateDoc(ref('o2'), { ventasPiezas: {} }));
  });

  it('"+1" en un vigente: una unidad más y 30 días; no de dos en dos, no en vencidos, no sin la bandera', async () => {
    await sembrarVehiculo('Y1', ID);
    await assertFails(updateDoc(ref('o1'), { unidades: 3, venceEn: enDias(30), renovadoAt: serverTimestamp() }));
    await assertFails(updateDoc(ref('o1'), { unidades: 2 }));
    await assertSucceeds(updateDoc(ref('o1'), { unidades: 2, venceEn: enDias(30), renovadoAt: serverTimestamp() }));
    // Desde "¿Tienes otro igual?": la unidad y la venta en el mismo guardado.
    await assertSucceeds(updateDoc(ref('o1'), {
      unidades: 3, venceEn: enDias(30), renovadoAt: serverTimestamp(), ventasPiezas: { alternador: 3 }, piezasVendidas: ['Alternador'],
    }));
    await assertFails(updateDoc(ref('o2'), { unidades: 4, venceEn: enDias(30), renovadoAt: serverTimestamp() }));

    await sembrarVehiculo('Y1', ID, { venceEn: enDias(-1) });
    await assertFails(updateDoc(ref('o1'), { unidades: 2, venceEn: enDias(30), renovadoAt: serverTimestamp() }));

    await sembrar({ config: { habilitado: true } });
    await sembrarVehiculo('Y1', ID);
    await assertFails(updateDoc(ref('o1'), { unidades: 2, venceEn: enDias(30), renovadoAt: serverTimestamp() }));
  });

  it('"−1": de uno en uno y nunca menos de 1 (también en un registro viejo sin el campo)', async () => {
    await sembrarVehiculo('Y1', ID, { unidades: 3 });
    await assertSucceeds(updateDoc(ref('o1'), { unidades: 2 }));
    await assertFails(updateDoc(ref('o1'), { unidades: 0 }));
    await assertSucceeds(updateDoc(ref('o1'), { unidades: 1 }));
    await assertFails(updateDoc(ref('o1'), { unidades: 0 }));
    await sembrarVehiculo('Y1', ID);
    await assertFails(updateDoc(ref('o1'), { unidades: 0 }));
  });

  it('renovar uno vencido lo deja en 1 unidad y sin ventas', async () => {
    await sembrarVehiculo('Y1', ID, { venceEn: enDias(-2), unidades: 3, ventasPiezas: { alternador: 2 } });
    const base = { venceEn: enDias(30), piezasVendidas: [], renovadoAt: serverTimestamp(), estado: 'activo' };
    await assertFails(updateDoc(ref('o1'), base));
    await assertFails(updateDoc(ref('o1'), { ...base, unidades: 1 }));
    await assertSucceeds(updateDoc(ref('o1'), { ...base, unidades: 1, ventasPiezas: {} }));
  });
});
