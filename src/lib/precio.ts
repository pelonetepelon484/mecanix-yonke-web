// Precio opcional (MXN) de motores, transmisiones, piezas sueltas y piezas de vehículo.
// Lógica pura: sin Firestore ni React, para probarla con datos sintéticos.

export const PRECIO_MAX = 9_999_999;

export type ParsePrecioResult =
  | { ok: true; value: number | null } // null = campo vacío (no se guarda nada)
  | { ok: false; error: string };

const ERR_FORMATO = 'Escribe solo números (ej. 1500 o 1500.50)';
const ERR_POSITIVO = 'El precio debe ser mayor a 0';
const ERR_DECIMALES = 'Máximo 2 decimales';
const ERR_MAXIMO = `El precio máximo es $${PRECIO_MAX.toLocaleString('en-US')}`;

// Vacío/solo espacios -> { ok:true, value:null }. Acepta "$", espacios, miles con coma
// ("1,234", "1,234.50") y coma decimal ("12,5"). Una coma seguida de exactamente 3 dígitos se
// interpreta como separador de miles (convención mexicana), no como decimal.
export function parsePrecio(input: unknown): ParsePrecioResult {
  if (input === null || input === undefined) return { ok: true, value: null };

  let texto: string;
  if (typeof input === 'number') {
    if (!Number.isFinite(input)) return { ok: false, error: ERR_FORMATO };
    texto = String(input);
  } else if (typeof input === 'string') {
    texto = input;
  } else {
    return { ok: false, error: ERR_FORMATO };
  }

  texto = texto.trim().replace(/^\$/, '').replace(/\s+/g, '');
  if (texto === '') return { ok: true, value: null };
  if (texto.startsWith('-')) return { ok: false, error: ERR_POSITIVO };

  if (texto.includes(',') && texto.includes('.')) {
    if (!/^\d{1,3}(,\d{3})+\.\d*$/.test(texto)) return { ok: false, error: ERR_FORMATO };
    texto = texto.replace(/,/g, '');
  } else if (texto.includes(',')) {
    if (/^\d{1,3}(,\d{3})+$/.test(texto)) texto = texto.replace(/,/g, '');
    else if (/^\d+,\d+$/.test(texto)) texto = texto.replace(',', '.');
    else return { ok: false, error: ERR_FORMATO };
  }

  if (!/^(\d+\.?\d*|\.\d+)$/.test(texto)) return { ok: false, error: ERR_FORMATO };

  const decimales = texto.includes('.') ? texto.split('.')[1].length : 0;
  if (decimales > 2) return { ok: false, error: ERR_DECIMALES };

  const value = Number(texto);
  if (!(value > 0)) return { ok: false, error: ERR_POSITIVO };
  if (value > PRECIO_MAX) return { ok: false, error: ERR_MAXIMO };
  return { ok: true, value };
}

// Para datos que vienen de Firestore/JSON: solo un number finito, > 0 y <= máximo cuenta como
// precio. Cualquier otra cosa (string, 0, null, ausente) se trata como "sin precio".
export function esPrecioValido(valor: unknown): valor is number {
  return typeof valor === 'number' && Number.isFinite(valor) && valor > 0 && valor <= PRECIO_MAX;
}

// "$1,234 MXN"; con centavos: "$1,234.50 MXN".
export function formatPrecio(n: number): string {
  const [entero, decimales] = n.toFixed(2).split('.');
  const conMiles = entero.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `$${conMiles}${decimales === '00' ? '' : `.${decimales}`} MXN`;
}

// Un buscador de pieza puede coincidir con varias piezas del mismo vehículo (ej. "Parachoques"
// -> delantero y trasero). Se devuelve UNA: la de menor precio entre las que tienen precio; si
// ninguna lo tiene, la primera (precio null). El nombre viaja con el precio para que quede claro
// a qué pieza corresponde.
export function elegirPiezaParaPrecio(
  coincidentes: Array<{ nombre: string; precio?: unknown }>,
): { nombre: string; precio: number | null } | null {
  if (coincidentes.length === 0) return null;
  let mejor: { nombre: string; precio: number } | null = null;
  for (const p of coincidentes) {
    if (esPrecioValido(p.precio) && (mejor === null || p.precio < mejor.precio)) {
      mejor = { nombre: p.nombre, precio: p.precio };
    }
  }
  return mejor ?? { nombre: coincidentes[0].nombre, precio: null };
}
