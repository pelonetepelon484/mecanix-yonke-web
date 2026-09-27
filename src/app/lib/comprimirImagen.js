import { dimensionesEscaladas } from '../../lib/imagenes';

function cargarImagen(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('No se pudo leer la imagen')); };
    img.src = url;
  });
}

function aBlob(canvas, tipo, calidad) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('No se pudo procesar la imagen'))), tipo, calidad);
  });
}

// Reduce y re-codifica una imagen en el navegador vía canvas (sin librerías externas). Compartida
// por el logo (400x400, PNG, sin tope de peso — comportamiento original) y las promociones
// (ancho máx. 1200, WebP, tope de peso).
//
//  - maxAncho / maxAlto: límites de tamaño; nunca agranda.
//  - tipo: formato de salida ('image/png', 'image/webp', …). Si el navegador no sabe codificar ese
//    formato (Safari viejo no codifica WebP) devuelve otro; el llamador debe usar blob.type.
//  - calidad / maxBytes: con maxBytes, baja la calidad (de `calidad` a `calidadMinima`, de 0.1 en
//    0.1) y, si aun así pesa de más, reduce el tamaño un 15% y repite (hasta 4 veces). Sin
//    maxBytes hace una sola pasada.
export async function comprimirImagen(file, {
  maxAncho, maxAlto, tipo = 'image/png', calidad = 0.85, calidadMinima = 0.4, maxBytes = null,
} = {}) {
  const img = await cargarImagen(file);
  let { ancho, alto } = dimensionesEscaladas(img.width, img.height, { maxAncho, maxAlto });

  for (let ronda = 0; ronda < 4; ronda++) {
    const canvas = document.createElement('canvas');
    canvas.width = ancho;
    canvas.height = alto;
    canvas.getContext('2d').drawImage(img, 0, 0, ancho, alto);

    if (!maxBytes) return aBlob(canvas, tipo, calidad);

    for (let q = calidad; q >= calidadMinima - 1e-9; q -= 0.1) {
      const blob = await aBlob(canvas, tipo, q);
      if (blob.size <= maxBytes) return blob;
    }
    ancho = Math.max(1, Math.round(ancho * 0.85));
    alto = Math.max(1, Math.round(alto * 0.85));
  }
  throw new Error('No se pudo reducir la imagen al peso permitido. Prueba con otra.');
}
