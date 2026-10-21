// "Descargar mi historial": el Historial Digital del taller en un archivo CSV (lógica pura).
// - UTF-8 con BOM (Excel lo abre con acentos) y fin de renglón \r\n; separado por comas.
// - Un renglón por servicio (placas, marca, modelo, año, fecha, kilometraje, descripción, piezas)
//   y un renglón por recordatorio PENDIENTE (tipo, fecha de aviso, estado).
// - NUNCA datos del cliente: solo se toman estos campos del vehículo (aunque el documento trajera
//   otros, no se copian).
// - Protección contra fórmulas: una celda que empieza con = + - @ (o tabulador/retorno) se escribe
//   con un apóstrofo al inicio para que Excel no la ejecute.

export const COLUMNAS_HISTORIAL = [
  'Placas', 'Marca', 'Modelo', 'Año', 'Registro', 'Fecha', 'Kilometraje', 'Descripción', 'Piezas',
  'Recordatorio', 'Fecha de aviso', 'Estado',
] as const;

const BOM = '﻿';

export function celdaCsv(valor: unknown): string {
  let t = valor === null || valor === undefined ? '' : String(valor);
  if (/^[=+\-@\t\r]/.test(t)) t = `'${t}`;
  return /[",\r\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
}

const p2 = (n: number) => String(n).padStart(2, '0');
export function fechaCsv(ms: number | null): string {
  if (ms === null || !Number.isFinite(ms)) return '';
  const f = new Date(ms);
  return `${p2(f.getDate())}/${p2(f.getMonth() + 1)}/${f.getFullYear()}`;
}

type Servicio = { fecha?: unknown; kilometraje?: unknown; descripcion?: unknown; piezas?: unknown };
type Recordatorio = { tipo?: unknown; fecha?: unknown; estado?: unknown };
export type VehiculoParaExportar = {
  placas?: unknown; marca?: unknown; modelo?: unknown; anio?: unknown;
  servicios?: Servicio[]; recordatorios?: Recordatorio[];
};

// aMs: convierte la fecha guardada (Timestamp de Firestore, Date o ms) a milisegundos, o null.
export function csvHistorial(vehiculos: VehiculoParaExportar[], aMs: (v: unknown) => number | null): string {
  const filas: unknown[][] = [];
  const ordenados = [...vehiculos].sort((a, b) => String(a.placas ?? '').localeCompare(String(b.placas ?? ''), 'es'));
  for (const v of ordenados) {
    const base = [v.placas, v.marca, v.modelo, v.anio];
    const servicios = [...(v.servicios || [])].sort((a, b) => (aMs(a.fecha) ?? 0) - (aMs(b.fecha) ?? 0));
    for (const s of servicios) {
      const km = Number.isInteger(s.kilometraje) ? s.kilometraje : '';
      const piezas = Array.isArray(s.piezas) ? s.piezas.filter((x) => typeof x === 'string').join('; ') : '';
      filas.push([...base, 'Servicio', fechaCsv(aMs(s.fecha)), km, s.descripcion ?? '', piezas, '', '', '']);
    }
    const pendientes = (v.recordatorios || [])
      .filter((r) => r.estado === 'pendiente')
      .sort((a, b) => (aMs(a.fecha) ?? 0) - (aMs(b.fecha) ?? 0));
    for (const r of pendientes) {
      filas.push([...base, 'Recordatorio', '', '', '', '', r.tipo ?? '', fechaCsv(aMs(r.fecha)), r.estado]);
    }
  }
  const renglones = [COLUMNAS_HISTORIAL, ...filas].map((fila) => fila.map(celdaCsv).join(','));
  return BOM + renglones.join('\r\n') + '\r\n';
}

export function nombreCsvHistorial(fecha: Date = new Date()): string {
  return `historial-${fecha.getFullYear()}-${p2(fecha.getMonth() + 1)}-${p2(fecha.getDate())}.csv`;
}
