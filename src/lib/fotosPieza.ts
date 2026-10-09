// Fotos de motores, transmisiones y piezas sueltas: hasta 3. Compatibilidad sin migrar datos:
//   - `foto` ({url, path}) sigue siendo la PRIMERA foto, igual que antes (todo lo que ya la leía
//     sigue funcionando, y una pieza vieja con solo `foto` tiene 1 foto);
//   - `fotosExtra` ([{url, path}], hasta 2) guarda la segunda y la tercera.
// Las piezas de vehículo siguen con 1 sola foto (no usan esto).

export const MAX_FOTOS_PIEZA = 3;

export type FotoPieza = { url: string; path?: string };

function valida(f: unknown): f is FotoPieza {
  return !!f && typeof (f as FotoPieza).url === 'string' && (f as FotoPieza).url.length > 0;
}

// Lista de fotos de un documento (motor, transmisión o pieza suelta), primera primero.
export function fotosDeItem(item: { foto?: unknown; fotosExtra?: unknown } | null | undefined): FotoPieza[] {
  const extra = Array.isArray(item?.fotosExtra) ? item.fotosExtra : [];
  return [item?.foto, ...extra].filter(valida).slice(0, MAX_FOTOS_PIEZA);
}

// Clave para reconocer una foto aunque se haya guardado sin `path` (por si acaso).
export function claveFoto(f: FotoPieza): string {
  return f.path || f.url;
}

export const MENSAJE_MAXIMO_FOTOS = `Puedes subir hasta ${MAX_FOTOS_PIEZA} fotos.`;

// Nueva lista al cambiar UNA foto:
//   claveAnterior = la foto que se reemplaza o se quita (null = foto nueva, se agrega al final);
//   nueva = la foto subida (null = quitar la anterior).
// Lanza si se intenta pasar de 3.
export function reemplazarFoto(lista: FotoPieza[], claveAnterior: string | null, nueva: FotoPieza | null): FotoPieza[] {
  const actual = lista.filter(valida);
  if (claveAnterior === null) {
    if (!nueva) return actual;
    if (actual.length >= MAX_FOTOS_PIEZA) throw new Error(MENSAJE_MAXIMO_FOTOS);
    return [...actual, nueva];
  }
  const indice = actual.findIndex((f) => claveFoto(f) === claveAnterior);
  if (indice === -1) {
    if (!nueva) return actual;
    if (actual.length >= MAX_FOTOS_PIEZA) throw new Error(MENSAJE_MAXIMO_FOTOS);
    return [...actual, nueva];
  }
  return nueva ? actual.map((f, i) => (i === indice ? nueva : f)) : actual.filter((_, i) => i !== indice);
}

// Campos a guardar en Firestore. null = borrar el campo (el llamador usa deleteField()).
export function camposFotos(lista: FotoPieza[]): { foto: FotoPieza | null; fotosExtra: FotoPieza[] | null } {
  const fotos = lista.filter(valida).slice(0, MAX_FOTOS_PIEZA);
  return { foto: fotos[0] ?? null, fotosExtra: fotos.length > 1 ? fotos.slice(1) : null };
}
