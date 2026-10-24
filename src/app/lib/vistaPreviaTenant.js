import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { getTenantBySub, redireccionSinPremium, resolveBranding, subdominioEstaActivo } from './getTenant';
import { obtenerEstadosCombinado } from './busqueda/estadosServer';
import { CIUDADES_BC } from './ciudades';
import { esLogoPermitido, esSubdominioValido, lugarDeYonke, metadataVistaPrevia } from '../../lib/vistaPreviaYonke';

// Solo servidor. Datos de la vista previa al compartir el subdominio de un yonke.

// Ciudad o estado del yonke. Solo lee la colección `estados` (con caché de 10 min) cuando la
// ciudad no basta.
async function lugarDe(tenant) {
  if (CIUDADES_BC.some((c) => c.key === tenant.ciudad)) return lugarDeYonke(tenant);
  return lugarDeYonke(tenant, await obtenerEstadosCombinado());
}

// Etiquetas para generateMetadata de la página del subdominio y de su /politicas. El tenant ya lo
// leyó la página; aquí no se lee de nuevo.
export async function metadataVistaPreviaDeTenant(tenant, sub, { ruta = '', titulo = '' } = {}) {
  const branding = resolveBranding(tenant);
  return metadataVistaPrevia({
    sub, nombre: branding.nombre, lugar: await lugarDe(tenant), logoUrl: branding.logoUrl, colorPrimario: branding.colorPrimario, ruta, titulo,
  });
}

// Datos para la imagen, o null si debe salir la genérica de Mecanix: formato inválido (sin leer
// nada), yonke inexistente o inactivo, subdominio apagado, o sin Premium vigente con los límites
// encendidos (las mismas condiciones con las que la página del subdominio se muestra).
export async function datosImagenDeSubdominio(sub, { descargarLogo = descargarLogoComoDataUri } = {}) {
  if (!esSubdominioValido(sub)) return null;
  const tenant = await getTenantBySub(sub);
  if (!tenant || !subdominioEstaActivo(tenant)) return null;
  if (await redireccionSinPremium(tenant)) return null;
  const branding = resolveBranding(tenant);
  const logo = esLogoPermitido(branding.logoUrl) ? await descargarLogo(branding.logoUrl) : null;
  return { nombre: branding.nombre, lugar: await lugarDe(tenant), colorPrimario: branding.colorPrimario, logo };
}

const TIPOS_LOGO = ['image/png', 'image/jpeg'];
const MAX_LOGO_BYTES = 2 * 1024 * 1024;

// Logo del yonke (Firebase Storage) como data URI. Si tarda, no es PNG/JPEG o pesa de más,
// null: la imagen sale con el nombre en lugar del logo.
export async function descargarLogoComoDataUri(url) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
    const tipo = (res.headers.get('content-type') || '').split(';')[0].trim();
    if (!res.ok || !TIPOS_LOGO.includes(tipo)) return null;
    const bytes = Buffer.from(await res.arrayBuffer());
    if (bytes.length === 0 || bytes.length > MAX_LOGO_BYTES) return null;
    return `data:${tipo};base64,${bytes.toString('base64')}`;
  } catch {
    return null;
  }
}

// Logos NUEVOS de Mecanix (public/: logo-mecanix-solo para el crédito "Con tecnología" y
// logo-mecanix-red-yonkes para la imagen genérica) y tipografía Inter (src/assets/fuentes/),
// incluidos en la función por next.config.mjs. Se leen una vez por instancia del servidor.
// raiz: otra carpeta (solo pruebas), sin guardar en la caché.
function cargarRecursos(raiz) {
  const logo = async (archivo) => `data:image/png;base64,${(await readFile(path.join(raiz, 'public', archivo))).toString('base64')}`;
  const fuente = (archivo) => readFile(path.join(raiz, 'src', 'assets', 'fuentes', archivo));
  return Promise.all([logo('logo-mecanix-solo.png'), logo('logo-mecanix-red-yonkes.png'), fuente('inter-regular.ttf'), fuente('inter-semibold.ttf')])
    .then(([solo, nuevo, regular, seminegrita]) => ({
      solo, nuevo,
      fuentes: [
        { name: 'Inter', data: regular, weight: 400, style: 'normal' },
        { name: 'Inter', data: seminegrita, weight: 600, style: 'normal' },
      ],
    }));
}
let recursos = null;
export async function leerRecursosImagen(raiz) {
  if (raiz) return cargarRecursos(raiz);
  if (!recursos) {
    recursos = cargarRecursos(process.cwd()).catch((error) => { recursos = null; throw error; });
  }
  return recursos;
}
