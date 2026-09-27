import { toMillis } from './inventoryStatus';

// Garantía/políticas de un yonke — UNA sola fuente: yonkes/{id}.garantia = {diasDefault, queCubre,
// queNoCubre, actualizadoAt}. La usan (a) NotaGarantiaModal.js como precarga al crear una nota
// NUEVA (con sus propios defaults de garantiaDefault.js si el yonke nunca guardó nada), y (b) la
// página pública /politicas del tenant, que en cambio debe OCULTARSE si el yonke nunca capturó
// texto real — por eso esta función pura no aplica ningún default: null significa "nada
// capturado todavía", y cada llamador decide qué hacer con eso.

export interface PoliticasYonke {
  diasDefault: number | null;
  queCubre: string | null;
  queNoCubre: string | null;
  actualizadoAtMs: number | null;
}

// null si no hay garantía capturada, o si queCubre y queNoCubre están ambos vacíos (un
// `diasDefault` guardado sin ningún texto no cuenta como "políticas reales").
export function politicasDesdeGarantia(garantia: unknown): PoliticasYonke | null {
  if (!garantia || typeof garantia !== 'object') return null;
  const g = garantia as Record<string, unknown>;
  const queCubre = typeof g.queCubre === 'string' ? g.queCubre.trim() : '';
  const queNoCubre = typeof g.queNoCubre === 'string' ? g.queNoCubre.trim() : '';
  if (!queCubre && !queNoCubre) return null;
  return {
    diasDefault: typeof g.diasDefault === 'number' && Number.isFinite(g.diasDefault) ? g.diasDefault : null,
    queCubre: queCubre || null,
    queNoCubre: queNoCubre || null,
    actualizadoAtMs: toMillis(g.actualizadoAt),
  };
}
