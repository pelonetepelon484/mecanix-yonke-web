// Sección "Sobre nosotros" configurable del sitio con subdominio (tenant): yonkes/{id}.sitio.sobreNosotros
// = { texto, aniosExperiencia, direccion, horario, fotoUrl }. Solo texto plano (nunca HTML) — se
// renderiza siempre como texto, jamás con dangerouslySetInnerHTML. Si no hay `texto`, la sección
// no se muestra (los demás campos son complementarios, no sostienen la sección por sí solos).

export const SOBRE_NOSOTROS_TEXTO_MAX = 800;
export const SOBRE_NOSOTROS_DIRECCION_MAX = 200;
export const SOBRE_NOSOTROS_HORARIO_MAX = 200;

export interface SobreNosotros {
  texto: string;
  aniosExperiencia: number | null;
  direccion: string | null;
  horario: string | null;
  fotoUrl: string | null;
}

// El bucket real (NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET) se pasa como parámetro para no acoplar
// esta lógica pura a `process.env` — así se puede probar con cualquier bucket sintético.
export function esUrlDeNuestroStorage(url: unknown, bucket: string): boolean {
  if (typeof url !== 'string') return false;
  try {
    const u = new URL(url);
    if (u.protocol !== 'https:') return false;
    if (u.hostname === 'firebasestorage.googleapis.com') {
      // Firebase codifica la ruta como .../o/<bucket>%2F... en la URL de descarga.
      return u.pathname.includes(`/${bucket}/o/`) || u.pathname.includes(`%2F`) && u.pathname.includes(bucket);
    }
    // Formato alterno de Storage: https://storage.googleapis.com/<bucket>/...
    if (u.hostname === 'storage.googleapis.com') return u.pathname.startsWith(`/${bucket}/`);
    return false;
  } catch {
    return false;
  }
}

// Lo que se lee del documento (dato no confiable): si `texto` no es un string no vacío, se
// considera "sin sobre nosotros" (null) — nunca rompe la página por un dato corrupto.
export function sanearSobreNosotros(valor: unknown): SobreNosotros | null {
  if (!valor || typeof valor !== 'object') return null;
  const v = valor as Record<string, unknown>;
  const texto = typeof v.texto === 'string' ? v.texto.trim() : '';
  if (!texto) return null;
  return {
    texto: texto.slice(0, SOBRE_NOSOTROS_TEXTO_MAX),
    aniosExperiencia: typeof v.aniosExperiencia === 'number' && Number.isFinite(v.aniosExperiencia) && v.aniosExperiencia >= 0
      ? v.aniosExperiencia
      : null,
    direccion: typeof v.direccion === 'string' && v.direccion.trim() ? v.direccion.trim().slice(0, SOBRE_NOSOTROS_DIRECCION_MAX) : null,
    horario: typeof v.horario === 'string' && v.horario.trim() ? v.horario.trim().slice(0, SOBRE_NOSOTROS_HORARIO_MAX) : null,
    fotoUrl: typeof v.fotoUrl === 'string' && v.fotoUrl.startsWith('https://') ? v.fotoUrl : null,
  };
}

export type ResultadoSobreNosotros = { ok: true } | { ok: false; error: string };

// Validación de lo que se va a GUARDAR — mismas reglas que la regla de Firestore propuesta.
// `bucket` es opcional: si se pasa, también valida que fotoUrl sea de nuestro Storage.
export function validarSobreNosotrosParaGuardar(datos: {
  texto: string;
  aniosExperiencia?: unknown;
  direccion?: unknown;
  horario?: unknown;
  fotoUrl?: unknown;
}, bucket?: string): ResultadoSobreNosotros {
  const texto = datos.texto?.trim() ?? '';
  if (!texto) return { ok: false, error: 'Escribe el texto de "Sobre nosotros".' };
  if (texto.length > SOBRE_NOSOTROS_TEXTO_MAX) {
    return { ok: false, error: `El texto puede tener máximo ${SOBRE_NOSOTROS_TEXTO_MAX} caracteres.` };
  }
  if (/[<>]/.test(texto)) {
    return { ok: false, error: 'El texto no puede contener los caracteres < o > (solo texto plano).' };
  }
  if (datos.aniosExperiencia !== undefined && datos.aniosExperiencia !== null && datos.aniosExperiencia !== '') {
    const n = Number(datos.aniosExperiencia);
    if (!Number.isFinite(n) || n < 0) return { ok: false, error: 'Los años de experiencia deben ser un número positivo.' };
    // La regla de Firestore exige entero (is int); un decimal como 2.5 la haría fallar con permission-denied.
    if (!Number.isInteger(n)) return { ok: false, error: 'Los años de experiencia deben ser un número entero (sin decimales).' };
  }
  if (datos.fotoUrl && bucket && !esUrlDeNuestroStorage(datos.fotoUrl, bucket)) {
    return { ok: false, error: 'La foto no tiene una URL de nuestro almacenamiento.' };
  }
  return { ok: true };
}
