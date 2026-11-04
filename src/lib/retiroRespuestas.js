// Respuestas que el admin retira de una búsqueda: motivo, aviso al cliente en su enlace y mensajes
// de WhatsApp que el admin manda a mano (el servidor no tiene cómo escribirles).
import { whatsappDiezDigitos } from './yonkeLigero';

export const MOTIVO_NUMERO_AJENO = 'numeroAjeno';
export const MOTIVOS_RETIRO = [
  { id: 'pidioYonke', nombre: 'Lo pidió el yonke' },
  { id: 'sinPieza', nombre: 'Ya no tiene la pieza' },
  { id: MOTIVO_NUMERO_AJENO, nombre: 'Número ajeno' },
  { id: 'errorMecanix', nombre: 'Error de Mecanix' },
  { id: 'otro', nombre: 'Otro' },
];
export const nombreMotivo = (id) => MOTIVOS_RETIRO.find((m) => m.id === id)?.nombre || id;

// La evidencia de "Sugerir yonke" se conserva con este motivo cuando hay un reclamo de número.
export const MOTIVO_CONSERVAR_RECLAMO = 'Reclamo de número ajeno: respuesta retirada';

// Sin nombre del yonke ni motivo: el enlace puede estar compartido.
export const TEXTO_RETIRO_CLIENTE = 'Mecanix retiró una respuesta de esta búsqueda. Si ya habías contactado a ese yonke, confirma directamente con ese yonke antes de pagar.';

function busqueda(pedido) {
  const v = pedido.vehiculo || {};
  return `${pedido.pieza} para ${[v.marca, v.modelo, v.anio].filter(Boolean).join(' ')}`;
}

export const mensajeRetiroSolicitante = (pedido) => `Hola, te escribimos de Red Mecanix sobre tu búsqueda de ${busqueda(pedido)}. Retiramos una respuesta de esa búsqueda. Si ya habías contactado a ese yonke, confirma directamente con ese yonke antes de pagar.`;

export const mensajeRetiroYonke = (pedido, motivo) => `Hola, te escribimos de Red Mecanix. Retiramos tu respuesta a la búsqueda de ${busqueda(pedido)}. Motivo: ${nombreMotivo(motivo)}. Si crees que es un error, responde este mensaje.`;

// Número ajeno: ese WhatsApp es de quien reclamó, no del dueño de la cuenta.
export const seAvisaAlYonke = (motivo) => motivo !== MOTIVO_NUMERO_AJENO;

export function enlaceWhatsapp(numero, texto) {
  const diez = whatsappDiezDigitos(numero);
  return diez ? `https://wa.me/52${diez}?text=${encodeURIComponent(texto)}` : null;
}
