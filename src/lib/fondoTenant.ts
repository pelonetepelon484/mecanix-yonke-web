// Imagen de fondo de la franja superior del sitio con subdominio (tenant): yonkes/{id}.branding.fondoUrl.
// Reemplaza el color sólido (branding.colorPrimario) cuando existe; si no existe, nada cambia.

export const FONDO_ANCHO_MAX_PX = 1920;
export const FONDO_ALTO_MAX_PX = 640;
// Tope del archivo ORIGINAL antes de comprimir (pedido explícito: "peso máximo, ej. 2 MB") — más
// estricto que promos/sobre-nosotros (10 MB) porque esta imagen se ve en TODAS las páginas del
// sitio del yonke, conviene frenar archivos pesados desde la selección, no solo tras comprimir.
export const FONDO_PESO_ORIGINAL_MAX_BYTES = 2 * 1024 * 1024;
// Tope tras comprimir — banner ancho, pero se sirve en cada carga del sitio: se mantiene ligero.
export const FONDO_PESO_COMPRIMIDO_MAX_BYTES = 500 * 1024;

// Validación de lectura, defensiva: cualquier cosa que no sea una URL https no cuenta como fondo
// (nunca rompe la página por un dato corrupto; simplemente se comporta como si no hubiera fondo).
export function sanearFondoUrl(valor: unknown): string | null {
  return typeof valor === 'string' && valor.startsWith('https://') ? valor : null;
}

// Validación de escritura: la URL debe ser una de descarga de Firebase Storage y pertenecer a la
// ruta branding/{yonkeId}/fondo/ de ESE yonke — mismo criterio que exige la regla de Firestore
// propuesta, para que el error se vea en el navegador antes de que Firestore lo rechace.
export function esUrlDeFondoValida(url: unknown, yonkeId: string): boolean {
  if (typeof url !== 'string' || !yonkeId) return false;
  if (!url.startsWith('https://firebasestorage.googleapis.com/')) return false;
  return url.includes(`branding%2F${yonkeId}%2Ffondo%2F`);
}
