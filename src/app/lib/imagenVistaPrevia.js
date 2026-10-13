import { ImageResponse } from 'next/og';
import { CACHE_VISTA_PREVIA_SEGUNDOS, colorTextoSobre } from '../../lib/vistaPreviaYonke';

// Imagen de 1200 × 630 (PNG) para la vista previa al compartir el subdominio de un yonke. Solo
// recibe datos ya listos (sin Firestore ni red): el logo del yonke y los de Mecanix llegan como
// data URI. La tipografía es la que trae next/og (Geist, solo peso normal).

export const ANCHO = 1200;
export const ALTO = 630;
const ENCABEZADOS = { 'Cache-Control': `public, max-age=${CACHE_VISTA_PREVIA_SEGUNDOS}, s-maxage=${CACHE_VISTA_PREVIA_SEGUNDOS}` };

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

// datos: { nombre, lugar, colorPrimario, logo (data URI o null) }; logos: { solo }
export function imagenDeYonke({ nombre, lugar, colorPrimario, logo }, logos) {
  const fondo = /^#[0-9a-fA-F]{6}$/.test(colorPrimario || '') ? colorPrimario : '#1A3C5E';
  const texto = colorTextoSobre(fondo);
  // Sin logo, el nombre va dentro de la tarjeta blanca, en el color del yonke si contrasta con el
  // blanco (si no, oscuro). Nunca el logo de Mecanix como si fuera del yonke.
  const colorNombreEnTarjeta = colorTextoSobre(fondo) === '#FFFFFF' ? fondo : '#1A1A1A';
  const tamanoNombre = nombre.length > 30 ? 46 : nombre.length > 18 ? 56 : 68;
  return new ImageResponse(
    (
      <div style={{ width: ANCHO, height: ALTO, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: fondo, padding: '40px 60px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF', borderRadius: 36, padding: logo ? '28px 44px' : '40px 56px', maxWidth: 1000, boxShadow: '0 10px 30px rgba(0,0,0,0.18)' }}>
          {logo ? (
            <img src={logo} width={460} height={250} style={{ objectFit: 'contain' }} alt="" />
          ) : (
            <span style={{ fontSize: tamanoNombre + 8, color: colorNombreEnTarjeta, textAlign: 'center', lineHeight: 1.15 }}>{nombre}</span>
          )}
        </div>
        {logo && (
          <span style={{ marginTop: 30, fontSize: tamanoNombre, color: texto, textAlign: 'center', lineHeight: 1.15, maxWidth: 1060 }}>{nombre}</span>
        )}
        {lugar && (
          <span style={{ marginTop: logo ? 8 : 30, fontSize: 32, color: texto, opacity: 0.9 }}>{`Autopartes usadas en ${lugar}`}</span>
        )}
        <div style={{ display: 'flex', marginTop: 34 }}>
          <Credito logoMecanix={logos.solo} />
        </div>
      </div>
    ),
    { width: ANCHO, height: ALTO, headers: ENCABEZADOS },
  );
}

// Imagen genérica de Mecanix (subdominio inválido, apagado, inexistente o que ya no califica).
// logos: { blanco }
export function imagenGenerica(logos) {
  return new ImageResponse(
    (
      <div style={{ width: ANCHO, height: ALTO, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: '#1A3C5E' }}>
        <img src={logos.blanco} width={720} height={200} style={{ objectFit: 'contain' }} alt="" />
        <span style={{ marginTop: 36, fontSize: 38, color: '#FFFFFF' }}>Refacciones y autopartes usadas en México</span>
      </div>
    ),
    { width: ANCHO, height: ALTO, headers: ENCABEZADOS },
  );
}
