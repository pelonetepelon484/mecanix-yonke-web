// Temas de color predefinidos para la página con subdominio del yonke (branding.colorPrimario /
// branding.colorAcento, ver getTenant.js). Se presentan como muestras visuales de un clic — el
// yonkero no es técnico, así que nunca se ofrece un selector de color libre ni códigos hex.
// Acentos limitados a los dos tonos ya probados en producción (#E8720C naranja, #1A3C5E azul)
// para que el contraste de texto blanco sobre botones/badges siga funcionando en todos los temas.
export const TEMAS_COLOR = [
  { id: 'azul', nombre: 'Azul Mecanix', colorPrimario: '#1A3C5E', colorAcento: '#E8720C' },
  { id: 'rojo', nombre: 'Rojo', colorPrimario: '#8B1E1E', colorAcento: '#E8720C' },
  { id: 'verde', nombre: 'Verde', colorPrimario: '#1E5631', colorAcento: '#E8720C' },
  { id: 'naranja', nombre: 'Naranja', colorPrimario: '#C1440E', colorAcento: '#1A3C5E' },
  { id: 'morado', nombre: 'Morado', colorPrimario: '#4B2E83', colorAcento: '#E8720C' },
  { id: 'gris', nombre: 'Gris oscuro', colorPrimario: '#2E3338', colorAcento: '#E8720C' },
];

// Azul Mecanix = el tema de marca actual — default si el yonke no elige ninguno.
export const TEMA_DEFAULT_ID = 'azul';
