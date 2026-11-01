// Constancias de cada registro de yonke, además del historial de Términos
// (yonkes/{id}/aceptaciones/{versión}): Aviso de Privacidad y declaración de autorización, cada una
// en yonkes/{id}/constancias/{tipo}_{versión}. Textos del abogado: cambiarlos solo aquí.
export const CONSTANCIA_PRIVACIDAD = 'privacidad';
export const CONSTANCIA_AUTORIZACION = 'autorizacion';
export const idConstancia = (tipo, version) => `${tipo}_${version}`;

export const DECLARACION_LIGERO = 'Declaro que estoy autorizado para registrar este negocio y utilizar el número de WhatsApp proporcionado, tanto para acceder a Mecanix como para recibir contactos de clientes interesados en las piezas que ofrezca el yonke.';
export const DECLARACION_COMPLETO = 'Declaro que estoy autorizado para registrar este negocio y utilizar los números de contacto proporcionados, tanto para acceder a Mecanix como para recibir contactos de clientes interesados en las piezas que ofrezca el yonke.';
export const MENSAJE_FALTAN_CASILLAS = 'Debes aceptar los Términos y Condiciones y el Aviso de Privacidad, y confirmar tu declaración, para registrarte.';
