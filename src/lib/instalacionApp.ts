// Lógica pura del aviso "Instalar app" del panel (PWA de yonkes y talleres): qué dispositivo y
// navegador es, si la app ya está instalada y qué aviso toca mostrar. Sin window aquí: quien
// llama le pasa el user agent y lo demás, así se prueba sin navegador.

export type Plataforma = 'ios' | 'android' | 'otra';
export type NavegadorInterno = 'whatsapp' | 'facebook' | 'instagram' | 'tiktok' | 'otro' | null;
export type ModoAviso = 'nada' | 'interno' | 'ios' | 'boton' | 'android-menu';

export const CLAVE_AVISO_CERRADO = 'mecanix_aviso_instalar_cerrado';
const DOMINIO = 'mecanixyonkevirtual.com';

// iPadOS 13+ se presenta como "Macintosh": se distingue de una Mac por la pantalla táctil.
export function detectarPlataforma(ua: string, maxTouchPoints = 0): Plataforma {
  if (/iPhone|iPad|iPod/i.test(ua)) return 'ios';
  if (/Macintosh/i.test(ua) && maxTouchPoints > 1) return 'ios';
  if (/Android/i.test(ua)) return 'android';
  return 'otra';
}

// Navegadores dentro de otras apps: desde ahí no se puede instalar. El de WhatsApp en iPhone
// es una vista de Safari que no se distingue por el user agent (ahí se muestran los 3 pasos).
export function detectarNavegadorInterno(ua: string): NavegadorInterno {
  if (/Instagram/i.test(ua)) return 'instagram';
  if (/FBAN|FBAV|FB_IAB|FBIOS|FB4A|FBSS|Messenger/i.test(ua)) return 'facebook';
  if (/WhatsApp/i.test(ua)) return 'whatsapp';
  if (/musical_ly|BytedanceWebview|TikTok/i.test(ua)) return 'tiktok';
  if (/Android/i.test(ua) && /; wv\)/.test(ua)) return 'otro'; // WebView genérico de Android
  return null;
}

// Instalada = abierta desde el ícono (modo standalone). navigator.standalone es el de iOS.
export function estaInstalada({ standalone, navigatorStandalone }: { standalone: boolean; navigatorStandalone?: boolean }): boolean {
  return standalone || navigatorStandalone === true;
}

// La app solo se instala desde el dominio principal (también localhost y previews de Vercel
// para probar). Nunca desde los subdominios de los yonkes.
export function esDominioPrincipal(hostname: string): boolean {
  const h = hostname.toLowerCase();
  if (h === DOMINIO || h === `www.${DOMINIO}`) return true;
  if (h.endsWith(`.${DOMINIO}`)) return false;
  return h === 'localhost' || h === '127.0.0.1' || h.endsWith('.vercel.app');
}

export function decidirAviso({ instalada, plataforma, navegadorInterno, hayPrompt }: {
  instalada: boolean; plataforma: Plataforma; navegadorInterno: NavegadorInterno; hayPrompt: boolean;
}): ModoAviso {
  if (instalada) return 'nada';
  if (navegadorInterno) return 'interno';
  if (plataforma === 'ios') return 'ios';
  if (hayPrompt) return 'boton'; // Android/Chrome (o computadora) con el aviso del navegador listo
  if (plataforma === 'android') return 'android-menu'; // sin aviso del navegador: instalar desde el menú ⋮
  return 'nada';
}

// localStorage puede no existir o fallar (modo privado, bloqueado): nunca rompe la página.
export function leerAvisoCerrado(storage: Pick<Storage, 'getItem'> | null | undefined): boolean {
  try {
    return storage?.getItem(CLAVE_AVISO_CERRADO) === '1';
  } catch {
    return false;
  }
}

export function guardarAvisoCerrado(storage: Pick<Storage, 'setItem'> | null | undefined): void {
  try {
    storage?.setItem(CLAVE_AVISO_CERRADO, '1');
  } catch {
    // sin almacenamiento: el aviso se cierra solo por esta visita
  }
}

export const NOMBRE_NAVEGADOR_INTERNO: Record<Exclude<NavegadorInterno, null>, string> = {
  whatsapp: 'WhatsApp', facebook: 'Facebook', instagram: 'Instagram', tiktok: 'TikTok', otro: 'otra app',
};
