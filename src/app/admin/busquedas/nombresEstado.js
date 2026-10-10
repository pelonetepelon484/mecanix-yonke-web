// @svg-maps/mexico usa como `id` el código ISO 3166-2:MX en minúsculas (agu, bcn, ..., zac) —
// el mismo esquema que resolverGeoIp() ya guarda en `estadoGeografico` (ver
// src/lib/geoVercel.ts). Nombres en español para mostrar (el paquete trae "Mexico
// City" sin acentos en varios casos). Lo usan el mapa y la tabla de piezas sin inventario.
export const NOMBRES_ESTADO = {
  agu: 'Aguascalientes', bcn: 'Baja California', bcs: 'Baja California Sur',
  cam: 'Campeche', chp: 'Chiapas', chh: 'Chihuahua', coa: 'Coahuila', col: 'Colima',
  cmx: 'Ciudad de México', dur: 'Durango', gua: 'Guanajuato', gro: 'Guerrero',
  hid: 'Hidalgo', jal: 'Jalisco', mex: 'Estado de México', mic: 'Michoacán',
  mor: 'Morelos', nay: 'Nayarit', nle: 'Nuevo León', oax: 'Oaxaca', pue: 'Puebla',
  que: 'Querétaro', roo: 'Quintana Roo', slp: 'San Luis Potosí', sin: 'Sinaloa',
  son: 'Sonora', tab: 'Tabasco', tam: 'Tamaulipas', tla: 'Tlaxcala', ver: 'Veracruz',
  yuc: 'Yucatán', zac: 'Zacatecas',
};
