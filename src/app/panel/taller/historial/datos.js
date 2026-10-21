'use client';

// Acceso a Firestore del historial de servicios del taller (talleres/{id}/historial/{vehiculoId}).
// Las reglas (firestore.rules) exigen: escribir solo el dueño con taller activo, términos vigentes,
// config/historialTaller.habilitado y Premium vigente; borrar el dueño siempre. Sin índices nuevos:
// búsqueda por placas (==), por folio (array-contains) y la lista por actualizadoAt usan los
// índices automáticos de un campo.
import {
  Timestamp, collection, deleteDoc, doc, getDoc, getDocs, limit, orderBy, query, serverTimestamp, setDoc, startAfter, updateDoc, where,
} from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import {
  DIAS_AVISO_BORRADO, MAX_SERVICIOS_HISTORIAL, MENSAJES_HISTORIAL, MENSAJES_RECORDATORIO, calcularProximoAviso, cambiarRecordatorio,
  expiraHistorial, mismoVehiculo, nombreVehiculo, normalizarPlacas, pasosParaAgregar, quitarRecordatorio, servicioDesdeOrden,
} from '../../../../lib/historialTaller';

export const TAMANO_PAGINA_HISTORIAL = 20;

const historialRef = (tallerId) => collection(db, 'talleres', tallerId, 'historial');
const vehiculoRef = (tallerId, id) => doc(db, 'talleres', tallerId, 'historial', id);

// Bandera: { habilitado }. Sin el documento devuelve null y la función no aparece (falla cerrada).
export async function leerConfigHistorial() {
  const snap = await getDoc(doc(db, 'config', 'historialTaller'));
  return snap.exists() ? snap.data() : null;
}

export async function listarVehiculos(tallerId, cursor = null) {
  const restricciones = [orderBy('actualizadoAt', 'desc'), limit(TAMANO_PAGINA_HISTORIAL)];
  if (cursor) restricciones.push(startAfter(cursor));
  const snap = await getDocs(query(historialRef(tallerId), ...restricciones));
  return {
    items: snap.docs.map((d) => ({ id: d.id, ...d.data() })),
    cursor: snap.docs.length ? snap.docs[snap.docs.length - 1] : null,
    hayMas: snap.docs.length === TAMANO_PAGINA_HISTORIAL,
  };
}

export async function leerVehiculo(tallerId, id) {
  const snap = await getDoc(vehiculoRef(tallerId, id));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export function borrarVehiculo(tallerId, id) {
  return deleteDoc(vehiculoRef(tallerId, id));
}

// ¿Esta orden ya está en el historial? (una orden solo se agrega una vez)
export async function ordenEnHistorial(tallerId, folio) {
  const snap = await getDocs(query(historialRef(tallerId), where('folios', 'array-contains', folio), limit(1)));
  return snap.empty ? null : snap.docs[0].id;
}

// Teléfono para WhatsApp, leído de la orden EN ESTE MOMENTO (nunca se copia al historial). null si
// la orden ya no existe, ya venció o no tiene teléfono: entonces WhatsApp abre sin número.
export async function telefonoDeOrden(tallerId, folio) {
  if (!folio) return null;
  try {
    const snap = await getDoc(doc(db, 'talleres', tallerId, 'ordenes', folio));
    if (!snap.exists()) return null;
    const o = snap.data();
    const vence = o.expiraAt?.toDate ? o.expiraAt.toDate().getTime() : null;
    if (vence !== null && vence <= Date.now()) return null;
    return typeof o.cliente?.telefono === 'string' && o.cliente.telefono ? o.cliente.telefono : null;
  } catch {
    return null;
  }
}

// "Agregar al historial": lee la orden FRESCA, busca el vehículo por placas dentro del taller y
// agrega el servicio (o crea el vehículo). Lanza un Error con mensaje en español listo para mostrar.
// Devuelve el id del vehículo.
export async function agregarOrdenAlHistorial({ tallerId, folio, placasEscritas }) {
  const snapOrden = await getDoc(doc(db, 'talleres', tallerId, 'ordenes', folio));
  if (!snapOrden.exists() || snapOrden.data().estado !== 'entregado') throw new Error(MENSAJES_HISTORIAL.noEntregada);
  const orden = snapOrden.data();
  const placas = normalizarPlacas(orden.vehiculo?.placas ?? placasEscritas);
  if (!placas) throw new Error(MENSAJES_HISTORIAL.placas);
  if (await ordenEnHistorial(tallerId, folio)) throw new Error(MENSAJES_HISTORIAL.yaEnHistorial);

  const servicio = servicioDesdeOrden(orden, folio);
  const km = Number.isInteger(servicio.kilometraje) ? { ultimoKm: servicio.kilometraje } : {};
  const comunes = { actualizadoAt: serverTimestamp(), expiraAt: Timestamp.fromDate(expiraHistorial()) };

  const existente = await getDocs(query(historialRef(tallerId), where('placas', '==', placas), limit(1)));
  try {
    if (existente.empty) {
      const ref = doc(historialRef(tallerId));
      await setDoc(ref, {
        placas, marca: orden.vehiculo.marca, modelo: orden.vehiculo.modelo, anio: orden.vehiculo.anio,
        servicios: [servicio], folios: [folio], ultimoFolio: folio, ...km,
        ultimoServicioAt: orden.fechaEntrega, creadoAt: serverTimestamp(), ...comunes,
      });
      return ref.id;
    }
    const v = { id: existente.docs[0].id, ...existente.docs[0].data() };
    if (!mismoVehiculo(orden, v)) throw new Error(MENSAJES_HISTORIAL.otroVehiculo(nombreVehiculo(v)));
    if ((v.servicios?.length ?? 0) >= MAX_SERVICIOS_HISTORIAL) throw new Error(MENSAJES_HISTORIAL.lleno);
    // El último servicio por fecha (una orden vieja agregada después no lo cambia).
    const fechaNueva = orden.fechaEntrega?.toMillis?.() ?? 0;
    const fechaUltima = v.ultimoServicioAt?.toMillis?.() ?? 0;
    const masReciente = fechaNueva >= fechaUltima;
    await setDoc(vehiculoRef(tallerId, v.id), {
      placas: v.placas, marca: v.marca, modelo: v.modelo, anio: v.anio,
      servicios: [...v.servicios, servicio], folios: [...v.folios, folio], ultimoFolio: folio,
      ...(masReciente ? km : (Number.isInteger(v.ultimoKm) ? { ultimoKm: v.ultimoKm } : {})),
      ultimoServicioAt: masReciente ? orden.fechaEntrega : v.ultimoServicioAt,
      creadoAt: v.creadoAt, ...comunes,
      // Agregar un servicio NO toca los recordatorios: se conservan tal cual (las reglas lo exigen).
      ...(v.recordatorios !== undefined ? { recordatorios: v.recordatorios } : {}),
      ...(v.proximoAviso !== undefined ? { proximoAviso: v.proximoAviso } : {}),
    });
    return v.id;
  } catch (err) {
    if (Object.values(MENSAJES_HISTORIAL).some((m) => typeof m === 'string' && m === err.message) || err.message?.startsWith('Esas placas')) throw err;
    console.error('[historial] No se pudo guardar', err);
    throw new Error(MENSAJES_HISTORIAL.guardarFallo);
  }
}

// ---------- Recordatorios (etapa 3) ----------
// Solo cambian recordatorios, proximoAviso y actualizadoAt (ruta C de las reglas): nunca servicios,
// folios, placas ni la fecha de borrado (expiraAt). Fechas: Timestamp en Firestore, ms en lib.
const ms = (v) => (v?.toMillis ? v.toMillis() : (v instanceof Date ? v.getTime() : Number(v)));

export function recordatoriosDe(vehiculo) {
  return (vehiculo?.recordatorios || []).map((r) => ({ ...r, fecha: ms(r.fecha), creadoAt: ms(r.creadoAt) }));
}

function aFirestore(lista) {
  return lista.map((r) => ({ ...r, fecha: Timestamp.fromMillis(r.fecha), creadoAt: Timestamp.fromMillis(r.creadoAt) }));
}

async function guardarLista(tallerId, vehiculoId, lista) {
  const proximo = calcularProximoAviso(lista);
  await updateDoc(vehiculoRef(tallerId, vehiculoId), {
    recordatorios: aFirestore(lista),
    proximoAviso: proximo === null ? null : Timestamp.fromMillis(proximo),
    actualizadoAt: serverTimestamp(),
  });
  return lista;
}

// Agrega recordatorios (servicios periódicos) a un vehículo, uno por uno y en pasos chicos (ver
// pasosParaAgregar). Lee el vehículo FRESCO. Devuelve la lista final.
export async function agregarRecordatorios(tallerId, vehiculoId, nuevos, { fechaEntrega, folio }) {
  const v = await leerVehiculo(tallerId, vehiculoId);
  if (!v) throw new Error(MENSAJES_RECORDATORIO.guardarFallo);
  let lista = recordatoriosDe(v);
  for (const nuevo of nuevos) {
    for (const paso of pasosParaAgregar(lista, nuevo, { fechaEntrega: ms(fechaEntrega), folio, ahora: Date.now() })) {
      lista = await guardarLista(tallerId, vehiculoId, paso);
    }
  }
  return lista;
}

export function cambiarRecordatorioDelVehiculo(tallerId, vehiculo, id, cambios) {
  return guardarLista(tallerId, vehiculo.id, cambiarRecordatorio(recordatoriosDe(vehiculo), id, cambios));
}

export function quitarRecordatorioDelVehiculo(tallerId, vehiculo, id) {
  return guardarLista(tallerId, vehiculo.id, quitarRecordatorio(recordatoriosDe(vehiculo), id));
}

// "Servicios por vencer": proximoAviso <= ahora. "Se borrarán pronto": expiraAt <= ahora + 30 días.
// Índices automáticos de un campo (sin índices compuestos).
export async function listarPorVencer(tallerId, ahora = new Date()) {
  const snap = await getDocs(query(historialRef(tallerId), where('proximoAviso', '<=', Timestamp.fromDate(ahora)), orderBy('proximoAviso'), limit(TAMANO_PAGINA_HISTORIAL)));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function listarPorBorrarse(tallerId, ahora = new Date()) {
  const limite = new Date(ahora.getTime() + DIAS_AVISO_BORRADO * 86400000);
  const snap = await getDocs(query(historialRef(tallerId), where('expiraAt', '<=', Timestamp.fromDate(limite)), orderBy('expiraAt'), limit(TAMANO_PAGINA_HISTORIAL)));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}
