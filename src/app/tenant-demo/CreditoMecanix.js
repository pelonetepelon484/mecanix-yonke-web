// Crédito "Con tecnología [logo de Mecanix]" del pie de la página de un yonke (subdominio). Nunca
// debe competir con el contenido del yonke: chico y gris. Siempre el logo NUEVO a color
// (logo-mecanix-solo, con engrane). Con fondo claro, el logo directo (como siempre); con fondo
// oscuro (colorFondo lo elige cada yonke), el mismo logo dentro de una pastilla blanca chica para
// que se lea, igual que el crédito de la imagen de vista previa (imagenVistaPrevia.js).

// Luminancia percibida simplificada (no necesita precisión WCAG, solo decidir si el fondo es oscuro).
export function esColorOscuro(hex) {
  if (!hex || typeof hex !== 'string') return false;
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  if (h.length !== 6) return false;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  if ([r, g, b].some(Number.isNaN)) return false;
  const luminancia = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminancia < 0.5;
}

const enlaceStyle = {
  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px',
  color: '#999', fontSize: '12px', textDecoration: 'none', marginTop: '10px',
};
const logoStyle = { height: '17px', width: 'auto', verticalAlign: 'middle' };
const pastillaStyle = {
  display: 'inline-flex', alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: '999px', padding: '2px 7px',
};
const logoEnPastillaStyle = { height: '13px', width: 'auto', display: 'block' };

export default function CreditoMecanix({ colorFondo }) {
  const oscuro = esColorOscuro(colorFondo);
  return (
    <a href="https://mecanixyonkevirtual.com" target="_blank" rel="noopener noreferrer" style={enlaceStyle}>
      Con tecnología
      {oscuro ? (
        <span data-testid="pastilla-mecanix" style={pastillaStyle}>
          <img src="/logo-mecanix-solo.webp" alt="Mecanix" style={logoEnPastillaStyle} />
        </span>
      ) : (
        <img src="/logo-mecanix-solo.webp" alt="Mecanix" style={logoStyle} />
      )}
    </a>
  );
}
