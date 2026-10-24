import { ImageResponse } from 'next/og';
import { CACHE_VISTA_PREVIA_SEGUNDOS, colorTextoSobre } from '../../lib/vistaPreviaYonke';

// Imagen de 1200 × 630 (PNG) para la vista previa al compartir el subdominio de un yonke. Solo
// recibe datos ya listos (sin Firestore ni red): el logo del yonke y los de Mecanix llegan como
// data URI, y la tipografía Inter (normal y seminegrita) en recursos.fuentes. Inter en lugar de la
// que trae next/og porque esa deja algunos espacios entre palabras más anchos que otros.

export const ANCHO = 1200;
export const ALTO = 630;
const ENCABEZADOS = { 'Cache-Control': `public, max-age=${CACHE_VISTA_PREVIA_SEGUNDOS}, s-maxage=${CACHE_VISTA_PREVIA_SEGUNDOS}` };
const opciones = (recursos) => ({ width: ANCHO, height: ALTO, headers: ENCABEZADOS, ...(recursos.fuentes ? { fonts: recursos.fuentes } : {}) });
const FAMILIA = 'Inter, sans-serif';

// "Con tecnología" + logo de Mecanix solo, chico, dentro de una pastilla blanca: así se ve igual
// sobre cualquier color del yonke (el logo es azul y naranja).
function Credito({ logoMecanix }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, backgroundColor: '#FFFFFF', borderRadius: 999, padding: '10px 22px' }}>
      <span style={{ fontSize: 22, color: '#666666' }}>Con tecnología</span>
      <img src={logoMecanix} width={130} height={32} style={{ objectFit: 'contain' }} alt="" />
    </div>
  );
}

// datos: { nombre, lugar, colorPrimario, logo (data URI o null) }; recursos: { solo, fuentes }
export function imagenDeYonke({ nombre, lugar, colorPrimario, logo }, recursos) {
  const fondo = /^#[0-9a-fA-F]{6}$/.test(colorPrimario || '') ? colorPrimario : '#1A3C5E';
  const texto = colorTextoSobre(fondo);
  // Sin logo, el nombre va dentro de la tarjeta blanca, en el color del yonke si contrasta con el
  // blanco (si no, oscuro). Nunca el logo de Mecanix como si fuera del yonke.
  const colorNombreEnTarjeta = colorTextoSobre(fondo) === '#FFFFFF' ? fondo : '#1A1A1A';
  const tamanoNombre = nombre.length > 30 ? 46 : nombre.length > 18 ? 56 : 68;
  return new ImageResponse(
    (
      <div style={{ width: ANCHO, height: ALTO, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: fondo, padding: '40px 60px', fontFamily: FAMILIA }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF', borderRadius: 36, padding: logo ? '28px 44px' : '40px 56px', maxWidth: 1000, boxShadow: '0 10px 30px rgba(0,0,0,0.18)' }}>
          {logo ? (
            <img src={logo} width={460} height={250} style={{ objectFit: 'contain' }} alt="" />
          ) : (
            <span style={{ fontSize: tamanoNombre + 8, fontWeight: 600, color: colorNombreEnTarjeta, textAlign: 'center', lineHeight: 1.15 }}>{nombre}</span>
          )}
        </div>
        {logo && (
          <span style={{ marginTop: 30, fontSize: tamanoNombre, fontWeight: 600, color: texto, textAlign: 'center', lineHeight: 1.15, maxWidth: 1060 }}>{nombre}</span>
        )}
        {lugar && (
          <span style={{ marginTop: logo ? 8 : 30, fontSize: 32, color: texto, opacity: 0.9 }}>{`Autopartes usadas en ${lugar}`}</span>
        )}
        <div style={{ display: 'flex', marginTop: 34 }}>
          <Credito logoMecanix={recursos.solo} />
        </div>
      </div>
    ),
    opciones(recursos),
  );
}

// Imagen genérica de Mecanix (subdominio inválido, apagado, inexistente o que ya no califica), con
// el estilo de la de la portada (imagenPortada.js): fondo claro, logo nuevo grande, la frase y una
// franja azul con la dirección del sitio. recursos: { nuevo, fuentes }
export const FRASE_GENERICA = 'Refacciones y autopartes usadas en México';
const AZUL = '#1A3C5E';
// logo-mecanix-red-yonkes mide 900 × 318: a 780 de ancho conserva su proporción.
const NUEVO_ANCHO = 780;
const NUEVO_ALTO = Math.round((NUEVO_ANCHO * 318) / 900);
export function imagenGenerica(recursos) {
  return new ImageResponse(
    (
      <div style={{ width: ANCHO, height: ALTO, display: 'flex', flexDirection: 'column', backgroundColor: '#F4F5F5', fontFamily: FAMILIA }}>
        <div style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <img src={recursos.nuevo} width={NUEVO_ANCHO} height={NUEVO_ALTO} style={{ objectFit: 'contain' }} alt="" />
          <span style={{ marginTop: 30, fontSize: 40, fontWeight: 600, color: AZUL }}>{FRASE_GENERICA}</span>
        </div>
        <div style={{ height: 96, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: AZUL }}>
          <span style={{ fontSize: 36, color: '#FFFFFF' }}>www.mecanixyonkevirtual.com</span>
        </div>
      </div>
    ),
    opciones(recursos),
  );
}
