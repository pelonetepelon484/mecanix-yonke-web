import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { ImageResponse } from 'next/og';
import { ALTO, ANCHO } from './imagenVistaPrevia';

// Imagen de vista previa de la portada (1200 × 630, PNG), mismo patrón que la de los subdominios
// (imagenVistaPrevia.js): logo nuevo (logo-mecanix-red-yonkes.png) centrado y grande, la frase
// (FRASE_PORTADA) debajo y una franja azul con la dirección del sitio. Tipografía Inter (src/assets/fuentes/).
// Solo lee el logo nuevo y las fuentes: nada de los logos viejos.

const AZUL = '#1A3C5E';
const FAMILIA = 'Inter, sans-serif';
// El logo mide 900 × 318: a 780 de ancho conserva su proporción.
const LOGO_ANCHO = 780;
const LOGO_ALTO = Math.round((LOGO_ANCHO * 318) / 900);
// Frase debajo del logo. No cabe en una línea: va en dos, centradas, partida después de la coma
// para que las dos líneas queden parejas (y dentro de 1000 px, por si se cambia la frase).
export const FRASE_PORTADA = 'Encuentra la refacción que necesitas, directo con el yonke que la tiene';
export const lineasFrase = (frase) => {
  const i = frase.indexOf(', ');
  return i === -1 ? [frase] : [frase.slice(0, i + 1), frase.slice(i + 2)];
};

export async function leerRecursosPortada(raiz = process.cwd()) {
  const [logo, regular, seminegrita] = await Promise.all([
    readFile(path.join(raiz, 'public', 'logo-mecanix-red-yonkes.png')),
    readFile(path.join(raiz, 'src', 'assets', 'fuentes', 'inter-regular.ttf')),
    readFile(path.join(raiz, 'src', 'assets', 'fuentes', 'inter-semibold.ttf')),
  ]);
  return {
    logo: `data:image/png;base64,${logo.toString('base64')}`,
    fuentes: [
      { name: 'Inter', data: regular, weight: 400, style: 'normal' },
      { name: 'Inter', data: seminegrita, weight: 600, style: 'normal' },
    ],
  };
}

export function imagenPortada(recursos) {
  return new ImageResponse(
    (
      <div style={{ width: ANCHO, height: ALTO, display: 'flex', flexDirection: 'column', backgroundColor: '#F4F5F5', fontFamily: FAMILIA }}>
        <div style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <img src={recursos.logo} width={LOGO_ANCHO} height={LOGO_ALTO} style={{ objectFit: 'contain' }} alt="" />
          <div style={{ marginTop: 26, maxWidth: 1000, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', fontSize: 38, lineHeight: 1.25, fontWeight: 600, color: AZUL }}>
            {lineasFrase(FRASE_PORTADA).map((linea) => <span key={linea}>{linea}</span>)}
          </div>
        </div>
        <div style={{ height: 96, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: AZUL }}>
          <span style={{ fontSize: 36, color: '#FFFFFF' }}>www.mecanixyonkevirtual.com</span>
        </div>
      </div>
    ),
    { width: ANCHO, height: ALTO, fonts: recursos.fuentes },
  );
}
