// Enlace a /bienvenida con la pestaña ya elegida (cliente, yonke o taller). Lo usan los botones de
// la portada (ConoceMecanix.js) y lo lee BienvenidaClient.js. Aparte para que la portada no cargue
// el código de /bienvenida.
export const PARAMETRO_SOY = 'soy';
export const enlaceBienvenida = (tipo) => `/bienvenida?${PARAMETRO_SOY}=${tipo}#primeros-pasos`;
