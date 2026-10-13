// Línea de confianza junto al buscador: "31 yonkes registrados en 7 estados y creciendo".
// Cuenta TODOS los yonkes registrados (documentos de la colección yonkes, incluidos los que
// todavía no aprueba el admin) y los estados con al menos uno. La arma page.js en el servidor
// con la misma lectura de yonkes que ya hace para la cobertura (cada 10 min, sin lecturas extra).
// Sin conteo (la lectura falló) devuelve '' y la línea no se muestra.
export function textoConteoRedYonkes(conteo) {
  if (!conteo || !Number.isInteger(conteo.yonkes) || !Number.isInteger(conteo.estados) || conteo.yonkes < 1 || conteo.estados < 1) return '';
  const yonkes = conteo.yonkes === 1 ? '1 yonke registrado' : `${conteo.yonkes} yonkes registrados`;
  const estados = conteo.estados === 1 ? '1 estado' : `${conteo.estados} estados`;
  return `${yonkes} en ${estados} y creciendo`;
}
