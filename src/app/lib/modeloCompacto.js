// Comparación "en compacto" de nombres de modelo: minúsculas, sin acentos y SIN nada que no sea
// letra o número (guiones, espacios, puntos...). Así "CR-V", "crv", "cr v" y "Cr-V" son el mismo
// modelo, igual que "RAV4" y "rav 4". Solo se usa para COMPARAR; lo que se guarda o se muestra
// sigue siendo el nombre tal cual. La usan el buscador inteligente (extraerIntencion.js), la
// revisión de catálogo (consultarInventario.js) y la comparación contra el inventario
// (buscarVehiculosPorAnio.js, compartida con el buscador avanzado).
const DIACRITICOS_COMBINABLES = new RegExp('[\\u0300-\\u036f]', 'g');

export function compactarModelo(texto) {
  return String(texto ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(DIACRITICOS_COMBINABLES, '')
    .replace(/[^a-z0-9]/g, '');
}

export function mismoModelo(a, b) {
  const ca = compactarModelo(a);
  return ca !== '' && ca === compactarModelo(b);
}
