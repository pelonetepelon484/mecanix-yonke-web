import { dimensionesEscaladas } from '../../lib/imagenes';

// Detecta una sola vez si el navegador sabe codificar WebP (Safari viejo no). Si se pide WebP y
// no hay soporte, se sustituye por JPEG -- antes caía al default de canvas.toBlob() para un tipo
// no soportado, que es SIEMPRE PNG (mucho más pesado, nunca lo que el llamador esperaba).
let soportaWebPCache = null;
function soportaWebP() {
  if (soportaWebPCache !== null) return soportaWebPCache;
  const canvas = document.createElement('canvas');
  canvas.width = 1;
  canvas.height = 1;
  soportaWebPCache = canvas.toDataURL('image/webp').startsWith('data:image/webp');
  return soportaWebPCache;
}

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
//  - tipo: formato de salida ('image/png', 'image/webp', …). Si se pide WebP y el navegador no
//    sabe codificarlo, se sustituye por JPEG antes de la primera pasada (ver soportaWebP arriba)
//    -- el llamador de todas formas debe usar blob.type, nunca asumir que es lo que pidió.
//  - calidad / maxBytes: con maxBytes, baja la calidad (de `calidad` a `calidadMinima`, de 0.1 en
//    0.1) y, si aun así pesa de más, reduce el tamaño un 15% y repite (hasta 4 veces). Sin
//    maxBytes hace una sola pasada.
export async function comprimirImagen(file, {
  maxAncho, maxAlto, tipo = 'image/png', calidad = 0.85, calidadMinima = 0.4, maxBytes = null,
} = {}) {
  const tipoReal = tipo === 'image/webp' && !soportaWebP() ? 'image/jpeg' : tipo;
  const img = await cargarImagen(file);
  let { ancho, alto } = dimensionesEscaladas(img.width, img.height, { maxAncho, maxAlto });

  for (let ronda = 0; ronda < 4; ronda++) {
    const canvas = document.createElement('canvas');
    canvas.width = ancho;
    canvas.height = alto;
    canvas.getContext('2d').drawImage(img, 0, 0, ancho, alto);

    if (!maxBytes) return aBlob(canvas, tipoReal, calidad);

    for (let q = calidad; q >= calidadMinima - 1e-9; q -= 0.1) {
      const blob = await aBlob(canvas, tipoReal, q);
      if (blob.size <= maxBytes) return blob;
    }
    ancho = Math.max(1, Math.round(ancho * 0.85));
    alto = Math.max(1, Math.round(alto * 0.85));
  }
  throw new Error('No se pudo reducir la imagen al peso permitido. Prueba con otra.');
}
