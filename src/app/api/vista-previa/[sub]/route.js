import { imagenDeYonke, imagenGenerica } from '../../../lib/imagenVistaPrevia';
import { datosImagenDeSubdominio, leerRecursosImagen } from '../../../lib/vistaPreviaTenant';

// GET /api/vista-previa/{subdominio}: imagen de 1200 × 630 (PNG) que WhatsApp y Facebook muestran
// al compartir el enlace del subdominio de un yonke (la piden las etiquetas de tenant-demo). Vive
// en el sitio principal porque en el subdominio todas las rutas van a la página del yonke. Caché
// de 1 día. Si el yonke no califica, la imagen genérica de Mecanix.
export const runtime = 'nodejs';

export async function GET(request, { params }) {
  const { sub } = await params;
  const recursos = await leerRecursosImagen();
  let datos = null;
  try {
    datos = await datosImagenDeSubdominio(sub);
  } catch (error) {
    console.error('[vista-previa] No se pudieron leer los datos del yonke; imagen genérica', { sub, message: error?.message });
  }
  return datos ? imagenDeYonke(datos, recursos) : imagenGenerica(recursos);
}
