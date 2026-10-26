// "Ecosistema de soluciones automotrices" de la portada (pestaña "Busco una pieza", al final, después
// del bloque SEO), solo con config/portada.ecosistema (se lee en el servidor, page.js): texto real en
// el HTML inicial. Sin estado, sin lecturas, sin formularios, sin enlaces ni botones. Mismo patrón
// visual que "¿Cómo funciona?" (ComoFuncionaBuscador.js): caja blanca y renglones con emoji, título
// y descripción. Las de "Próximamente" van más tenues y con su etiqueta.

export const TITULO_ECOSISTEMA = 'Ecosistema de soluciones automotrices';
export const ENTRADA_ECOSISTEMA = 'Mecanix conecta yonkes, talleres y más soluciones automotrices en un solo lugar.';
export const ETIQUETA_PROXIMAMENTE = 'Próximamente';

export const TARJETAS_ACTIVAS = [
  { emoji: '🚙', titulo: 'Yonkes', desc: 'Autopartes usadas.' },
  { emoji: '🔧', titulo: 'Talleres y servicios', desc: 'Cotizaciones, pedido de piezas y órdenes de servicio para talleres.' },
];
export const TARJETAS_PROXIMAMENTE = [
  { emoji: '📦', titulo: 'Refacciones nuevas', desc: 'Piezas nuevas de refaccionarias.' },
  { emoji: '🛠️', titulo: 'Especialistas', desc: 'Más especialidades automotrices.' },
  { emoji: '✨', titulo: 'Servicios futuros', desc: 'Nuevas soluciones para el sector automotriz.' },
];

function Tarjeta({ emoji, titulo, desc, proximamente = false }) {
  return (
    <li style={proximamente ? tarjetaProxima : tarjeta}>
      <span style={{ fontSize: '22px', lineHeight: 1, opacity: proximamente ? 0.55 : 1 }} aria-hidden="true">{emoji}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <h3 style={proximamente ? { ...tituloTarjeta, color: '#6B7F93' } : tituloTarjeta}>{titulo}</h3>
        <p style={proximamente ? { ...descTarjeta, color: '#A0A8B0' } : descTarjeta}>{desc}</p>
      </div>
      {proximamente && <span style={etiquetaProximamente}>{ETIQUETA_PROXIMAMENTE}</span>}
    </li>
  );
}

export default function EcosistemaMecanix() {
  return (
    <section style={caja} aria-labelledby="ecosistema-mecanix">
      <h2 id="ecosistema-mecanix" style={titulo}>{TITULO_ECOSISTEMA}</h2>
      <p style={entrada}>{ENTRADA_ECOSISTEMA}</p>
      <ul style={lista}>
        {TARJETAS_ACTIVAS.map((t) => <Tarjeta key={t.titulo} {...t} />)}
        {TARJETAS_PROXIMAMENTE.map((t) => <Tarjeta key={t.titulo} {...t} proximamente />)}
      </ul>
    </section>
  );
}

// Mismos valores que ComoFuncionaBuscador (caja, renglón, título y descripción) y que la pastilla
// pagoTagStyle de HomeClient para "Próximamente". Una columna: se ve igual en celular.
const caja = { backgroundColor: '#fff', borderRadius: '20px', padding: '24px 20px', boxShadow: '0 4px 16px rgba(26,60,94,0.07)', marginBottom: '12px' };
const titulo = { fontSize: '16px', color: '#1A3C5E', fontWeight: '700', margin: '0 0 8px', textAlign: 'center' };
const entrada = { fontSize: '13px', color: '#666', lineHeight: '1.6', margin: '0 auto 16px', maxWidth: '420px', textAlign: 'center' };
const lista = { listStyle: 'none', margin: '0 auto', padding: 0, maxWidth: '420px', display: 'grid', gap: '10px' };
const tarjeta = { display: 'flex', alignItems: 'center', gap: '12px', backgroundColor: '#F5F8FB', border: '1px solid #E3EAF2', borderRadius: '14px', padding: '10px 14px', textAlign: 'left' };
const tarjetaProxima = { ...tarjeta, backgroundColor: '#F4F5F5', border: '1px dashed #E3EAF2' };
const tituloTarjeta = { fontSize: '13px', fontWeight: '700', color: '#1A3C5E', margin: 0 };
const descTarjeta = { fontSize: '11px', color: '#888', margin: '2px 0 0', lineHeight: '1.4' };
const etiquetaProximamente = { backgroundColor: '#F0F4F8', color: '#1A3C5E', fontSize: '12px', padding: '4px 10px', borderRadius: '20px', fontWeight: '600', whiteSpace: 'nowrap', flexShrink: 0 };
