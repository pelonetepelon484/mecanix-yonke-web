import { textosBannerPromo } from '../../../lib/premiumGratis';

// Banner del inicio del taller con la promoción "Premium gratis al registrarte" (ver
// lib/premiumGratis.js, estadoPromoTaller). Naranja mientras faltan más de 15 días; rojo, con lo
// que pasa al vencer, cuando faltan 15 o menos. Sin promoción vigente no se muestra.
export default function BannerPremiumGratis({ promo }) {
  if (!promo) return null;
  const { titulo, texto } = textosBannerPromo(promo);
  const estilo = promo.porVencer ? porVencerStyle : normalStyle;
  return (
    <div role="status" data-por-vencer={promo.porVencer ? 'si' : 'no'} style={estilo}>
      <p style={{ margin: '0 0 4px', fontWeight: '700', fontSize: '14px' }}>{promo.porVencer ? '⏳' : '⭐'} {titulo}</p>
      <p style={{ margin: 0, fontSize: '13px', lineHeight: 1.5 }}>{texto}</p>
    </div>
  );
}

const base = { textAlign: 'left', borderRadius: '12px', padding: '12px 14px', margin: '0 0 16px' };
const normalStyle = { ...base, backgroundColor: '#FEF3EC', border: '1px solid #F5C9A6', color: '#7A3E06' };
const porVencerStyle = { ...base, backgroundColor: '#FDECEA', border: '1px solid #F2B8B5', color: '#8A2A1A' };
