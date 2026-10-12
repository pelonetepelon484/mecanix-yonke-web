// Pruebas de reglas: reaceptación de los Términos generales por los yonkes (config/terminosYonkes).
// - Sin config/terminosYonkes no se exige nada (así se publica y así se apaga).
// - Con el documento: sin la versión vigente, el yonke no cambia su negocio, inventario, reciclaje,
//   notas de garantía ni venta manual; sí acepta los términos, marca actividad, responde pedidos y
//   alertas y atiende reservaciones (incluida la venta que genera confirmar una).
// - Historial yonkes/{id}/aceptaciones/{versión} en el mismo guardado que aceptacionLegal.
// Corren contra el emulador con el archivo real ../../firestore.rules (npm run test:rules).
import { describe, it, before, after } from 'node:test';
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import {
  Timestamp, collection, deleteDoc, deleteField, doc, getDoc, runTransaction, serverTimestamp, setDoc, updateDoc, writeBatch,
} from 'firebase/firestore';

const reglas = readFileSync(new URL('../../firestore.rules', import.meta.url), 'utf8');
let env;

const VIGENTE = '2026-11-01';
const VIEJA = '2026-10-10b';
const DIA = 24 * 60 * 60 * 1000;
const en5Dias = () => Timestamp.fromMillis(Date.now() + 5 * DIA);

// Y1 (dueño o1): aceptó la versión VIEJA. Y2 (dueño o2): nunca aceptó (creado por el admin).
// Ambos en baja-california y activos, para poder responder pedidos y alertas.
async function sembrar({ config = true } = {}) {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    if (config) await setDoc(doc(db, 'config', 'terminosYonkes'), { version: VIGENTE, resumenCambios: 'Cambió la sección 4.' });
    await setDoc(doc(db, 'config', 'pedidosClientes'), { habilitado: true });
    await setDoc(doc(db, 'config', 'solicitudesPiezas'), { habilitado: true });
    await setDoc(doc(db, 'usuarios', 'adm'), { rol: 'admin', email: 'admin@prueba.mx' });
    await setDoc(doc(db, 'yonkes', 'Y1'), {
      nombre: 'Yonke uno', whatsapp: '6641111111', estado: 'baja-california', activo: true, ownerUid: 'o1',
      aceptacionLegal: { version: VIEJA, fecha: new Date() },
    });
    await setDoc(doc(db, 'usuarios', 'o1'), { rol: 'yonke', yonkeId: 'Y1', email: 'o1@prueba.mx', fechaRegistro: new Date() });
    await setDoc(doc(db, 'yonkes', 'Y2'), { nombre: 'Yonke dos', whatsapp: '6642222222', estado: 'baja-california', activo: true });
    await setDoc(doc(db, 'usuarios', 'o2'), { rol: 'yonke', yonkeId: 'Y2', email: 'o2@prueba.mx', fechaRegistro: new Date() });

    await setDoc(doc(db, 'yonkes', 'Y1', 'vehiculos', 'V1'), { marca: 'Nissan', modelo: 'Sentra', ano: 2005 });
    await setDoc(doc(db, 'yonkes', 'Y1', 'vehiculos', 'V1', 'piezas', 'P1'), { nombre: 'Alternador', disponible: true });
    await setDoc(doc(db, 'yonkes', 'Y1', 'motores', 'M1'), { tipo: 'motor', disponible: true });
    await setDoc(doc(db, 'yonkes', 'Y1', 'piezasSueltas', 'S1'), { nombre: 'Faro', disponible: true });
    await setDoc(doc(db, 'yonkes', 'Y1', 'materialesReciclaje', 'MR1'), { nombre: 'Cobre', precioPorKilo: 100 });
    await setDoc(doc(db, 'yonkes', 'Y1', 'comprasReciclaje', 'CR1'), { total: 100 });
    await setDoc(doc(db, 'yonkes', 'Y1', 'notasGarantia', 'N1'), { ventaId: 'VM1' });

    await setDoc(doc(db, 'reservaciones', 'R1'), { yonkeId: 'Y1', estado: 'pendiente', nombreCliente: 'Ana', piezaSolicitada: 'Faro' });
    await setDoc(doc(db, 'reservaciones', 'R2'), { yonkeId: 'Y1', estado: 'completada', nombreCliente: 'Luis', piezaSolicitada: 'Faro' });
    await setDoc(doc(db, 'reservaciones', 'R9'), { yonkeId: 'Y2', estado: 'pendiente', nombreCliente: 'Eva', piezaSolicitada: 'Faro' });
    await setDoc(doc(db, 'ventas', 'VM1'), { yonkeId: 'Y1', origen: 'manual', numeroPedido: 'M-1', monto: 100, fecha: new Date() });
    await setDoc(doc(db, 'ventas', 'VR1'), { yonkeId: 'Y1', reservaId: 'R2', numeroPedido: 'R-2', monto: 100, fecha: new Date() });

    // Pedido de un cliente (alerta) y pedido de un taller, ambos en baja-california.
    await setDoc(doc(db, 'pedidosClientes', 'PC1'), {
      vehiculo: { marca: 'Nissan', modelo: 'Sentra', anio: 2005 }, pieza: 'Alternador', estado: 'baja-california',
      estadoPedido: 'abierta', creadoAt: Timestamp.now(), expiraAt: en5Dias(),
    });
    await setDoc(doc(db, 'talleres', 'T1'), {
      nombre: 'Taller Uno', whatsapp: '6641110000', ciudad: 'Tijuana', logoUrl: '', ownerUid: 't1', activo: true,
      creadoAt: new Date(), aceptacionVersion: 'v1',
      avisoPrivacidad: { modo: 'generado', versionPlantilla: 'aviso-1', fecha: new Date() },
    });
    await setDoc(doc(db, 'usuarios', 't1'), { rol: 'taller', tallerId: 'T1', email: 't1@prueba.mx' });
    await setDoc(doc(db, 'solicitudesPiezas', 'SP1'), {
      tallerId: 'T1', tallerNombre: 'Taller Uno', vehiculo: { marca: 'Nissan', modelo: 'Sentra', anio: 2001 },
      pieza: 'Defensa delantera', nota: '', estado: 'baja-california', estadoSolicitud: 'abierta', yonkeElegido: null,
      creadoAt: new Date(), expiraAt: en5Dias(),
    });
  });
}

const como = (uid) => env.authenticatedContext(uid).firestore();
const sinReglas = (fn) => env.withSecurityRulesDisabled((ctx) => fn(ctx.firestore()));

// Mismo guardado que la pantalla (src/app/panel/terminosYonke.js): historial + aceptacionLegal en un lote.
function aceptar(uid, yonkeId, version = VIGENTE, { historial = true, ficha = true, fechaFicha = serverTimestamp(), extraHistorial = {} } = {}) {
  const db = como(uid);
  const lote = writeBatch(db);
  if (historial) lote.set(doc(db, 'yonkes', yonkeId, 'aceptaciones', version), { version, fecha: serverTimestamp(), ...extraHistorial });
  if (ficha) lote.update(doc(db, 'yonkes', yonkeId), { aceptacionLegal: { version, fecha: fechaFicha } });
  return lote.commit();
}

// Mismo guardado que el registro (src/app/panel/registro/page.js): ficha nueva + historial en un lote.
function registrar(uid, yonkeId, version = VIGENTE, { historial = true, conAceptacion = true } = {}) {
  const db = como(uid);
  const lote = writeBatch(db);
  const ficha = {
    nombre: 'Nuevo', direccion: 'Calle 1', estado: 'baja-california', ciudad: 'tijuana', telefono: '6641234567',
    whatsapp: '6641234567', metodosPago: [], plan: 'freemium', activo: true, fechaRegistro: new Date(), ownerUid: uid,
  };
  if (conAceptacion) ficha.aceptacionLegal = { version, fecha: serverTimestamp() };
  lote.set(doc(db, 'yonkes', yonkeId), ficha);
  if (historial) lote.set(doc(db, 'yonkes', yonkeId, 'aceptaciones', version), { version, fecha: serverTimestamp() });
  return lote.commit();
}

// Venta que genera confirmar una reservación (src/app/panel/reservaciones/page.js).
const ventaDeReservacion = (uid, yonkeId, reservaId, extra = {}) => setDoc(doc(collection(como(uid), 'ventas')), {
  reservaId, yonkeId, numeroPedido: 'R-1', nombreCliente: 'Ana', piezaVendida: 'Faro', monto: 500, fecha: new Date(), ...extra,
});
// Venta manual "Otra..." (src/app/panel/venta-manual/page.js).
const ventaManual = (uid, yonkeId) => setDoc(doc(collection(como(uid), 'ventas')), {
  numeroPedido: 'M-2', yonkeId, origen: 'manual', vehiculo: { marca: 'Nissan', modelo: 'Sentra', ano: 2005 },
  monto: 300, fecha: new Date(), partSource: 'custom', piezaVendida: 'Otra',
});
const cancelarVenta = (uid, ventaId) => updateDoc(doc(como(uid), 'ventas', ventaId), { cancelada: true, canceladaAt: serverTimestamp() });

// Todas las escrituras bloqueables de un yonke sobre su propio negocio.
const escriturasBloqueables = (uid, Y) => {
  const db = como(uid);
  return {
    'ficha: nombre': () => updateDoc(doc(db, 'yonkes', Y), { nombre: 'Otro nombre' }),
    'ficha: logo y color': () => updateDoc(doc(db, 'yonkes', Y), { logoUrl: 'https://x/logo.png', 'branding.colorPrimario': '#000000' }),
    'ficha: horario y métodos de pago (setDoc merge del perfil)': () => setDoc(doc(db, 'yonkes', Y), { horario: 'L-V', metodosPago: ['efectivo'] }, { merge: true }),
    'ficha: garantía': () => setDoc(doc(db, 'yonkes', Y), { garantia: { dias: 30 } }, { merge: true }),
    'ficha: datos fiscales de reciclaje': () => setDoc(doc(db, 'yonkes', Y), { fiscalReciclaje: { rfc: 'XAXX010101000' } }, { merge: true }),
    'ficha: promociones': () => updateDoc(doc(db, 'yonkes', Y), { promoImagenes: [] }),
    'ficha: interruptor de alertas de otros estados': () => updateDoc(doc(db, 'yonkes', Y), { verAlertasOtrosEstados: true }),
    'vehículo: agregar': () => setDoc(doc(db, 'yonkes', Y, 'vehiculos', 'V9'), { marca: 'Ford', modelo: 'Focus', ano: 2010 }),
    'vehículo: editar': () => updateDoc(doc(db, 'yonkes', Y, 'vehiculos', 'V1'), { modelo: 'Tsuru' }),
    'vehículo: sacar del inventario': () => updateDoc(doc(db, 'yonkes', Y, 'vehiculos', 'V1'), { vendidoAt: serverTimestamp() }),
    'vehículo: borrar': () => deleteDoc(doc(db, 'yonkes', Y, 'vehiculos', 'V1')),
    'pieza: editar precio': () => updateDoc(doc(db, 'yonkes', Y, 'vehiculos', 'V1', 'piezas', 'P1'), { precio: 500 }),
    'motor: agregar': () => setDoc(doc(db, 'yonkes', Y, 'motores', 'M9'), { tipo: 'motor' }),
    'motor: marcar no disponible': () => updateDoc(doc(db, 'yonkes', Y, 'motores', 'M1'), { disponible: false }),
    'pieza suelta: borrar': () => deleteDoc(doc(db, 'yonkes', Y, 'piezasSueltas', 'S1')),
    'reciclaje: material': () => updateDoc(doc(db, 'yonkes', Y, 'materialesReciclaje', 'MR1'), { precioPorKilo: 120 }),
    'reciclaje: compra': () => setDoc(doc(db, 'yonkes', Y, 'comprasReciclaje', 'CR9'), { total: 50 }),
    'nota de garantía': () => setDoc(doc(db, 'yonkes', Y, 'notasGarantia', 'N9'), { ventaId: 'VM1' }),
    'venta manual': () => ventaManual(uid, Y),
    'cancelar una venta manual': () => cancelarVenta(uid, 'VM1'),
  };
};

before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-terminos-yonkes',
    firestore: { rules: reglas, host: '127.0.0.1', port: 8181 },
  });
});
after(async () => { await env.cleanup(); });

describe('sin config/terminosYonkes no se exige nada', () => {
  it('un yonke con versión vieja hace todas sus escrituras normales', async () => {
    for (const [nombre, escribir] of Object.entries(escriturasBloqueables('o1', 'Y1'))) {
      await sembrar({ config: false });
      await assertSucceeds(escribir(), nombre);
    }
  });
  it('un yonke que nunca aceptó (creado por el admin) también', async () => {
    await sembrar({ config: false });
    await assertSucceeds(updateDoc(doc(como('o2'), 'yonkes', 'Y2'), { nombre: 'Editado' }));
    await assertSucceeds(setDoc(doc(como('o2'), 'yonkes', 'Y2', 'vehiculos', 'V9'), { marca: 'Ford' }));
  });
  it('el registro de hoy (con o sin aceptacionLegal) sigue pasando', async () => {
    await sembrar({ config: false });
    await assertSucceeds(registrar('n1', 'N1', VIEJA, { historial: false }));
    await assertSucceeds(registrar('n2', 'N2', VIEJA, { historial: false, conAceptacion: false }));
  });
  it('el registro nuevo (ficha + historial en un lote) también pasa', async () => {
    await sembrar({ config: false });
    await assertSucceeds(registrar('n3', 'N3', VIEJA));
  });
  it('el dueño no puede cambiarse aceptacionLegal a mano (no hay versión que aceptar)', async () => {
    await sembrar({ config: false });
    await assertFails(aceptar('o1', 'Y1', VIGENTE));
    await assertFails(updateDoc(doc(como('o1'), 'yonkes', 'Y1'), { aceptacionLegal: { version: VIGENTE, fecha: serverTimestamp() } }));
  });
});

describe('con config/terminosYonkes y sin la versión vigente: bloqueado', () => {
  it('un yonke con versión vieja no puede ninguna escritura de negocio, inventario, reciclaje, notas ni venta manual', async () => {
    for (const [nombre, escribir] of Object.entries(escriturasBloqueables('o1', 'Y1'))) {
      await sembrar();
      await assertFails(escribir(), nombre);
    }
  });
  it('un yonke sin aceptacionLegal (creado por el admin) cuenta como no aceptado', async () => {
    await sembrar();
    await sinReglas(async (db) => {
      await setDoc(doc(db, 'yonkes', 'Y2', 'vehiculos', 'V1'), { marca: 'Nissan' });
    });
    await assertFails(updateDoc(doc(como('o2'), 'yonkes', 'Y2'), { nombre: 'Editado' }));
    await assertFails(setDoc(doc(como('o2'), 'yonkes', 'Y2', 'vehiculos', 'V9'), { marca: 'Ford' }));
    await assertFails(updateDoc(doc(como('o2'), 'yonkes', 'Y2', 'vehiculos', 'V1'), { vendidoAt: deleteField() }));
  });
  it('la venta manual con pieza del inventario (transacción) tampoco pasa', async () => {
    await sembrar();
    const db = como('o1');
    await assertFails(runTransaction(db, async (tx) => {
      const piezaRef = doc(db, 'yonkes', 'Y1', 'vehiculos', 'V1', 'piezas', 'P1');
      await tx.get(piezaRef);
      tx.update(piezaRef, { disponible: false });
      tx.set(doc(collection(db, 'ventas')), { numeroPedido: 'M-3', yonkeId: 'Y1', origen: 'manual', monto: 1, fecha: new Date(), piezaId: 'P1' });
    }));
  });
});

describe('con config/terminosYonkes y sin la versión vigente: siempre permitido', () => {
  it('ver su ficha, inventario y notas', async () => {
    await sembrar();
    await assertSucceeds(getDoc(doc(como('o1'), 'yonkes', 'Y1')));
    await assertSucceeds(getDoc(doc(como('o1'), 'yonkes', 'Y1', 'vehiculos', 'V1')));
    await assertSucceeds(getDoc(doc(como('o1'), 'yonkes', 'Y1', 'notasGarantia', 'N1')));
    await assertSucceeds(getDoc(doc(como('o1'), 'yonkes', 'Y1', 'materialesReciclaje', 'MR1')));
  });
  it('la marca automática ultimaActividadAt', async () => {
    await sembrar();
    await assertSucceeds(updateDoc(doc(como('o1'), 'yonkes', 'Y1'), { ultimaActividadAt: serverTimestamp() }));
  });
  it('pero no puede colar otro cambio junto con ultimaActividadAt', async () => {
    await sembrar();
    await assertFails(updateDoc(doc(como('o1'), 'yonkes', 'Y1'), { ultimaActividadAt: serverTimestamp(), nombre: 'Colado' }));
  });
  it('responder una alerta de cliente', async () => {
    await sembrar();
    await assertSucceeds(setDoc(doc(como('o1'), 'pedidosClientes', 'PC1', 'respuestas', 'Y1'), {
      yonkeId: 'Y1', yonkeNombre: 'Yonke uno', whatsapp: '6641111111', tieneLaPieza: true, precio: 1500, nota: '',
      creadoAt: serverTimestamp(), expiraAt: (await sinReglasLeer('pedidosClientes', 'PC1')).expiraAt,
    }));
  });
  it('responder un pedido de taller', async () => {
    await sembrar();
    await assertSucceeds(setDoc(doc(como('o1'), 'solicitudesPiezas', 'SP1', 'respuestas', 'Y1'), {
      yonkeId: 'Y1', yonkeNombre: 'Yonke uno', tieneLaPieza: false, nota: '', whatsapp: '6641111111',
      creadoAt: serverTimestamp(), expiraAt: (await sinReglasLeer('solicitudesPiezas', 'SP1')).expiraAt,
    }));
  });
  it('confirmar una reservación: la venta que genera y marcarla completada', async () => {
    await sembrar();
    await assertSucceeds(ventaDeReservacion('o1', 'Y1', 'R1'));
    await assertSucceeds(updateDoc(doc(como('o1'), 'reservaciones', 'R1'), { estado: 'completada' }));
  });
  it('cancelar una reservación o marcarla expirada', async () => {
    await sembrar();
    await assertSucceeds(updateDoc(doc(como('o1'), 'reservaciones', 'R1'), { estado: 'cancelada' }));
  });
  it('cancelar una venta que vino de una reservación', async () => {
    await sembrar();
    await assertSucceeds(cancelarVenta('o1', 'VR1'));
  });
  it('la "venta de reservación" no sirve para colar ventas: reservación ya completada, ajena, inexistente o con origen manual', async () => {
    await sembrar();
    await assertFails(ventaDeReservacion('o1', 'Y1', 'R2'));
    await assertFails(ventaDeReservacion('o1', 'Y1', 'R9'));
    await assertFails(ventaDeReservacion('o1', 'Y1', 'NO_EXISTE'));
    await assertFails(ventaDeReservacion('o1', 'Y1', 'R1', { origen: 'manual' }));
    await assertFails(ventaDeReservacion('o2', 'Y2', 'R1'));
  });
});

async function sinReglasLeer(coleccion, id) {
  let datos;
  await sinReglas(async (db) => { datos = (await getDoc(doc(db, coleccion, id))).data(); });
  return datos;
}

describe('aceptar los términos (aviso ACEPTO)', () => {
  it('acepta la versión vigente: historial + aceptacionLegal en un lote; luego ya puede editar todo', async () => {
    await sembrar();
    await assertSucceeds(aceptar('o1', 'Y1'));
    for (const [nombre, escribir] of Object.entries(escriturasBloqueables('o1', 'Y1'))) {
      if (nombre === 'cancelar una venta manual') continue; // ya se probó abajo, deja la venta cancelada
      await assertSucceeds(escribir(), nombre);
    }
    await assertSucceeds(cancelarVenta('o1', 'VM1'));
  });
  it('un yonke creado por el admin también acepta y queda desbloqueado', async () => {
    await sembrar();
    await assertSucceeds(aceptar('o2', 'Y2'));
    await assertSucceeds(updateDoc(doc(como('o2'), 'yonkes', 'Y2'), { nombre: 'Editado' }));
  });
  it('no se acepta una versión que no es la vigente', async () => {
    await sembrar();
    await assertFails(aceptar('o1', 'Y1', VIEJA));
    await assertFails(aceptar('o1', 'Y1', '2099-01-01'));
  });
  it('sin la entrada del historial, o el historial solo, no pasa', async () => {
    await sembrar();
    await assertFails(aceptar('o1', 'Y1', VIGENTE, { historial: false }));
    await assertFails(aceptar('o1', 'Y1', VIGENTE, { ficha: false }));
  });
  it('la fecha debe ser la hora del servidor, sin campos extra', async () => {
    await sembrar();
    await assertFails(aceptar('o1', 'Y1', VIGENTE, { fechaFicha: new Date() }));
    await assertFails(aceptar('o1', 'Y1', VIGENTE, { extraHistorial: { ip: '1.2.3.4' } }));
  });
  it('no puede aceptar y a la vez cambiar otra cosa de la ficha', async () => {
    await sembrar();
    const db = como('o1');
    const lote = writeBatch(db);
    lote.set(doc(db, 'yonkes', 'Y1', 'aceptaciones', VIGENTE), { version: VIGENTE, fecha: serverTimestamp() });
    lote.update(doc(db, 'yonkes', 'Y1'), { aceptacionLegal: { version: VIGENTE, fecha: serverTimestamp() }, nombre: 'Colado' });
    await assertFails(lote.commit());
  });
  it('nadie acepta por otro yonke', async () => {
    await sembrar();
    await assertFails(aceptar('o2', 'Y1'));
  });
  it('el historial no se modifica; solo el admin lo borra', async () => {
    await sembrar();
    await assertSucceeds(aceptar('o1', 'Y1'));
    const entrada = (uid) => doc(como(uid), 'yonkes', 'Y1', 'aceptaciones', VIGENTE);
    await assertSucceeds(getDoc(entrada('o1')));
    await assertFails(getDoc(entrada('o2')));
    await assertFails(updateDoc(entrada('o1'), { fecha: serverTimestamp() }));
    await assertFails(updateDoc(entrada('adm'), { fecha: serverTimestamp() }));
    await assertFails(deleteDoc(entrada('o1')));
    await assertSucceeds(deleteDoc(entrada('adm')));
  });
  it('ya aceptada, no puede cambiar aceptacionLegal a otra versión', async () => {
    await sembrar();
    await assertSucceeds(aceptar('o1', 'Y1'));
    await assertFails(updateDoc(doc(como('o1'), 'yonkes', 'Y1'), { aceptacionLegal: { version: VIEJA, fecha: serverTimestamp() } }));
    await assertFails(updateDoc(doc(como('o1'), 'yonkes', 'Y1'), { aceptacionLegal: deleteField() }));
  });
  it('apagar la exigencia (borrar config/terminosYonkes) desbloquea de inmediato', async () => {
    await sembrar();
    await assertFails(updateDoc(doc(como('o1'), 'yonkes', 'Y1'), { nombre: 'Antes' }));
    await sinReglas((db) => deleteDoc(doc(db, 'config', 'terminosYonkes')));
    await assertSucceeds(updateDoc(doc(como('o1'), 'yonkes', 'Y1'), { nombre: 'Después' }));
  });
});

describe('registro de un yonke nuevo con config/terminosYonkes', () => {
  it('se registra con la versión vigente (ficha + historial) y luego crea su usuario y edita sin aviso', async () => {
    await sembrar();
    await assertSucceeds(registrar('n1', 'N1'));
    await assertSucceeds(setDoc(doc(como('n1'), 'usuarios', 'n1'), { rol: 'yonke', yonkeId: 'N1', email: 'n1@prueba.mx', fechaRegistro: new Date() }));
    await assertSucceeds(updateDoc(doc(como('n1'), 'yonkes', 'N1'), { nombre: 'Ya puedo editar' }));
    await assertSucceeds(setDoc(doc(como('n1'), 'yonkes', 'N1', 'vehiculos', 'V1'), { marca: 'Ford' }));
  });
  it('no se registra con otra versión, sin aceptacionLegal o sin historial', async () => {
    await sembrar();
    await assertFails(registrar('n2', 'N2', VIEJA));
    await assertFails(registrar('n3', 'N3', VIGENTE, { conAceptacion: false, historial: false }));
    await assertFails(registrar('n4', 'N4', VIGENTE, { historial: false }));
  });
  it('alguien ajeno no puede crear el historial de un yonke recién registrado', async () => {
    await sembrar();
    await assertSucceeds(registrar('n5', 'N5'));
    await assertFails(setDoc(doc(como('x9'), 'yonkes', 'N5', 'aceptaciones', 'otra'), { version: 'otra', fecha: serverTimestamp() }));
  });
});

describe('admin', () => {
  it('sin aceptar nada, edita ficha, inventario, reciclaje, notas y ventas de cualquier yonke', async () => {
    await sembrar();
    const db = como('adm');
    await assertSucceeds(updateDoc(doc(db, 'yonkes', 'Y1'), { nombre: 'Por admin', plan: 'premium' }));
    await assertSucceeds(setDoc(doc(db, 'yonkes', 'Y1', 'vehiculos', 'V9'), { marca: 'Ford' }));
    await assertSucceeds(updateDoc(doc(db, 'yonkes', 'Y1', 'vehiculos', 'V1', 'piezas', 'P1'), { precio: 1 }));
    await assertSucceeds(setDoc(doc(db, 'yonkes', 'Y1', 'materialesReciclaje', 'MR9'), { nombre: 'Aluminio' }));
    await assertSucceeds(setDoc(doc(db, 'yonkes', 'Y1', 'notasGarantia', 'N9'), { ventaId: 'VM1' }));
    await assertSucceeds(ventaManual('adm', 'Y1'));
    await assertSucceeds(cancelarVenta('adm', 'VM1'));
  });
  it('crea un yonke sin aceptacionLegal (el yonke verá el aviso al entrar)', async () => {
    await sembrar();
    await assertSucceeds(setDoc(doc(como('adm'), 'yonkes', 'Y8'), { nombre: 'Creado por admin' }));
  });
});

describe('límite de lecturas de las reglas en lotes grandes', () => {
  it('con términos vigentes, borrar un vehículo con 30 piezas en un lote pasa', async () => {
    await sembrar();
    await sinReglas(async (db) => {
      await updateDoc(doc(db, 'yonkes', 'Y1'), { aceptacionLegal: { version: VIGENTE, fecha: new Date() } });
      for (let i = 0; i < 30; i++) await setDoc(doc(db, 'yonkes', 'Y1', 'vehiculos', 'V1', 'piezas', `X${i}`), { nombre: `p${i}` });
    });
    const db = como('o1');
    const lote = writeBatch(db);
    for (let i = 0; i < 30; i++) lote.delete(doc(db, 'yonkes', 'Y1', 'vehiculos', 'V1', 'piezas', `X${i}`));
    lote.delete(doc(db, 'yonkes', 'Y1', 'vehiculos', 'V1', 'piezas', 'P1'));
    lote.delete(doc(db, 'yonkes', 'Y1', 'vehiculos', 'V1'));
    await assertSucceeds(lote.commit());
  });
  it('con términos vigentes, la venta manual con pieza del inventario (transacción) pasa', async () => {
    await sembrar();
    await sinReglas((db) => updateDoc(doc(db, 'yonkes', 'Y1'), { aceptacionLegal: { version: VIGENTE, fecha: new Date() } }));
    const db = como('o1');
    await assertSucceeds(runTransaction(db, async (tx) => {
      const piezaRef = doc(db, 'yonkes', 'Y1', 'vehiculos', 'V1', 'piezas', 'P1');
      await tx.get(piezaRef);
      tx.update(piezaRef, { disponible: false });
      tx.set(doc(collection(db, 'ventas')), { numeroPedido: 'M-3', yonkeId: 'Y1', origen: 'manual', monto: 1, fecha: new Date(), piezaId: 'P1' });
    }));
  });
});
