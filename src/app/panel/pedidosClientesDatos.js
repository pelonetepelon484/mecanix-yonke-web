'use client';

// Acceso a Firestore para el lado del yonke en el pedido de pieza de clientes sin cuenta.
// Las reglas (firestore.rules, pedidosClientes) son la protección real: el yonke solo ve
// vehículo, pieza y estado, nunca el WhatsApp del cliente (vive en privado/contacto).
import {
  Timestamp, collection, deleteDoc, doc, getDoc, limit, onSnapshot, orderBy, query, runTransaction, serverTimestamp, setDoc, updateDoc,
  where, writeBatch,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import {
  MENSAJES_VEHICULO_ALERTA, accionVehiculoCompleto, agregarPieza, calcularVenceEn, cambiosUnidades, cambiosVenta, diaTijuana, estaVigente,
  idVehiculoAlerta, unidadesDe, vendidasDe,
} from '../../lib/vehiculosAlerta';

// Bandera de la función: sin config/pedidosClientes, o con habilitado != true, quien llama no
// debe hacer ninguna otra lectura de este módulo.
export async function leerConfigPedidosClientes() {
  const snap = await getDoc(doc(db, 'config', 'pedidosClientes'));
  return snap.exists() ? snap.data() : null;
}

// La misma bandera, en vivo (contador de "Pedidos": una conexión por sesión). cb(null) si no existe
// o si la lectura falla.
export function escucharConfigPedidosClientes(cb) {
  return onSnapshot(doc(db, 'config', 'pedidosClientes'), (snap) => cb(snap.exists() ? snap.data() : null), () => cb(null));
}

const vencido = (p) => !(p.expiraAt?.toDate && p.expiraAt.toDate().getTime() > Date.now());

// Pedidos abiertos del estado del yonke, en vivo (recién creados primero). Los vencidos que la
// política TTL todavía no borra se ocultan aquí. Índice: estado + estadoPedido + creadoAt desc.
export function escucharPedidosClientesAbiertos(estado, cb) {
  const q = query(
    collection(db, 'pedidosClientes'),
    where('estado', '==', estado), where('estadoPedido', '==', 'abierta'), orderBy('creadoAt', 'desc'), limit(50),
  );
  return onSnapshot(
    q,
    (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((p) => !vencido(p))),
    (error) => console.error('[pedidosClientes] No se pudo escuchar los pedidos (¿falta el índice?)', error),
  );
}

// ---------- Alertas de otros estados (quién puede: puedeVerOtrosEstados en lib/pedidosClientes) ----------
// Evento del navegador para que el contador del botón "Pedidos" se entere al cambiar el interruptor.
export const EVENTO_OTROS_ESTADOS = 'mecanix:ver-alertas-otros-estados';

export async function guardarVerOtrosEstados(yonkeId, valor) {
  await updateDoc(doc(db, 'yonkes', yonkeId), { verAlertasOtrosEstados: valor === true });
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(EVENTO_OTROS_ESTADOS));
}

// Alertas abiertas que aceptan otros estados, de TODOS los estados (quien llama quita las de su
// propio estado, que ya vienen en la otra lista). La regla exige estos dos filtros.
// Índice: aceptaOtrosEstados + estadoPedido + creadoAt desc.
export function escucharPedidosClientesOtrosEstados(cb) {
  const q = query(
    collection(db, 'pedidosClientes'),
    where('aceptaOtrosEstados', '==', true), where('estadoPedido', '==', 'abierta'), orderBy('creadoAt', 'desc'), limit(50),
  );
  return onSnapshot(
    q,
    (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((p) => !vencido(p))),
    (error) => console.error('[pedidosClientes] No se pudo escuchar las alertas de otros estados (¿falta el índice?)', error),
  );
}

export async function yaRespondioPedido(id, yonkeId) {
  const snap = await getDoc(doc(db, 'pedidosClientes', id, 'respuestas', yonkeId));
  return snap.exists() ? snap.data() : null;
}

// Una sola respuesta por yonke: la regla rechaza un segundo intento. expiraAt = el del pedido.
// limite (número): plan Básico con config/pedidosClientes.limiteRespuestasDiarias. La respuesta y
// el contador del día (yonkes/{id}/respuestasDiarias/{AAAAMMDD de Tijuana}) se guardan juntos en
// una transacción; si ya llegó al límite no se guarda nada y se lanza un error con codigo 'limite'.
// Sin limite (null), se guarda exactamente como siempre.
export async function responderPedido(pedido, yonkeId, { yonkeNombre, whatsapp, tieneLaPieza, precio, nota }, { limite = null } = {}) {
  const cuerpo = {
    yonkeId, yonkeNombre, whatsapp, tieneLaPieza, nota,
    creadoAt: serverTimestamp(), expiraAt: pedido.expiraAt,
  };
  if (tieneLaPieza) cuerpo.precio = precio;
  const respuestaRef = doc(db, 'pedidosClientes', pedido.id, 'respuestas', yonkeId);
  if (limite === null) {
    await setDoc(respuestaRef, cuerpo);
    return;
  }
  const dia = diaTijuana(new Date());
  const contadorRef = doc(db, 'yonkes', yonkeId, 'respuestasDiarias', dia);
  await runTransaction(db, async (t) => {
    const snap = await t.get(contadorRef);
    const n = snap.exists() ? (snap.data().count || 0) : 0;
    if (n >= limite) throw errorLimite();
    t.set(respuestaRef, { ...cuerpo, dia });
    t.set(contadorRef, { count: n + 1 });
  });
}

function errorLimite() {
  const error = new Error(MENSAJES_VEHICULO_ALERTA.limiteAlcanzado);
  error.codigo = 'limite';
  return error;
}

// Respuestas que el yonke ya dio hoy (día de Tijuana). 0 si no hay contador.
export async function leerRespuestasHoy(yonkeId) {
  const snap = await getDoc(doc(db, 'yonkes', yonkeId, 'respuestasDiarias', diaTijuana(new Date())));
  return snap.exists() ? (snap.data().count || 0) : 0;
}

// ---------- Inventario de vehículos completos (config/pedidosClientes.inventarioVehiculos) ----------
// yonkes/{yonkeId}/vehiculosAlerta/{marca_modelo_año}: un documento por vehículo. Las reglas
// solo dejan al dueño del yonke crearlo, cambiarlo o quitarlo.
const vehiculoAlertaRef = (yonkeId, id) => doc(db, 'yonkes', yonkeId, 'vehiculosAlerta', id);

export async function leerVehiculoAlertaDePedido(yonkeId, pedido) {
  const { marca, modelo, anio } = pedido.vehiculo;
  const snap = await getDoc(vehiculoAlertaRef(yonkeId, idVehiculoAlerta(marca, modelo, anio)));
  return snap.exists() ? snap.data() : null;
}

const refDePedido = (yonkeId, pedido) => {
  const { marca, modelo, anio } = pedido.vehiculo;
  return vehiculoAlertaRef(yonkeId, idVehiculoAlerta(marca, modelo, anio));
};

// Suma (+1) o resta (−1) una venta de la pieza en una transacción. Devuelve null si se guardó, o
// { agotada: true, vendidas, unidades } si ya estaba vendida en todas las unidades (no guarda nada).
async function cambiarVenta(ref, pieza, delta) {
  return runTransaction(db, async (t) => {
    const snap = await t.get(ref);
    if (!snap.exists()) return null;
    const v = snap.data();
    const cambios = cambiosVenta(v, pieza, delta);
    if (!cambios) return delta === 1 ? { agotada: true, vendidas: vendidasDe(v, pieza), unidades: unidadesDe(v) } : null;
    t.update(ref, cambios);
    return null;
  });
}

// Ya lo tenía vigente y contestó "La tengo": se suma una venta de la pieza (no cambia el
// vencimiento). Si ya estaba vendida en todas las unidades devuelve { agotada, vendidas, unidades }
// y no cambia nada: quien llama pregunta "¿Tienes otro igual?".
export async function descontarPiezaDePedido(yonkeId, pedido) {
  return cambiarVenta(refDePedido(yonkeId, pedido), pedido.pieza, 1);
}

// "+1 / Tengo otro igual": una unidad más y 30 días más desde hoy (cuenta como confirmación).
// Con pieza (viene de una alerta), en el mismo guardado se cuenta la venta de esa pieza.
async function sumarUnidadEn(ref, pieza = null) {
  await runTransaction(db, async (t) => {
    const snap = await t.get(ref);
    if (!snap.exists()) throw new Error('El vehículo ya no está en tu inventario.');
    const v = snap.data();
    let cambios = cambiosUnidades(v, 1);
    if (!cambios) throw new Error('No se pudo sumar otra unidad.');
    if (pieza) cambios = { ...cambios, ...(cambiosVenta({ ...v, ...cambios }, pieza, 1) || {}) };
    t.update(ref, { ...cambios, venceEn: Timestamp.fromDate(calcularVenceEn(new Date())), renovadoAt: serverTimestamp() });
  });
}

export async function sumarUnidad(yonkeId, vehiculoId) {
  await sumarUnidadEn(vehiculoAlertaRef(yonkeId, vehiculoId));
}

// "¿Tienes otro igual?" -> "+1 Tengo otro igual": suma la unidad y cuenta la venta de esa alerta.
export async function sumarUnidadDePedido(yonkeId, pedido) {
  await sumarUnidadEn(refDePedido(yonkeId, pedido), pedido.pieza);
}

// "−1": no baja de 1 ni de las ventas ya marcadas (error con codigo 'ventas').
export async function restarUnidad(yonkeId, vehiculoId) {
  const ref = vehiculoAlertaRef(yonkeId, vehiculoId);
  await runTransaction(db, async (t) => {
    const snap = await t.get(ref);
    if (!snap.exists()) return;
    const cambios = cambiosUnidades(snap.data(), -1);
    if (!cambios) {
      const error = new Error(MENSAJES_VEHICULO_ALERTA.noBajarUnidades);
      error.codigo = 'ventas';
      throw error;
    }
    t.update(ref, cambios);
  });
}

// Contestó "Sí" a "¿Tienes el vehículo completo?". Devuelve 'crear' | 'renovar' | 'descontarPieza'.
// crear: nuevo, 30 días, la pieza de la alerta queda disponible. renovar (estaba vencido): 30 días
// más desde hoy y las piezas vendidas empiezan de cero.
export async function guardarVehiculoCompleto(yonkeId, pedido) {
  const { marca, modelo, anio } = pedido.vehiculo;
  const ref = vehiculoAlertaRef(yonkeId, idVehiculoAlerta(marca, modelo, anio));
  return runTransaction(db, async (t) => {
    const snap = await t.get(ref);
    const ahora = new Date();
    const existente = snap.exists() ? snap.data() : null;
    const accion = accionVehiculoCompleto(existente, ahora);
    const venceEn = Timestamp.fromDate(calcularVenceEn(ahora));
    // Nuevo o vencido: queda con 1 unidad y sin ventas.
    if (accion === 'crear') {
      t.set(ref, {
        yonkeId, marca, modelo, ano: anio, unidades: 1, ventasPiezas: {}, piezasAlerta: agregarPieza([], pedido.pieza), piezasVendidas: [],
        creadoAt: serverTimestamp(), venceEn, estado: 'activo',
      });
    } else if (accion === 'renovar') {
      t.update(ref, {
        venceEn, estado: 'activo', unidades: 1, ventasPiezas: {}, piezasVendidas: [],
        piezasAlerta: agregarPieza(existente.piezasAlerta, pedido.pieza), renovadoAt: serverTimestamp(),
      });
    } else {
      // Quedó vigente mientras tanto (otra pestaña): se cuenta la venta si todavía cabe.
      const cambios = cambiosVenta(existente, pedido.pieza, 1);
      if (cambios) t.update(ref, cambios);
    }
    return accion;
  });
}

// Todos los vehículos del yonke, en vivo (sin índice: una sola colección sin filtros).
export function escucharVehiculosAlerta(yonkeId, cb) {
  return onSnapshot(
    collection(db, 'yonkes', yonkeId, 'vehiculosAlerta'),
    (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    (error) => { console.error('[vehiculosAlerta] No se pudo escuchar el inventario', error); cb([]); },
  );
}

// "Ya lo vendí": un toque, sin confirmación. Suma una venta hasta el número de unidades.
export async function marcarPiezaVendida(yonkeId, vehiculoId, pieza) {
  await cambiarVenta(vehiculoAlertaRef(yonkeId, vehiculoId), pieza, 1);
}

// "Deshacer": resta una venta de esa pieza.
export async function deshacerVentaPieza(yonkeId, vehiculoId, pieza) {
  await cambiarVenta(vehiculoAlertaRef(yonkeId, vehiculoId), pieza, -1);
}

// Quitar el vehículo completo del inventario (se vendió o se desbarató todo).
export async function quitarVehiculoAlerta(yonkeId, vehiculoId) {
  await deleteDoc(vehiculoAlertaRef(yonkeId, vehiculoId));
}

// "Sigo manteniendo mis vehículos" (Premium): 30 días más desde hoy a los vigentes. No toca las
// piezas vendidas ni reactiva los vencidos. Devuelve cuántos renovó.
export async function renovarVehiculosVigentes(yonkeId, vehiculos) {
  const ahora = new Date();
  const vigentes = vehiculos.filter((v) => estaVigente(v, ahora)).slice(0, 450);
  if (vigentes.length === 0) return 0;
  const lote = writeBatch(db);
  const venceEn = Timestamp.fromDate(calcularVenceEn(ahora));
  for (const v of vigentes) lote.update(vehiculoAlertaRef(yonkeId, v.id), { venceEn, renovadoAt: serverTimestamp() });
  await lote.commit();
  return vigentes.length;
}
