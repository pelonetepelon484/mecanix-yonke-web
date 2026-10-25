// "1 yonke tiene" / "3 yonkes tienen": singular y plural en los encabezados de resultados del
// buscador (antes "1 yonke(s) tienen").
export const cuantosYonkes = (n) => (n === 1 ? '1 yonke' : `${n} yonkes`);
export const verboTener = (n) => (n === 1 ? 'tiene' : 'tienen');
