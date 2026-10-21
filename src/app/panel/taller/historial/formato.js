// Fechas del historial en español de México (Timestamp de Firestore, Date o nada).
export function fechaLarga(valor) {
  const f = valor?.toDate ? valor.toDate() : (valor instanceof Date ? valor : null);
  return f ? f.toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' }) : '';
}

export const kmTexto = (km) => (Number.isInteger(km) ? `${km.toLocaleString('es-MX')} km` : 'Sin kilometraje');
