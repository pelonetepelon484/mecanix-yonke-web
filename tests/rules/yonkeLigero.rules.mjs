// Pruebas de reglas: yonke ligero (rol 'yonkeLigero'). Registro mínimo que SOLO contesta búsquedas
// activas de clientes de su estado, con tope propio (config/pedidosClientes.limiteRespuestasLigero).
// Lo crea y lo completa únicamente el usuario de servicio; todo lo demás le queda cerrado por su rol.
// Comando (desde la raíz del repo):  npm run test:rules
import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import {
  Timestamp, collection, deleteDoc, doc, getDoc, getDocs, query, runTransaction, serverTimestamp, setDoc, updateDoc, where, writeBatch,
} from 'firebase/firestore';

const reglas = readFileSync(new URL('../../firestore.rules', import.meta.url), 'utf8');
let env;
const DIA = 24 * 60 * 60 * 1000;
const en5Dias = () => Timestamp.fromMillis(Date.now() + 5 * DIA);
const vehiculo = { marca: 'Nissan', modelo: 'Sentra', anio: 2005 };
const ESTADO = 'baja-california';
const HOY = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Tijuana', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()).replaceAll('-', '');
const VERSION = '2026-10-26';

const como = (uid) => env.authenticatedContext(uid).firestore();
async function sinReglas(fn) {
  let resultado;
  await env.withSecurityRulesDisabled(async (ctx) => { resultado = await fn(ctx.firestore()); });
  return resultado;
}

const fichaLigera = (ownerUid, extra = {}) => ({
  nombre: 'Yonke Ligero', whatsapp: '6641111111', estado: ESTADO, tipoRegistro: 'ligero', plan: 'freemium', activo: true,
  fechaRegistro: new Date(), ownerUid, aceptacionLegal: { version: VERSION, fecha: new Date() }, ...extra,
});

async function pedido(id, extra = {}) {
  await sinReglas((db) => setDoc(doc(db, 'pedidosClientes', id), {
    vehiculo, pieza: 'Alternador', estado: ESTADO, estadoPedido: 'abierta', creadoAt: Timestamp.now(), expiraAt: en5Dias(), ...extra,
  }));
}

// YL: ligero de BC (dueño l1). Y1: yonke completo de BC (dueño c1). P1: alerta abierta de BC.
// PS: de Sonora que acepta otros estados. PV: vencida. S1: pedido de un taller de BC.
async function sembrar({ configPedidos = { habilitado: true, limiteRespuestasDiarias: 50, limiteRespuestasLigero: 15 }, ligeros = { habilitado: true } } = {}) {
  await env.clearFirestore();
  await sinReglas(async (db) => {
    await setDoc(doc(db, 'config', 'pedidosClientes'), configPedidos);
    await setDoc(doc(db, 'config', 'solicitudesPiezas'), { habilitado: true });
    if (ligeros) await setDoc(doc(db, 'config', 'yonkesLigeros'), ligeros);
    await setDoc(doc(db, 'usuarios', 'adm'), { rol: 'admin' });
    await setDoc(doc(db, 'usuarios', 'svc'), { rol: 'servicio' });
    await setDoc(doc(db, 'yonkes', 'YL'), fichaLigera('l1'));
    await setDoc(doc(db, 'usuarios', 'l1'), { rol: 'yonkeLigero', yonkeId: 'YL', email: '6641111111@interno.mx', fechaRegistro: new Date() });
    await setDoc(doc(db, 'yonkes', 'Y1'), { nombre: 'Yonke Completo', whatsapp: '6642222222', estado: ESTADO, activo: true, ownerUid: 'c1', plan: 'freemium' });
    await setDoc(doc(db, 'usuarios', 'c1'), { rol: 'yonke', yonkeId: 'Y1', email: 'c1@prueba.mx', fechaRegistro: new Date() });
    await setDoc(doc(db, 'solicitudesPiezas', 'S1'), {
      tallerId: 'T1', tallerNombre: 'Taller Uno', vehiculo, pieza: 'Faro', nota: '', estado: ESTADO, estadoSolicitud: 'abierta', yonkeElegido: null,
      creadoAt: Timestamp.now(), expiraAt: en5Dias(),
    });
    await setDoc(doc(db, 'busquedasResumen', 'B1'), { estadoGeografico: 'bcn', pieza: 'Faro' });
  });
  await pedido('P1');
  await pedido('PS', { estado: 'sonora', aceptaOtrosEstados: true });
  await pedido('PV', { expiraAt: Timestamp.fromMillis(Date.now() - DIA) });
}

// Igual que responderPedido() en src/app/panel/pedidosClientesDatos.js: respuesta + contador juntos.
async function responder(uid, yonkeId, pedidoId, { n = 1, cuerpo = {}, sinContador = false } = {}) {
  const db = como(uid);
  const padre = await sinReglas(async (d) => (await getDoc(doc(d, 'pedidosClientes', pedidoId))).data());
  const yonke = await sinReglas(async (d) => (await getDoc(doc(d, 'yonkes', yonkeId))).data());
  const datos = {
    yonkeId, yonkeNombre: yonke.nombre, whatsapp: yonke.whatsapp, tieneLaPieza: true, precio: 1500, nota: '',
    creadoAt: serverTimestamp(), expiraAt: padre.expiraAt, dia: HOY, ...cuerpo,
  };
  for (const k of Object.keys(datos)) if (datos[k] === undefined) delete datos[k];
  const lote = writeBatch(db);
  lote.set(doc(db, 'pedidosClientes', pedidoId, 'respuestas', yonkeId), datos);
  if (!sinContador) lote.set(doc(db, 'yonkes', yonkeId, 'respuestasDiarias', HOY), { count: n });
  return lote.commit();
}
const contadorEn = (yonkeId, count) => sinReglas((db) => setDoc(doc(db, 'yonkes', yonkeId, 'respuestasDiarias', HOY), { count }));

// Alta del servidor: ficha, historial y usuario en un solo guardado.
function alta(uid, id, { ficha = {}, usuario = {}, historial = true, comoUid = 'svc' } = {}) {
  const db = como(comoUid);
  const version = ficha.aceptacionLegal?.version ?? VERSION;
  const lote = writeBatch(db);
  const datos = {
    ...fichaLigera(uid), fechaRegistro: serverTimestamp(), aceptacionLegal: { version, fecha: serverTimestamp() }, ...ficha,
  };
  for (const k of Object.keys(datos)) if (datos[k] === undefined) delete datos[k];
  lote.set(doc(db, 'yonkes', id), datos);
  if (historial) lote.set(doc(db, 'yonkes', id, 'aceptaciones', version), { version, fecha: serverTimestamp() });
  lote.set(doc(db, 'usuarios', uid), { rol: 'yonkeLigero', yonkeId: id, email: `${uid}@interno.mx`, fechaRegistro: serverTimestamp(), ...usuario });
  return lote.commit();
}

// "Completar mi registro" del servidor: ficha + rol juntos (y el correo, si lo dejó).
function completar({ ficha = {}, rol = 'yonke', correo = null, comoUid = 'svc', uid = 'l1', id = 'YL' } = {}) {
  const db = como(comoUid);
  const lote = writeBatch(db);
  lote.update(doc(db, 'yonkes', id), { tipoRegistro: 'completo', direccion: 'Calle 1', ciudad: 'tijuana', telefono: '6641111111', metodosPago: [], ...ficha });
  lote.update(doc(db, 'usuarios', uid), { rol });
  if (correo) lote.set(doc(db, 'yonkes', id, 'privado', 'contacto'), { email: correo });
  return lote.commit();
}

before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-yonke-ligero',
    firestore: { rules: reglas, host: '127.0.0.1', port: 8181 },
  });
});
after(async () => { await env.cleanup(); });
beforeEach(() => sembrar());

describe('yonke ligero: lo único que puede hacer', () => {
  it('ve las búsquedas activas abiertas de su estado', async () => {
    const q = query(collection(como('l1'), 'pedidosClientes'), where('estado', '==', ESTADO), where('estadoPedido', '==', 'abierta'));
    assert.ok((await assertSucceeds(getDocs(q))).size >= 1);
    await assertSucceeds(getDoc(doc(como('l1'), 'pedidosClientes', 'P1')));
  });
  it('responde "la tengo" y "no la tengo", con su contador en el mismo guardado, y lee su respuesta', async () => {
    await assertSucceeds(responder('l1', 'YL', 'P1'));
    await assertSucceeds(getDoc(doc(como('l1'), 'pedidosClientes', 'P1', 'respuestas', 'YL')));
    await pedido('P2');
    await assertSucceeds(responder('l1', 'YL', 'P2', { n: 2, cuerpo: { tieneLaPieza: false, precio: undefined } }));
    await assertSucceeds(getDoc(doc(como('l1'), 'yonkes', 'YL', 'respuestasDiarias', HOY)));
  });
  it('registra su celular para recibir avisos, y lo borra', async () => {
    const id = `YL_${'a'.repeat(64)}`;
    const ref = doc(como('l1'), 'dispositivosPush', id);
    await assertSucceeds(setDoc(ref, { yonkeId: 'YL', token: 'token', creadoAt: serverTimestamp() }));
    await assertSucceeds(getDoc(ref));
    await assertSucceeds(deleteDoc(ref));
    await assertFails(setDoc(doc(como('l1'), 'dispositivosPush', `Y1_${'a'.repeat(64)}`), { yonkeId: 'Y1', token: 'token', creadoAt: serverTimestamp() }));
  });
  it('acepta términos nuevos, y nada más de su ficha', async () => {
    await sinReglas((db) => setDoc(doc(db, 'config', 'terminosYonkes'), { version: 'V2' }));
    const db = como('l1');
    const lote = writeBatch(db);
    lote.update(doc(db, 'yonkes', 'YL'), { aceptacionLegal: { version: 'V2', fecha: serverTimestamp() } });
    lote.set(doc(db, 'yonkes', 'YL', 'aceptaciones', 'V2'), { version: 'V2', fecha: serverTimestamp() });
    await assertSucceeds(lote.commit());
    await assertFails(updateDoc(doc(db, 'yonkes', 'YL'), { aceptacionLegal: { version: 'V2', fecha: serverTimestamp() }, nombre: 'Otro' }));
  });
});

describe('yonke ligero: tope diario', () => {
  // Igual que responderPedido() con limite (src/app/panel/pedidosClientesDatos.js): lee el contador
  // y guarda respuesta y contador en una transacción.
  const responderComoLaPantalla = async (pedidoId) => {
    const db = como('l1');
    const padre = await sinReglas(async (d) => (await getDoc(doc(d, 'pedidosClientes', pedidoId))).data());
    const contadorRef = doc(db, 'yonkes', 'YL', 'respuestasDiarias', HOY);
    return runTransaction(db, async (t) => {
      const snap = await t.get(contadorRef);
      const n = snap.exists() ? snap.data().count : 0;
      t.set(doc(db, 'pedidosClientes', pedidoId, 'respuestas', 'YL'), {
        yonkeId: 'YL', yonkeNombre: 'Yonke Ligero', whatsapp: '6641111111', tieneLaPieza: true, nota: '', precio: 1500,
        creadoAt: serverTimestamp(), expiraAt: padre.expiraAt, dia: HOY,
      });
      t.set(contadorRef, { count: n + 1 });
    });
  };
  it('la transacción real de la pantalla pasa, desde cero y con contador, y la 16 no', async () => {
    await assertSucceeds(responderComoLaPantalla('P1'));
    await contadorEn('YL', 14);
    await pedido('P2');
    await assertSucceeds(responderComoLaPantalla('P2'));
    await pedido('P3');
    await assertFails(responderComoLaPantalla('P3'));
  });
  it('responde hasta 15, una por una, y la 16 se rechaza', async () => {
    for (let i = 1; i <= 15; i++) {
      await pedido(`T${i}`);
      await assertSucceeds(responder('l1', 'YL', `T${i}`, { n: i }));
    }
    await pedido('T16');
    await assertFails(responder('l1', 'YL', 'T16', { n: 16 }));
  });
  it('NO sin `dia`, sin contador, con el contador sin subir o saltándoselo', async () => {
    await assertFails(responder('l1', 'YL', 'P1', { cuerpo: { dia: undefined }, sinContador: true }));
    await assertFails(responder('l1', 'YL', 'P1', { sinContador: true }));
    await contadorEn('YL', 5);
    await assertFails(responder('l1', 'YL', 'P1', { n: 5 }));
    await assertFails(responder('l1', 'YL', 'P1', { n: 3 }));
    await assertFails(responder('l1', 'YL', 'P1', { cuerpo: { dia: '19990101' } }));
  });
  it('NO puede bajar ni borrar su contador', async () => {
    await contadorEn('YL', 10);
    const ref = doc(como('l1'), 'yonkes', 'YL', 'respuestasDiarias', HOY);
    await assertFails(setDoc(ref, { count: 1 }));
    await assertFails(deleteDoc(ref));
  });
  it('sin limiteRespuestasLigero NO responde (falla cerrada), aunque exista el tope del Básico', async () => {
    await sembrar({ configPedidos: { habilitado: true, limiteRespuestasDiarias: 50 } });
    await assertFails(responder('l1', 'YL', 'P1'));
    for (const limite of [0, '15', 2.5]) {
      await sembrar({ configPedidos: { habilitado: true, limiteRespuestasLigero: limite } });
      await assertFails(responder('l1', 'YL', 'P1'));
    }
  });
  it('NO con la función de pedidos apagada', async () => {
    await sembrar({ configPedidos: { habilitado: false, limiteRespuestasLigero: 15 } });
    await assertFails(responder('l1', 'YL', 'P1'));
  });
  it('dándole Premium no se le quita el tope: el ilimitado es del registro completo', async () => {
    await sinReglas((db) => updateDoc(doc(db, 'yonkes', 'YL'), { plan: 'premium' }));
    await contadorEn('YL', 15);
    await assertFails(responder('l1', 'YL', 'P1', { n: 16 }));
  });
});

describe('yonke ligero: todo lo demás, cerrado', () => {
  it('NO responde alertas de otro estado (aunque acepten), vencidas, cerradas ni a nombre de otro', async () => {
    await assertFails(getDoc(doc(como('l1'), 'pedidosClientes', 'PS')));
    await assertFails(responder('l1', 'YL', 'PS'));
    await assertFails(responder('l1', 'YL', 'PV'));
    await pedido('PC', { estadoPedido: 'cerrada' });
    await assertFails(responder('l1', 'YL', 'PC'));
    await assertFails(responder('l1', 'Y1', 'P1'));
  });
  it('NO con nombre o WhatsApp distintos a los de su ficha, ni dos veces', async () => {
    await assertFails(responder('l1', 'YL', 'P1', { cuerpo: { yonkeNombre: 'Otro' } }));
    await assertFails(responder('l1', 'YL', 'P1', { cuerpo: { whatsapp: '6649999999' } }));
    await assertSucceeds(responder('l1', 'YL', 'P1'));
    await assertFails(responder('l1', 'YL', 'P1', { n: 2 }));
  });
  it('desactivado por el admin ya no ve ni responde', async () => {
    await sinReglas((db) => updateDoc(doc(db, 'yonkes', 'YL'), { activo: false }));
    await assertFails(responder('l1', 'YL', 'P1'));
    await assertFails(getDoc(doc(como('l1'), 'pedidosClientes', 'P1')));
  });
  it('NO cambia nada de su ficha: nombre, WhatsApp, estado, tipo, plan ni marcas', async () => {
    const ref = doc(como('l1'), 'yonkes', 'YL');
    for (const cambio of [
      { nombre: 'Otro' }, { whatsapp: '6649999999' }, { estado: 'sonora' }, { tipoRegistro: 'completo' }, { plan: 'premium' }, { premiumHasta: new Date('2030-01-01') },
      { verificado: true }, { enviosNacionales: true }, { activo: false }, { subdominio: 's' }, { ciudad: 'tijuana' }, { logoUrl: 'x' }, { ultimaActividadAt: new Date() },
    ]) await assertFails(updateDoc(ref, cambio));
    await assertFails(deleteDoc(ref));
  });
  it('NO se asciende solo ni cambia su rol', async () => {
    const ref = doc(como('l1'), 'usuarios', 'l1');
    await assertFails(updateDoc(ref, { rol: 'yonke' }));
    await assertFails(setDoc(ref, { rol: 'yonke', yonkeId: 'YL', email: 'x@x.mx', fechaRegistro: new Date() }));
    await assertFails(updateDoc(ref, { yonkeId: 'Y1' }));
    await assertFails(completar({ comoUid: 'l1' }));
  });
  it('NO toca inventario, reciclaje, garantías ni vehículos de alertas', async () => {
    const db = como('l1');
    for (const sub of ['vehiculos', 'motores', 'piezasSueltas', 'materialesReciclaje', 'comprasReciclaje', 'notasGarantia', 'vehiculosAlerta']) {
      await assertFails(setDoc(doc(db, 'yonkes', 'YL', sub, 'X'), { nombre: 'x', marca: 'Ford' }));
    }
  });
  it('NO lee ni escribe ventas, reservaciones, demanda ni otro yonke', async () => {
    const db = como('l1');
    await assertFails(setDoc(doc(db, 'ventas', 'V1'), { yonkeId: 'YL', pieza: 'x' }));
    await assertFails(setDoc(doc(db, 'ventasPublicas', 'F1'), { yonkeId: 'YL' }));
    await assertFails(getDocs(query(collection(db, 'reservaciones'), where('yonkeId', '==', 'YL'))));
    await assertFails(getDoc(doc(db, 'busquedasResumen', 'B1')));
    await assertFails(setDoc(doc(db, 'yonkes', 'OTRO'), { nombre: 'x', ownerUid: 'l1' }));
    await assertFails(updateDoc(doc(db, 'yonkes', 'Y1'), { nombre: 'x' }));
  });
  it('NO ve ni responde pedidos de talleres', async () => {
    const db = como('l1');
    await assertFails(getDoc(doc(db, 'solicitudesPiezas', 'S1')));
    await assertFails(setDoc(doc(db, 'solicitudesPiezas', 'S1', 'respuestas', 'YL'), {
      yonkeId: 'YL', yonkeNombre: 'Yonke Ligero', whatsapp: '6641111111', tieneLaPieza: true, precio: 100, nota: '', creadoAt: serverTimestamp(), expiraAt: en5Dias(),
    }));
  });
});

describe('yonke ligero: alta, solo el servidor', () => {
  it('el usuario de servicio lo crea con ficha, historial y usuario juntos', async () => {
    await assertSucceeds(alta('n1', 'N1'));
    const f = await sinReglas(async (db) => (await getDoc(doc(db, 'yonkes', 'N1'))).data());
    assert.equal(f.tipoRegistro, 'ligero');
  });
  it('con config/terminosYonkes, solo con la versión vigente', async () => {
    await sinReglas((db) => setDoc(doc(db, 'config', 'terminosYonkes'), { version: 'V2' }));
    await assertFails(alta('n1', 'N1'));
    await assertSucceeds(alta('n2', 'N2', { ficha: { aceptacionLegal: { version: 'V2', fecha: serverTimestamp() } } }));
  });
  it('NO con la bandera apagada, ausente o de texto', async () => {
    for (const ligeros of [{ habilitado: false }, null, { habilitado: 'true' }]) {
      await sembrar({ ligeros });
      await assertFails(alta('n1', 'N1'));
    }
  });
  it('nadie más: ni la persona, ni otro yonke, y un cliente no puede darse el rol', async () => {
    await assertFails(alta('n1', 'N1', { comoUid: 'n1' }));
    await assertFails(alta('n1', 'N1', { comoUid: 'c1' }));
    await assertFails(setDoc(doc(como('n3'), 'yonkes', 'N3'), fichaLigera('n3')));
    await assertFails(setDoc(doc(como('n4'), 'usuarios', 'n4'), { rol: 'yonkeLigero', yonkeId: 'YL', email: 'a@b.mx', fechaRegistro: new Date() }));
  });
  it('NO con marcas del admin, campos de más o datos inválidos', async () => {
    for (const [i, ficha] of [
      { verificado: true }, { enviosNacionales: true }, { subdominio: 's' }, { plan: 'premium' }, { activo: false }, { premiumHasta: new Date('2030-01-01') },
      { ciudad: 'tijuana' }, { tipoRegistro: 'completo' }, { nombre: '' }, { nombre: 'n'.repeat(101) }, { estado: '' },
      { whatsapp: '664 111 1111' }, { whatsapp: '526641111111' }, { whatsapp: '12345' }, { fechaRegistro: new Date('2020-01-01') }, { aceptacionLegal: undefined },
    ].entries()) await assertFails(alta(`m${i}`, `M${i}`, { ficha }));
  });
  it('NO sin historial, ni para quien ya tiene usuario, ni con otro rol', async () => {
    await assertFails(alta('n1', 'N1', { historial: false }));
    await assertFails(alta('c1', 'N2'));
    await assertFails(alta('n3', 'N3', { usuario: { rol: 'yonke' } }));
    await assertFails(alta('n4', 'N4', { usuario: { rol: 'admin' } }));
  });
});

// Igual que guardar() en src/app/lib/yonkeLigero/servicio.js.
function guardarDelServidor(uid, id, huella, { correo = `${uid}@interno.mx` } = {}) {
  const db = como('svc');
  const refHuella = doc(db, 'pedidosClientesLimite', huella);
  return runTransaction(db, async (t) => {
    if ((await t.get(refHuella)).exists()) return 'yaUsada';
    t.set(doc(db, 'yonkes', id), { ...fichaLigera(uid), fechaRegistro: serverTimestamp(), aceptacionLegal: { version: VERSION, fecha: serverTimestamp() } });
    t.set(doc(db, 'yonkes', id, 'aceptaciones', VERSION), { version: VERSION, fecha: serverTimestamp() });
    t.set(doc(db, 'yonkes', id, 'constancias', `privacidad_${VERSION}`), { tipo: 'privacidad', version: VERSION, fecha: serverTimestamp() });
    t.set(doc(db, 'yonkes', id, 'constancias', `autorizacion_${VERSION}`), { tipo: 'autorizacion', version: VERSION, fecha: serverTimestamp(), texto: 'Declaro que estoy autorizado.' });
    t.set(doc(db, 'usuarios', uid), { rol: 'yonkeLigero', yonkeId: id, email: correo, fechaRegistro: serverTimestamp() });
    t.set(refHuella, { count: 1, actualizado: new Date(), expiraEn: Timestamp.fromMillis(Date.now() + DIA) });
    return 'ok';
  });
}

describe('yonke ligero: la transacción del servidor contra las reglas', () => {
  it('guarda todo junto, y el ligero recién creado ya puede responder', async () => {
    assert.equal(await assertSucceeds(guardarDelServidor('n1', 'N1', 'ligeroWa_abc_unico')), 'ok');
    await assertSucceeds(responder('n1', 'N1', 'P1'));
  });
  it('con la huella ya usada no escribe nada', async () => {
    await assertSucceeds(guardarDelServidor('n1', 'N1', 'ligeroWa_abc_unico'));
    assert.equal(await assertSucceeds(guardarDelServidor('n2', 'N2', 'ligeroWa_abc_unico')), 'yaUsada');
    assert.equal(await sinReglas(async (db) => (await getDoc(doc(db, 'yonkes', 'N2'))).exists()), false);
  });
  it('NO con la bandera apagada: la transacción completa falla', async () => {
    await sembrar({ ligeros: { habilitado: false } });
    await assertFails(guardarDelServidor('n1', 'N1', 'ligeroWa_abc_unico'));
    assert.equal(await sinReglas(async (db) => (await getDoc(doc(db, 'pedidosClientesLimite', 'ligeroWa_abc_unico'))).exists()), false);
  });
});

describe('yonke ligero: completar el registro, solo el servidor', () => {
  it('pasa a completo con el mismo yonke, y el correo es opcional', async () => {
    await assertSucceeds(completar({ correo: 'real@correo.mx' }));
    const y = await sinReglas(async (db) => (await getDoc(doc(db, 'yonkes', 'YL'))).data());
    assert.equal(y.tipoRegistro, 'completo');
    assert.equal(y.whatsapp, '6641111111');
    assert.equal((await sinReglas(async (db) => (await getDoc(doc(db, 'usuarios', 'l1'))).data())).rol, 'yonke');
  });
  it('conserva lo del día: con 15 hechas sigue hasta el tope de 50', async () => {
    await contadorEn('YL', 15);
    await assertSucceeds(completar());
    await pedido('P2');
    await assertSucceeds(responder('l1', 'YL', 'P2', { n: 16 }));
    await contadorEn('YL', 50);
    await pedido('P3');
    await assertFails(responder('l1', 'YL', 'P3', { n: 51 }));
  });
  it('ya completo funciona como cualquier yonke: edita su ficha y sube inventario', async () => {
    await assertSucceeds(completar());
    const db = como('l1');
    await assertSucceeds(updateDoc(doc(db, 'yonkes', 'YL'), { direccion: 'Otra' }));
    await assertSucceeds(setDoc(doc(db, 'yonkes', 'YL', 'vehiculos', 'V1'), { marca: 'Ford' }));
    await assertFails(updateDoc(doc(db, 'yonkes', 'YL'), { verificado: true }));
  });
  it('NO con datos incompletos, campos de más, otro rol o sobre un yonke que no es ligero', async () => {
    await assertFails(completar({ ficha: { direccion: '' } }));
    await assertFails(completar({ ficha: { ciudad: '' } }));
    await assertFails(completar({ ficha: { telefono: '' } }));
    await assertFails(completar({ ficha: { metodosPago: ['Efectivo'] } }));
    await assertFails(completar({ ficha: { verificado: true } }));
    await assertFails(completar({ ficha: { whatsapp: '6649999999' } }));
    await assertFails(completar({ ficha: { estado: 'sonora' } }));
    await assertFails(completar({ ficha: { nombre: 'Otro' } }));
    await assertFails(completar({ ficha: { plan: 'premium' } }));
    await assertFails(completar({ rol: 'admin' }));
    await assertFails(completar({ uid: 'c1', id: 'Y1' }));
  });
  it('NO cambia el rol sin completar la ficha en el mismo guardado', async () => {
    await assertFails(updateDoc(doc(como('svc'), 'usuarios', 'l1'), { rol: 'yonke' }));
  });
});

describe('liberar un número', () => {
  it('solo el admin quita la huella: ni el servicio, ni el propio yonke', async () => {
    await sinReglas((db) => setDoc(doc(db, 'pedidosClientesLimite', 'ligeroWa_abc_unico'), { count: 1, actualizado: new Date(), expiraEn: en5Dias() }));
    for (const uid of ['svc', 'l1', 'c1']) await assertFails(deleteDoc(doc(como(uid), 'pedidosClientesLimite', 'ligeroWa_abc_unico')));
    await assertSucceeds(deleteDoc(doc(como('adm'), 'pedidosClientesLimite', 'ligeroWa_abc_unico')));
  });
});

describe('los demás siguen igual', () => {
  it('un yonke completo responde con su tope de 50 y sin las reglas del ligero', async () => {
    await contadorEn('Y1', 40);
    await assertSucceeds(responder('c1', 'Y1', 'P1', { n: 41 }));
  });
  it('un yonke completo no puede crearse rol de ligero ni el usuario de servicio tocar otras fichas', async () => {
    await assertFails(updateDoc(doc(como('c1'), 'usuarios', 'c1'), { rol: 'yonkeLigero' }));
    await assertFails(updateDoc(doc(como('svc'), 'yonkes', 'Y1'), { verificado: true }));
    await assertFails(updateDoc(doc(como('svc'), 'yonkes', 'Y1'), { direccion: 'x', ciudad: 'y', telefono: 'z', tipoRegistro: 'completo' }));
    await assertFails(updateDoc(doc(como('svc'), 'usuarios', 'c1'), { rol: 'admin' }));
  });
  it('el admin puede corregir y desactivar a un ligero', async () => {
    await assertSucceeds(updateDoc(doc(como('adm'), 'yonkes', 'YL'), { whatsapp: '6643333333', activo: false }));
  });
});
