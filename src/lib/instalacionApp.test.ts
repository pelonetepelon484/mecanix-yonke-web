import { describe, expect, it } from 'vitest';
import {
  CLAVE_AVISO_CERRADO, decidirAviso, detectarNavegadorInterno, detectarPlataforma, esDominioPrincipal, estaInstalada,
  guardarAvisoCerrado, leerAvisoCerrado,
} from './instalacionApp';

// User agents reales (recortados a lo que importa).
export const UA = {
  iphoneSafari: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
  iphoneChrome: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/126.0.6478.54 Mobile/15E148 Safari/604.1',
  ipadOS: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
  macSafari: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
  androidChrome: 'Mozilla/5.0 (Linux; Android 14; SM-A546B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.6478.71 Mobile Safari/537.36',
  androidWhatsApp: 'Mozilla/5.0 (Linux; Android 13; moto g54) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Mobile Safari/537.36 WhatsApp/2.24.12.78',
  androidWebView: 'Mozilla/5.0 (Linux; Android 13; Pixel 7 Build/TQ3A; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/125.0.0.0 Mobile Safari/537.36',
  facebookIos: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBDV/iPhone14,5;FBMD/iPhone;FBSN/iOS;FBSV/17.5;FBSS/3;FBID/phone;FBLC/es_LA;FBOP/5]',
  facebookAndroid: 'Mozilla/5.0 (Linux; Android 14; SM-S911B Build/UP1A; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/126.0.0.0 Mobile Safari/537.36 [FB_IAB/FB4A;FBAV/470.0.0.40.79;]',
  instagram: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 334.0.4.32.98 (iPhone14,5; iOS 17_5; es_MX; es-MX; scale=3.00; 1170x2532; 612193917)',
  windowsChrome: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
};

describe('plataforma', () => {
  it('iPhone (Safari o Chrome) e iPad son iOS; un iPad se distingue de una Mac por la pantalla táctil', () => {
    expect(detectarPlataforma(UA.iphoneSafari)).toBe('ios');
    expect(detectarPlataforma(UA.iphoneChrome)).toBe('ios');
    expect(detectarPlataforma(UA.ipadOS, 5)).toBe('ios');
    expect(detectarPlataforma(UA.macSafari, 0)).toBe('otra');
  });
  it('Android es Android; Windows es otra', () => {
    expect(detectarPlataforma(UA.androidChrome)).toBe('android');
    expect(detectarPlataforma(UA.androidWhatsApp)).toBe('android');
    expect(detectarPlataforma(UA.windowsChrome)).toBe('otra');
  });
});

describe('navegador interno (no se puede instalar desde ahí)', () => {
  it('detecta WhatsApp, Facebook, Instagram y el WebView genérico de Android', () => {
    expect(detectarNavegadorInterno(UA.androidWhatsApp)).toBe('whatsapp');
    expect(detectarNavegadorInterno(UA.facebookIos)).toBe('facebook');
    expect(detectarNavegadorInterno(UA.facebookAndroid)).toBe('facebook');
    expect(detectarNavegadorInterno(UA.instagram)).toBe('instagram');
    expect(detectarNavegadorInterno(UA.androidWebView)).toBe('otro');
  });
  it('Safari, Chrome (iPhone y Android) y navegadores de computadora no son internos', () => {
    for (const ua of [UA.iphoneSafari, UA.iphoneChrome, UA.androidChrome, UA.macSafari, UA.windowsChrome, UA.ipadOS]) {
      expect(detectarNavegadorInterno(ua)).toBeNull();
    }
  });
});

describe('instalada y dominio', () => {
  it('instalada si abre en modo standalone (o navigator.standalone de iPhone)', () => {
    expect(estaInstalada({ standalone: true })).toBe(true);
    expect(estaInstalada({ standalone: false, navigatorStandalone: true })).toBe(true);
    expect(estaInstalada({ standalone: false, navigatorStandalone: false })).toBe(false);
    expect(estaInstalada({ standalone: false })).toBe(false);
  });
  it('solo el dominio principal (y localhost / previews de Vercel); nunca los subdominios de yonkes', () => {
    for (const h of ['mecanixyonkevirtual.com', 'www.mecanixyonkevirtual.com', 'localhost', 'mecanix-git-x.vercel.app']) expect(esDominioPrincipal(h)).toBe(true);
    for (const h of ['elguero.mecanixyonkevirtual.com', 'otro-sitio.com', 'mecanixyonkevirtual.com.malo.mx']) expect(esDominioPrincipal(h)).toBe(false);
  });
});

describe('qué aviso mostrar', () => {
  const base = { instalada: false, plataforma: 'android' as const, navegadorInterno: null, hayPrompt: false };
  it('instalada: nada, aunque sea un navegador interno', () => {
    expect(decidirAviso({ ...base, instalada: true, navegadorInterno: 'whatsapp' })).toBe('nada');
  });
  it('navegador interno gana a todo lo demás', () => {
    expect(decidirAviso({ ...base, navegadorInterno: 'facebook', hayPrompt: true })).toBe('interno');
    expect(decidirAviso({ ...base, plataforma: 'ios', navegadorInterno: 'instagram' })).toBe('interno');
  });
  it('iPhone/iPad: los 3 pasos', () => {
    expect(decidirAviso({ ...base, plataforma: 'ios' })).toBe('ios');
  });
  it('Android: botón si el navegador ofreció instalar; si no, instrucciones del menú ⋮', () => {
    expect(decidirAviso({ ...base, hayPrompt: true })).toBe('boton');
    expect(decidirAviso(base)).toBe('android-menu');
  });
  it('computadora: botón solo si el navegador lo ofrece; si no, nada', () => {
    expect(decidirAviso({ ...base, plataforma: 'otra', hayPrompt: true })).toBe('boton');
    expect(decidirAviso({ ...base, plataforma: 'otra' })).toBe('nada');
  });
});

describe('recordar que se cerró (localStorage con try/catch)', () => {
  it('guarda y lee la marca', () => {
    const datos = new Map<string, string>();
    const storage = { getItem: (k: string) => datos.get(k) ?? null, setItem: (k: string, v: string) => { datos.set(k, v); } };
    expect(leerAvisoCerrado(storage)).toBe(false);
    guardarAvisoCerrado(storage);
    expect(datos.get(CLAVE_AVISO_CERRADO)).toBe('1');
    expect(leerAvisoCerrado(storage)).toBe(true);
  });
  it('si el almacenamiento falla o no existe, no rompe', () => {
    const roto = { getItem: () => { throw new Error('bloqueado'); }, setItem: () => { throw new Error('lleno'); } };
    expect(leerAvisoCerrado(roto)).toBe(false);
    expect(() => guardarAvisoCerrado(roto)).not.toThrow();
    expect(leerAvisoCerrado(null)).toBe(false);
    expect(() => guardarAvisoCerrado(undefined)).not.toThrow();
  });
});
