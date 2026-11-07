// Tarjeta de la portada (pestaña "Busco una pieza") que lleva a /comparador. Solo con
// config/comparador.habilitado (la lee page.js en el servidor).
import Link from 'next/link';
import { TEXTO_BOTON_COMPARADOR } from '../../lib/comparadorPiezas';

export default function TarjetaComparador() {
  return (
    <Link href="/comparador" style={tarjeta}>
      <span aria-hidden="true" style={{ fontSize: '22px', lineHeight: 1 }}>🔎</span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: '15px', fontWeight: '800', color: '#fff' }}>{TEXTO_BOTON_COMPARADOR}</span>
        <span style={{ display: 'block', fontSize: '12px', color: '#B8C7D6', marginTop: '2px' }}>¿Esta pieza le queda a mi vehículo? Compara el VIN o el número de parte.</span>
      </span>
      <span aria-hidden="true" style={{ color: '#E8720C', fontWeight: '800', fontSize: '18px' }}>→</span>
    </Link>
  );
}

const tarjeta = {
  display: 'flex', alignItems: 'center', gap: '12px', maxWidth: '440px', margin: '0 auto 18px', padding: '12px 14px', borderRadius: '14px',
  backgroundColor: '#12233A', border: '1px solid #22405F', textDecoration: 'none', boxShadow: '0 4px 14px rgba(26,60,94,0.18)',
};
