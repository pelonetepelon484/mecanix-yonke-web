// Asistencia vial, etapa 1: directorio por ciudad de grúas, llanteras y ayuda en carretera. Sin
// solicitudes en vivo, sin ubicación del cliente y sin cobros: el cliente ve los proveedores y los
// contacta directo (Llamar / WhatsApp). Solo el admin da de alta (admin/asistencia-vial).
//
// Firestore:
//   asistenciaVial/{id}                 datos públicos (los lee cualquiera solo si activo == true)
//   asistenciaVial/{id}/privado/datos   notas internas, documentos revisados y contacto del dueño (solo admin)
//   asistenciaVial/{id}/contactos/{mes} toques en "Llamar" y "WhatsApp" por mes, sin datos de quien toca
// Banderas (config/portada): asistenciaVialProximamente y asistenciaVialActiva (ver configPortada.js).
//
// "Documentos en regla" NO es la insignia "Verificado" de los yonkes: otro campo, otro nombre y
// otro estilo. El sello se muestra solo si está marcado y la revisión tiene menos de 12 meses.
import { CIUDADES_BC } from '../app/lib/ciudades';

export const COLECCION_ASISTENCIA = 'asistenciaVial';

export const TIPOS_SERVICIO = [
  { key: 'grua', label: 'Grúa' },
  { key: 'llantera', label: 'Llantera / vulcanizadora' },
  { key: 'paso_de_corriente', label: 'Paso de corriente' },
  { key: 'cambio_de_llanta', label: 'Cambio de llanta' },
  { key: 'gasolina', label: 'Envío de gasolina' },
  { key: 'cerrajeria_automotriz', label: 'Cerrajería automotriz' },
  { key: 'otro', label: 'Otro servicio' },
];

// Solo para proveedores con el servicio "grua" (opcional).
export const TIPOS_GRUA = [
  { key: 'plataforma', label: 'Plataforma' },
  { key: 'arrastre', label: 'Arrastre con pinzas' },
  { key: 'pesada', label: 'Grúa pesada' },
  { key: 'motos', label: 'Para motos' },
];

// Mismas ciudades que el resto del sitio (Baja California). Para agregar una ciudad: sumarla en
// CIUDADES_BC (src/app/lib/ciudades.js) y en CIUDADES_VECINAS.
export const CIUDADES_ASISTENCIA = CIUDADES_BC;

// "Cercanía" sin geolocalización: orden fijo de las ciudades más cercanas a cada una.
export const CIUDADES_VECINAS = {
  tijuana: ['rosarito', 'tecate', 'ensenada', 'mexicali', 'sanquintin'],
  rosarito: ['tijuana', 'ensenada', 'tecate', 'mexicali', 'sanquintin'],
  tecate: ['tijuana', 'rosarito', 'mexicali', 'ensenada', 'sanquintin'],
  ensenada: ['rosarito', 'tijuana', 'sanquintin', 'tecate', 'mexicali'],
  mexicali: ['tecate', 'tijuana', 'rosarito', 'ensenada', 'sanquintin'],
  sanquintin: ['ensenada', 'rosarito', 'tijuana', 'tecate', 'mexicali'],
};

export const MESES_VIGENCIA_DOCUMENTOS = 12;

export const AVISO_ASISTENCIA = 'Red Mecanix solo te pone en contacto con el proveedor. El servicio lo presta y lo cobra directamente cada proveedor. Acuerda el precio antes de que salga la grúa o el servicio.';
export const MENSAJE_WHATSAPP_ASISTENCIA = 'Hola, vi tu servicio en Red Mecanix y necesito ayuda con: ';

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

export const etiquetaServicio = (key) => TIPOS_SERVICIO.find((t) => t.key === key)?.label ?? key;
export const etiquetaGrua = (key) => TIPOS_GRUA.find((t) => t.key === key)?.label ?? key;
export const etiquetaCiudad = (key) => CIUDADES_ASISTENCIA.find((c) => c.key === key)?.label ?? key;

const aMs = (v) => (v && typeof v.toMillis === 'function' ? v.toMillis() : v instanceof Date ? v.getTime() : (typeof v === 'number' ? v : null));
const soloClaves = (lista, validas) => (Array.isArray(lista) ? lista.filter((k) => validas.some((v) => v.key === k)) : []);
const texto = (v) => (typeof v === 'string' ? v : '');

// Lo que la página pública necesita, serializable. Nunca incluye nada de privado/.
export function proveedorParaPagina(id, d) {
  return {
    id,
    nombre: texto(d.nombre),
    servicios: soloClaves(d.servicios, TIPOS_SERVICIO),
    tiposGrua: soloClaves(d.tiposGrua, TIPOS_GRUA),
    ciudades: soloClaves(d.ciudades, CIUDADES_ASISTENCIA),
    atiende24h: d.atiende24h === true,
    horario: texto(d.horario),
    telefono: texto(d.telefono),
    whatsapp: texto(d.whatsapp),
    descripcion: texto(d.descripcion),
    logoUrl: texto(d.logoUrl),
    activo: d.activo === true,
    documentosEnRegla: d.documentosEnRegla === true,
    fechaRevisionMs: aMs(d.fechaRevisionDocumentos),
  };
}

// Fecha en que vence la revisión: misma fecha, 12 meses después.
export function venceRevisionMs(fechaRevisionMs) {
  if (typeof fechaRevisionMs !== 'number') return null;
  const f = new Date(fechaRevisionMs);
  f.setMonth(f.getMonth() + MESES_VIGENCIA_DOCUMENTOS);
  return f.getTime();
}

// 'en_regla' (sello visible), 'por_renovar' (marcado pero con más de 12 meses o sin fecha) o 'sin_revisar'.
export function estadoDocumentos(p, ahoraMs = Date.now()) {
  if (p.documentosEnRegla !== true) return 'sin_revisar';
  const vence = venceRevisionMs(p.fechaRevisionMs);
  return vence !== null && ahoraMs < vence ? 'en_regla' : 'por_renovar';
}
export const selloVigente = (p, ahoraMs) => estadoDocumentos(p, ahoraMs) === 'en_regla';

// "noviembre 2026" (hora de Tijuana, para que una fecha del día 1 no salga del mes anterior).
export function mesAnio(ms) {
  const partes = new Intl.DateTimeFormat('es-MX', { timeZone: 'America/Tijuana', year: 'numeric', month: 'numeric' }).formatToParts(new Date(ms));
  const mes = Number(partes.find((x) => x.type === 'month')?.value);
  const anio = partes.find((x) => x.type === 'year')?.value;
  return `${MESES[mes - 1]} ${anio}`;
}
export const textoSello = (p) => `Documentos en regla · revisado en ${mesAnio(p.fechaRevisionMs)}`;

// Primero los que atienden 24 horas y tienen documentos en regla, luego solo 24 horas, luego solo
// documentos, luego el resto.
export function prioridad(p, ahoraMs) {
  const sello = selloVigente(p, ahoraMs);
  if (p.atiende24h && sello) return 0;
  if (p.atiende24h) return 1;
  if (sello) return 2;
  return 3;
}

const cumpleFiltros = (p, { servicio = '', solo24h = false }) =>
  (!servicio || p.servicios.includes(servicio)) && (!solo24h || p.atiende24h);

const porPrioridad = (ahoraMs) => (a, b) => prioridad(a, ahoraMs) - prioridad(b, ahoraMs) || a.nombre.localeCompare(b.nombre, 'es');

// Con ciudad: { enCiudad, cercanos } — los que atienden esa ciudad y, aparte, los de ciudades
// vecinas en orden de cercanía (cada grupo, por prioridad). Sin ciudad: todos en enCiudad, por
// prioridad y luego por el orden de las ciudades.
export function ordenarProveedores(lista, { ciudad = '', servicio = '', solo24h = false } = {}, ahoraMs = Date.now()) {
  const activos = lista.filter((p) => p.activo && cumpleFiltros(p, { servicio, solo24h }));
  if (!ciudad) {
    const orden = (p) => Math.min(...p.ciudades.map((c) => CIUDADES_ASISTENCIA.findIndex((x) => x.key === c)).filter((i) => i >= 0), 99);
    return { enCiudad: [...activos].sort((a, b) => prioridad(a, ahoraMs) - prioridad(b, ahoraMs) || orden(a) - orden(b) || a.nombre.localeCompare(b.nombre, 'es')), cercanos: [] };
  }
  const enCiudad = activos.filter((p) => p.ciudades.includes(ciudad)).sort(porPrioridad(ahoraMs));
  const vecinas = CIUDADES_VECINAS[ciudad] || [];
  const distancia = (p) => Math.min(...p.ciudades.map((c) => vecinas.indexOf(c)).filter((i) => i >= 0), 99);
  const cercanos = activos
    .filter((p) => !p.ciudades.includes(ciudad) && distancia(p) < 99)
    .sort((a, b) => distancia(a) - distancia(b) || porPrioridad(ahoraMs)(a, b));
  return { enCiudad, cercanos };
}

const soloDigitos = (v) => String(v || '').replace(/\D/g, '');
export const enlaceLlamar = (telefono) => `tel:+52${soloDigitos(telefono)}`;
export const enlaceWhatsappAsistencia = (whatsapp) => `https://wa.me/52${soloDigitos(whatsapp)}?text=${encodeURIComponent(MENSAJE_WHATSAPP_ASISTENCIA)}`;

// Mes del contador (AAAA-MM), igual que el de refaccionarias.
export const mesContadorAsistencia = (fecha = new Date()) => fecha.toISOString().slice(0, 7);

// Validación del formulario del admin (las reglas vuelven a revisar lo esencial). Devuelve el
// primer error en texto o null.
export function validarProveedor(p) {
  if (!p.nombre || p.nombre.trim().length < 2 || p.nombre.trim().length > 100) return 'Escribe el nombre del negocio (2 a 100 letras).';
  if (!Array.isArray(p.servicios) || p.servicios.length === 0) return 'Elige al menos un tipo de servicio.';
  if (!Array.isArray(p.ciudades) || p.ciudades.length === 0) return 'Elige al menos una ciudad que atienda.';
  if (!/^\d{10}$/.test(p.telefono || '')) return 'El teléfono debe tener 10 dígitos.';
  if (p.whatsapp && !/^\d{10}$/.test(p.whatsapp)) return 'El WhatsApp debe tener 10 dígitos (o déjalo vacío).';
  if (!p.atiende24h && !(p.horario || '').trim()) return 'Escribe el horario o marca "Atiende 24 horas".';
  if ((p.horario || '').length > 150) return 'El horario es muy largo (máximo 150 letras).';
  if ((p.descripcion || '').length > 300) return 'La descripción es muy larga (máximo 300 letras).';
  if (p.documentosEnRegla && !p.fechaRevision) return 'Pon la fecha en que revisaste los documentos.';
  return null;
}
