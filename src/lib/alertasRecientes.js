// Resumen público de alertas de búsqueda (publico/alertasRecientes): las ~30 alertas abiertas más
// recientes con SOLO pieza, vehículo, estado y fechas. Nunca el WhatsApp del cliente (vive en
// privado/contacto) ni ningún otro dato. Lo arma el servidor (o el admin) y lo leen
// /api/alertas-recientes (portada) y /api/pedidos-abiertos, filtrando por el estado del visitante.
// Lógica pura, sin Firestore.

export const MAX_RESUMEN_ALERTAS = 30;
// Cuántas alertas recientes se piden para armar el resumen (algunas pueden estar cerradas o vencidas).
export const LECTURA_RESUMEN_ALERTAS = 40;
// Lista que recibe la portada para rotar (5 a la vez).
export const POOL_PORTADA = 15;
// El servidor reutiliza el resumen leído durante 1 minuto.
export const CACHE_RESUMEN_MS = 60 * 1000;

function aMs(v) {
  if (v instanceof Date) return v.getTime();
  if (typeof v === 'number') return v;
  if (v && typeof v.toDate === 'function') return v.toDate().getTime();
  if (v && typeof v.toMillis === 'function') return v.toMillis();
  return null;
}

// pedidos: documentos de pedidosClientes ({ id, vehiculo, pieza, estado, estadoPedido, creadoAt, expiraAt }).
export function armarResumen(pedidos, ahora) {
  const t = ahora.getTime();
  return (pedidos || [])
    .map((p) => ({ p, creadoMs: aMs(p.creadoAt), expiraMs: aMs(p.expiraAt) }))
    .filter(({ p, creadoMs, expiraMs }) => p.estadoPedido === 'abierta' && creadoMs !== null && expiraMs !== null && expiraMs > t
      && typeof p.pieza === 'string' && typeof p.estado === 'string' && p.vehiculo)
    .sort((a, b) => b.creadoMs - a.creadoMs)
    .slice(0, MAX_RESUMEN_ALERTAS)
    .map(({ p, creadoMs, expiraMs }) => ({
      id: p.id,
      pieza: p.pieza,
      vehiculo: { marca: String(p.vehiculo.marca ?? ''), modelo: String(p.vehiculo.modelo ?? ''), anio: Number(p.vehiculo.anio) },
      estado: p.estado,
      creadoMs,
      expiraMs,
    }));
}

// Alertas de UN estado, vigentes, más recientes primero, en el formato que ya usa pedidoPublico():
// { id, vehiculo, pieza, estado, creadoAt (ISO) }.
export function alertasDeEstado(resumen, estado, ahora, max = POOL_PORTADA) {
  if (!estado || !Array.isArray(resumen)) return [];
  const t = ahora.getTime();
  return resumen
    .filter((a) => a && a.estado === estado && typeof a.expiraMs === 'number' && a.expiraMs > t && typeof a.creadoMs === 'number')
    .sort((a, b) => b.creadoMs - a.creadoMs)
    .slice(0, max)
    .map((a) => ({
      id: a.id,
      vehiculo: { marca: a.vehiculo?.marca ?? '', modelo: a.vehiculo?.modelo ?? '', anio: a.vehiculo?.anio ?? null },
      pieza: a.pieza,
      estado: a.estado,
      creadoAt: new Date(a.creadoMs).toISOString(),
    }));
}

// ---------- Ventana de la portada ----------
// Encabezado del registro de yonke cuando llega desde la ventana o desde "Yo la tengo" (?desde=alertas).
export const TEXTO_REGISTRO_ALERTAS = 'Regístrate gratis para ver todas las alertas y contestar';
export const VISIBLES_PORTADA = 5;
export const ROTACION_MS = 4000;
export const REFRESCO_PORTADA_MS = 90 * 1000;

// "hace X minutos" con la hora del SERVIDOR: ahoraServidorMs = Date.now() + desfase, donde desfase
// = (hora que mandó el servidor) - (hora del celular al recibirla). Así un reloj mal puesto no
// cambia el texto. Menos de 1 minuto: "hace un momento".
export function haceCuanto(creadoAtIso, ahoraServidorMs) {
  const creado = Date.parse(creadoAtIso);
  if (Number.isNaN(creado)) return '';
  const min = Math.floor(Math.max(0, ahoraServidorMs - creado) / 60000);
  if (min < 1) return 'hace un momento';
  if (min < 60) return min === 1 ? 'hace 1 minuto' : `hace ${min} minutos`;
  const horas = Math.floor(min / 60);
  if (horas < 24) return horas === 1 ? 'hace 1 hora' : `hace ${horas} horas`;
  const dias = Math.floor(horas / 24);
  return dias === 1 ? 'hace 1 día' : `hace ${dias} días`;
}

// Rotación: { mostradas: [ids, la de arriba primero], siguiente: índice en la lista }. Con 5 o
// menos alertas, todas fijas. Con más, en cada paso la siguiente entra arriba y sale la de abajo;
// al llegar al final da la vuelta.
export function rotacionInicial(lista, visibles = VISIBLES_PORTADA) {
  return { mostradas: lista.slice(0, visibles).map((a) => a.id), siguiente: lista.length > visibles ? visibles : 0 };
}
export function rotarUnPaso(estado, lista, visibles = VISIBLES_PORTADA) {
  if (lista.length <= visibles) return estado;
  const entra = lista[estado.siguiente % lista.length].id;
  return { mostradas: [entra, ...estado.mostradas.filter((id) => id !== entra)].slice(0, visibles), siguiente: (estado.siguiente + 1) % lista.length };
}
