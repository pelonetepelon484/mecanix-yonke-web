// Asistencia vial, etapa 2: "Estoy aquí" de los proveedores y mapa para el cliente (lógica pura).
//
// El proveedor abre su enlace privado (/asistencia-vial/aqui#<secreto>), escoge cuánto tiempo se
// queda (30 min a 3 horas) y toca "Estoy aquí". Su ubicación se guarda REDONDEADA (unos 300 m) en
// ubicacionesAsistencia/{proveedorId} con la hora hasta la que estará ahí; al pasar esa hora deja
// de salir en el mapa. Solo el servidor escribe ahí (api/asistencia-vial/aqui, con su cuenta de
// servicio): el enlace nunca da acceso a nada más.
//
// El cliente toca "Usar mi ubicación": la distancia se calcula SOLO en su celular; su ubicación
// no se guarda ni se manda a Mecanix.
//
// Firestore:
//   checkinsAsistencia/{huella}            { proveedorId, creadoAt }. huella = SHA-256 del secreto
//                                          del enlace (el secreto no se guarda). Solo admin.
//   ubicacionesAsistencia/{proveedorId}    { lat, lng, hastaAt, actualizadoAt }. Lectura pública.
// Bandera: config/portada.asistenciaVialMapa (además de asistenciaVialActiva).

export const COLECCION_CHECKINS = 'checkinsAsistencia';
export const COLECCION_UBICACIONES = 'ubicacionesAsistencia';

// Opciones de "¿Cuánto tiempo estarás aquí?" (minutos). La última es el tope.
export const MINUTOS_ESTANCIA = [30, 45, 60, 90, 120, 180];
export const MAX_MINUTOS_ESTANCIA = MINUTOS_ESTANCIA.at(-1);

// Unos 300 m: 0.003 grados de latitud son ~333 m (de longitud, ~280 m en Baja California).
export const PASO_REDONDEO = 0.003;

// Baja California con un margen (incluye San Quintín y la línea con EE. UU.).
export const ZONA_PERMITIDA = { latMin: 28.0, latMax: 32.8, lngMin: -117.3, lngMax: -112.5 };

// Secreto del enlace: 32 bytes en base64url = 43 caracteres.
export const LARGO_SECRETO = 43;
export const esSecretoValido = (s) => typeof s === 'string' && /^[A-Za-z0-9_-]{43}$/.test(s);
export const esHuellaValida = (h) => typeof h === 'string' && /^[0-9a-f]{64}$/.test(h);

export const MENSAJES_UBICACION = {
  sinPermiso: 'Para usar tu ubicación, permite que el navegador la vea y vuelve a intentar.',
  sinGps: 'No pudimos obtener tu ubicación. Revisa que el GPS esté encendido e intenta de nuevo.',
  fueraDeZona: 'Tu ubicación está fuera de Baja California.',
  enlaceInvalido: 'Este enlace ya no sirve. Pide uno nuevo a Red Mecanix.',
  noDisponible: 'Esta función todavía no está disponible.',
  fallo: 'No pudimos guardar tu ubicación. Revisa tu conexión e intenta de nuevo.',
  tiempo: 'Escoge cuánto tiempo estarás aquí.',
};

const redondear = (v) => Number((Math.round(v / PASO_REDONDEO) * PASO_REDONDEO).toFixed(4));

export function coordenadasValidas(lat, lng) {
  return typeof lat === 'number' && typeof lng === 'number' && Number.isFinite(lat) && Number.isFinite(lng)
    && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

export function dentroDeZona(lat, lng, z = ZONA_PERMITIDA) {
  return coordenadasValidas(lat, lng) && lat >= z.latMin && lat <= z.latMax && lng >= z.lngMin && lng <= z.lngMax;
}

// Lo que se guarda de un "Estoy aquí". Devuelve { ok, datos } o { ok: false, mensaje }.
export function validarCheckin({ lat, lng, minutos }, ahoraMs = Date.now()) {
  if (!MINUTOS_ESTANCIA.includes(minutos)) return { ok: false, mensaje: MENSAJES_UBICACION.tiempo };
  if (!coordenadasValidas(lat, lng)) return { ok: false, mensaje: MENSAJES_UBICACION.sinGps };
  if (!dentroDeZona(lat, lng)) return { ok: false, mensaje: MENSAJES_UBICACION.fueraDeZona };
  return { ok: true, datos: { lat: redondear(lat), lng: redondear(lng), hastaMs: ahoraMs + minutos * 60000 } };
}

const aMs = (v) => {
  if (v === null || v === undefined) return null;
  if (typeof v === 'number') return v;
  if (v instanceof Date) return v.getTime();
  if (typeof v?.toMillis === 'function') return v.toMillis();
  if (typeof v === 'string') { const n = Date.parse(v); return Number.isNaN(n) ? null : n; }
  return null;
};

// ¿Sigue en el mapa? hastaAt en el futuro, sin pasarse del tope (por si algo raro quedó guardado).
export function ubicacionVigente(u, ahoraMs = Date.now()) {
  const hasta = aMs(u?.hastaAt);
  return hasta !== null && hasta > ahoraMs && hasta <= ahoraMs + (MAX_MINUTOS_ESTANCIA + 5) * 60000
    && coordenadasValidas(u?.lat, u?.lng);
}

// Distancia en línea recta (km), fórmula del haversine.
export function distanciaKm(a, b) {
  const rad = (g) => (g * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(h)));
}

// "a menos de 1 km" / "a 2.4 km" / "a 35 km" (aproximado: la ubicación va redondeada).
export function textoDistancia(km) {
  if (km < 1) return 'a menos de 1 km';
  if (km < 10) return `a ${km.toFixed(1)} km`;
  return `a ${Math.round(km)} km`;
}

// "4:30 p. m." en la hora del celular.
export function textoHoraCorta(ms) {
  const f = new Date(ms);
  const h = f.getHours();
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(f.getMinutes()).padStart(2, '0')} ${h < 12 ? 'a. m.' : 'p. m.'}`;
}

export const textoHasta = (ms) => `Aquí hasta las ${textoHoraCorta(ms)}`;

// "30 min", "1 hora", "1 h 30 min", "2 horas".
export function textoMinutos(m) {
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (r === 0) return h === 1 ? '1 hora' : `${h} horas`;
  return `${h} h ${r} min`;
}

// Junta proveedores (ya activos) con sus ubicaciones vigentes y, si hay ubicación del cliente,
// los ordena del más cercano al más lejano. Sin ubicación del cliente: por la hora del check-in más
// reciente primero. Devuelve [{ proveedor, ubicacion, km|null }].
export function proveedoresEnMapa(proveedores, ubicaciones, cliente = null, ahoraMs = Date.now()) {
  const porId = new Map((ubicaciones ?? []).filter((u) => ubicacionVigente(u, ahoraMs)).map((u) => [u.proveedorId, u]));
  const lista = (proveedores ?? [])
    .filter((p) => porId.has(p.id))
    .map((p) => {
      const u = porId.get(p.id);
      return { proveedor: p, ubicacion: u, km: cliente ? distanciaKm(cliente, u) : null };
    });
  if (cliente) return lista.sort((a, b) => a.km - b.km);
  return lista.sort((a, b) => (aMs(b.ubicacion.actualizadoAt) ?? 0) - (aMs(a.ubicacion.actualizadoAt) ?? 0));
}

// Enlace privado que se manda al proveedor por WhatsApp.
export const enlaceAqui = (sitio, secreto) => `${sitio}/asistencia-vial/aqui#${secreto}`;
export const mensajeEnlaceAqui = (nombre, enlace) =>
  `Hola ${nombre}, este es tu enlace privado de Red Mecanix para aparecer en el mapa de asistencia vial: ${enlace}\nÁbrelo cuando estés disponible, escoge cuánto tiempo estarás en ese lugar y toca "Estoy aquí". No lo compartas.`;
