// Detección de búsquedas por número de parte / SKU — Mecanix no las maneja (el inventario de
// los yonkes se organiza por vehículo/motor, no captura números de parte). En vez de un
// "no encontrado" genérico, se ofrece un mensaje que redirige al cliente a buscar por
// motor/vehículo. Ver los puntos de uso en route.js: SIEMPRE se aplica como ÚLTIMO RECURSO,
// después de intentar la búsqueda normal — nunca antes.

export const MENSAJE_NUMERO_DE_PARTE =
  'No hacemos búsqueda por número de parte, pero si sabes qué motor o vehículo lo puede tener con gusto lo buscamos para ti.';

// Señal EXPLÍCITA (100% segura): el cliente mismo nombra que está dando un número de
// parte/SKU/código. Se exige además que haya algún dígito en el texto — si alguien escribe
// "sku" sin ningún número todavía no hay nada que aclarar.
const REGEX_SEÑAL_EXPLICITA = /\b(sku|numero de parte|no\.?\s*de\s*parte|num\.?\s*de\s*parte|codigo|clave)\b/;

export function tieneSenialExplicitaNumeroDeParte(textoNormalizado) {
  return REGEX_SEÑAL_EXPLICITA.test(textoNormalizado) && /\d/.test(textoNormalizado);
}

// Señal por DESCARTE (más delicada): un token compuesto solo por dígitos (sin punto decimal,
// así nunca se confunde con cilindrada — ver cilindrada.js) que no es ni el año ya extraído ni
// el modelo numérico ya resuelto del catálogo (ej. RAM 700, Chrysler 200). Palabras sueltas
// como "std" o "4x4" no estorban: solo se buscan tokens 100% numéricos.
// Quien llama debe exigir además `pieza` reconocida (ver extraerIntencion.js) y, para no
// atrapar un modelo real que simplemente no está catalogado todavía (ej. "720"), solo se debe
// usar esta señal en los puntos donde la búsqueda normal YA se intentó y no encontró nada —
// nunca en vez de "no identificamos el modelo".
export function tieneNumeroSospechoso(textoNormalizado, { anio, modelo }) {
  const anioStr = anio != null ? String(anio) : null;
  const modeloStr = modelo != null ? String(modelo).toLowerCase() : null;
  return textoNormalizado.split(/\s+/).filter(Boolean).some((token) => {
    if (!/^\d+$/.test(token)) return false;
    if (token === anioStr) return false;
    if (token === modeloStr) return false;
    return true;
  });
}
