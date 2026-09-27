// Cálculo puro de dimensiones al reducir una imagen (sin canvas ni DOM, para poder probarlo).
// Nunca agranda: si la imagen ya cabe dentro de los límites se devuelve tal cual.
export interface LimitesImagen {
  maxAncho?: number;
  maxAlto?: number;
}

export function dimensionesEscaladas(
  ancho: number,
  alto: number,
  { maxAncho = Infinity, maxAlto = Infinity }: LimitesImagen,
): { ancho: number; alto: number } {
  if (ancho <= maxAncho && alto <= maxAlto) return { ancho, alto };
  const escala = Math.min(maxAncho / ancho, maxAlto / alto);
  return { ancho: Math.max(1, Math.round(ancho * escala)), alto: Math.max(1, Math.round(alto * escala)) };
}
