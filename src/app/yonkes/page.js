import { CIUDADES_BC } from '../lib/ciudades';
import { getConteoYonkesPorCiudad } from '../lib/yonkesServerData';

export const revalidate = 3600;

export const metadata = {
  title: 'Yonkes registrados en Baja California | Mecanix Yonke Virtual',
  description: 'Consulta la lista de yonkes y deshuesaderos afiliados a Mecanix Yonke Virtual en Tijuana, Mexicali, Ensenada, Tecate, Playas de Rosarito y San Quintín.',
  alternates: { canonical: '/yonkes' },
  openGraph: {
    title: 'Yonkes registrados en Baja California | Mecanix Yonke Virtual',
    description: 'Consulta la lista de yonkes y deshuesaderos afiliados a Mecanix Yonke Virtual en Baja California.',
    url: '/yonkes',
    siteName: 'Mecanix Yonke Virtual',
    locale: 'es_MX',
    type: 'website',
    images: [{ url: '/mecanix-logo.webp', width: 800, height: 600, alt: 'Yonkes registrados en Baja California' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Yonkes registrados en Baja California | Mecanix Yonke Virtual',
    images: ['/mecanix-logo.webp'],
  },
};

export default async function YonkesIndexPage() {
  const conteo = await getConteoYonkesPorCiudad();

  return (
    <>
      <div style={headerStyle}>
        <div style={{ maxWidth: '620px', margin: '0 auto' }}>
          <h1 style={{ color: '#fff', fontSize: '22px', fontWeight: '700', margin: 0 }}>
            Yonkes registrados en Baja California
          </h1>
          <p style={{ color: '#C5D4E8', fontSize: '13px', margin: '6px 0 0' }}>
            Elige tu ciudad para ver los yonkes afiliados y sus refacciones usadas
          </p>
        </div>
      </div>

      <main style={mainStyle}>
        <div style={{ maxWidth: '620px', margin: '0 auto' }}>

          <div style={gridStyle}>
            {CIUDADES_BC.map((c) => (
              <a key={c.key} href={`/yonkes/${c.key}`} style={ciudadCardStyle}>
                <p style={{ fontWeight: '700', color: '#1A3C5E', fontSize: '16px', margin: 0 }}>{c.label}</p>
                <p style={{ fontSize: '13px', margin: '4px 0 0' }}>
                  {conteo[c.key] > 0
                    ? <span style={{ color: '#888' }}>{conteo[c.key]} {conteo[c.key] === 1 ? 'yonke afiliado' : 'yonkes afiliados'}</span>
                    : <span style={{ color: '#E8720C', fontWeight: '600' }}>Sé el primero en tu ciudad</span>}
                </p>
              </a>
            ))}
          </div>

          <div style={ctaRowStyle}>
            <a href="/" className="mecanix-btn-primary" style={ctaLinkStyle}>🔍 Buscar piezas</a>
            <a href="/panel/registro" className="mecanix-btn-secondary" style={ctaLinkStyle}>🆓 Registra tu yonke</a>
          </div>

        </div>
      </main>
    </>
  );
}

const headerStyle = { backgroundColor: '#1A3C5E', padding: '20px 16px', paddingTop: '24px', position: 'sticky', top: 0, zIndex: 10 };
const mainStyle = { minHeight: '100vh', backgroundColor: '#F4F5F5', padding: '24px 16px', fontFamily: "'Inter', sans-serif" };
const gridStyle = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' };
const ciudadCardStyle = { backgroundColor: '#fff', borderRadius: '16px', padding: '18px', boxShadow: '0 4px 16px rgba(26,60,94,0.08)', textDecoration: 'none', display: 'block' };
const ctaRowStyle = { display: 'flex', gap: '12px', marginTop: '8px' };
const ctaLinkStyle = { display: 'block', textAlign: 'center', textDecoration: 'none', flex: 1 };
