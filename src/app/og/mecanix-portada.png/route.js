import { imagenPortada, leerRecursosPortada } from '../../lib/imagenPortada';

// GET /og/mecanix-portada.png: imagen de vista previa de la portada (1200 × 630). Se genera UNA vez
// al compilar (estática): el logo y las fuentes se leen del disco del proyecto en ese momento, así
// que no hace falta incluirlos en la función del servidor (next.config.mjs no cambia).
export const dynamic = 'force-static';
export const runtime = 'nodejs';

export async function GET() {
  return imagenPortada(await leerRecursosPortada());
}
