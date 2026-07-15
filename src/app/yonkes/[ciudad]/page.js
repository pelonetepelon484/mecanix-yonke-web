import { notFound } from 'next/navigation';
import { CIUDADES_BC } from '../../lib/ciudades';
import { getYonkesPorCiudad, getCiudadesConYonkesActivos } from '../../lib/yonkesServerData';
import { formatearHorario, obtenerEstadoAbierto, metodosPagoLabels } from '../../lib/horario';
import { toSafeJsonLdString } from '../../lib/jsonLd';

export async function generateStaticParams() {
  const ciudadesActivas = await getCiudadesConYonkesActivos();
  return ciudadesActivas
    .filter((ciudad) => CIUDADES_BC.some((c) => c.key === ciudad))
    .map((ciudad) => ({ ciudad }));
}

export const dynamicParams = true;
export const revalidate = 3600;

export async function generateMetadata({ params }) {
  const { ciudad } = await params;
  const ciudadInfo = CIUDADES_BC.find((c) => c.key === ciudad);
  if (!ciudadInfo) return {};

  const title = `Yonkes en ${ciudadInfo.label} | Mecanix Yonke Virtual`;
  const description = `Encuentra yonkes y deshuesaderos afiliados en ${ciudadInfo.label}, Baja California. Consulta refacciones usadas, teléfono, horario y contacta directo por WhatsApp.`;
  const url = `/yonkes/${ciudad}`;

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title, description, url,
      siteName: 'Mecanix Yonke Virtual',
      locale: 'es_MX',
      type: 'website',
      images: [{ url: '/mecanix-logo.webp', width: 800, height: 600, alt: title }],
    },
    twitter: { card: 'summary_large_image', title, description, images: ['/mecanix-logo.webp'] },
  };
}

const DIA_SCHEMA = {
  lunes: 'https://schema.org/Monday',
  martes: 'https://schema.org/Tuesday',
  miercoles: 'https://schema.org/Wednesday',
  jueves: 'https://schema.org/Thursday',
  viernes: 'https://schema.org/Friday',
  sabado: 'https://schema.org/Saturday',
  domingo: 'https://schema.org/Sunday',
};

function buildOpeningHoursSpecification(horario) {
  return Object.keys(DIA_SCHEMA)
    .filter((dia) => horario[dia]?.abierto)
    .map((dia) => ({
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: DIA_SCHEMA[dia],
      opens: horario[dia].apertura,
      closes: horario[dia].cierre,
    }));
}

function buildYonkeJsonLd(yonke, ciudadLabel, pageUrl) {
  const entry = {
    '@type': 'AutoPartsStore',
    name: yonke.nombre,
    address: {
      '@type': 'PostalAddress',
      streetAddress: yonke.direccion,
      addressLocality: ciudadLabel,
      addressRegion: 'Baja California',
      addressCountry: 'MX',
    },
    url: pageUrl,
  };

  if (yonke.telefono) {
    entry.telephone = `+52${yonke.telefono.replace(/\D/g, '')}`;
  }

  if (yonke.horario) {
    const spec = buildOpeningHoursSpecification(yonke.horario);
    if (spec.length) entry.openingHoursSpecification = spec;
  }

  if (yonke.calificacion.total > 0) {
    entry.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: yonke.calificacion.promedio,
      reviewCount: yonke.calificacion.total,
    };
  }

  return entry;
}

function YonkeCard({ yonke }) {
  const estado = obtenerEstadoAbierto(yonke.horario);
  const horarioTexto = formatearHorario(yonke.horario);

  return (
    <div style={cardStyle}>
      {yonke.plan === 'premium' && <div style={premiumBadgeStyle}>⭐ Premium</div>}

      <p style={{ fontWeight: '700', color: '#1A3C5E', fontSize: '17px', margin: 0 }}>{yonke.nombre}</p>

      {yonke.calificacion.promedio ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
          <span style={{ color: '#E8720C', fontSize: '14px' }}>
            {'★'.repeat(Math.round(yonke.calificacion.promedio))}{'☆'.repeat(5 - Math.round(yonke.calificacion.promedio))}
          </span>
          <span style={{ color: '#888', fontSize: '12px' }}>
            {yonke.calificacion.promedio} ({yonke.calificacion.total} {yonke.calificacion.total === 1 ? 'opinión' : 'opiniones'})
          </span>
        </div>
      ) : (
        <p style={{ color: '#ccc', fontSize: '12px', marginTop: '4px' }}>Sin calificaciones todavía</p>
      )}

      {estado && (
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: '6px',
          backgroundColor: estado.abierto ? '#E8F5E9' : '#FDECEA',
          color: estado.abierto ? '#2E7D32' : '#C62828',
          fontSize: '12px', fontWeight: '700', padding: '4px 10px',
          borderRadius: '20px', marginTop: '6px', marginBottom: '4px',
        }}>
          <span style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: estado.abierto ? '#2E7D32' : '#C62828', display: 'inline-block' }} />
          {estado.texto}
        </div>
      )}

      <p style={{ color: '#666', fontSize: '14px', margin: '10px 0 4px' }}>📍 {yonke.direccion}</p>
      <p style={{ color: '#666', fontSize: '14px', margin: '4px 0' }}>📞 {yonke.telefono}</p>

      {horarioTexto && (
        <p style={{ color: '#555', fontSize: '13px', margin: '4px 0' }}>🕐 {horarioTexto}</p>
      )}

      {yonke.metodosPago.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '8px', marginBottom: '14px' }}>
          {yonke.metodosPago.map((m) => (
            <span key={m} style={pagoTagStyle}>{metodosPagoLabels[m] || m}</span>
          ))}
        </div>
      )}

      {yonke.whatsapp && (
        <a
          href={`https://wa.me/52${yonke.whatsapp.replace(/\D/g, '')}`}
          target="_blank"
          rel="noopener noreferrer"
          style={whatsappButtonStyle}
        >
          💬 WhatsApp
        </a>
      )}
    </div>
  );
}

export default async function CiudadPage({ params }) {
  const { ciudad } = await params;
  const ciudadInfo = CIUDADES_BC.find((c) => c.key === ciudad);
  if (!ciudadInfo) notFound();

  const yonkes = await getYonkesPorCiudad(ciudad);
  const pageUrl = `https://mecanixyonkevirtual.com/yonkes/${ciudad}`;
  const otrasCiudades = CIUDADES_BC.filter((c) => c.key !== ciudad);

  return (
    <>
      <div style={headerStyle}>
        <div style={{ maxWidth: '620px', margin: '0 auto' }}>
          <a href="/yonkes" style={backLinkStyle}>← Todas las ciudades</a>
          <h1 style={{ color: '#fff', fontSize: '22px', fontWeight: '700', margin: '8px 0 2px' }}>
            Yonkes en {ciudadInfo.label}
          </h1>
          <p style={{ color: '#C5D4E8', fontSize: '13px', margin: 0 }}>
            {yonkes.length} {yonkes.length === 1 ? 'yonke afiliado' : 'yonkes afiliados'}
          </p>
        </div>
      </div>

      <main style={mainStyle}>
        <div style={{ maxWidth: '620px', margin: '0 auto' }}>

          <div style={introCardStyle}>
            <h2 style={{ fontSize: '16px', fontWeight: '700', color: '#1A3C5E', marginBottom: '10px' }}>
              Refacciones usadas en {ciudadInfo.label}
            </h2>
            {yonkes.length > 0 ? (
              <p style={{ fontSize: '13px', color: '#666', lineHeight: '1.8', margin: 0 }}>
                Consulta los <strong>yonkes registrados</strong> en {ciudadInfo.label} y encuentra autopartes usadas
                como motores, transmisiones, puertas, faroles y más. Contacta directo por WhatsApp o busca tu pieza
                por marca, modelo y año en Mecanix Yonke Virtual.
              </p>
            ) : (
              <p style={{ fontSize: '13px', color: '#666', lineHeight: '1.8', margin: 0 }}>
                Aún no hay yonkes afiliados en {ciudadInfo.label}. ¿Tienes un yonke aquí?{' '}
                <strong style={{ color: '#E8720C' }}>Regístrate.</strong>
              </p>
            )}
          </div>

          {yonkes.map((y) => (
            <YonkeCard key={y.id} yonke={y} />
          ))}

          {yonkes.length === 0 && (
            <div style={introCardStyle}>
              <p style={{ fontSize: '13px', fontWeight: '700', color: '#1A3C5E', marginBottom: '10px' }}>
                Otras ciudades con yonkes registrados
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {otrasCiudades.map((c) => (
                  <a key={c.key} href={`/yonkes/${c.key}`} style={ciudadTagStyle}>{c.label}</a>
                ))}
              </div>
            </div>
          )}

          <div style={ctaRowStyle}>
            {yonkes.length === 0 ? (
              <>
                <a href="/panel/registro" className="mecanix-btn-primary" style={ctaLinkStyle}>🆓 Registra tu yonke</a>
                <a href="/" className="mecanix-btn-secondary" style={ctaLinkStyle}>🔍 Buscar piezas</a>
              </>
            ) : (
              <>
                <a href="/" className="mecanix-btn-primary" style={ctaLinkStyle}>🔍 Buscar piezas</a>
                <a href="/panel/registro" className="mecanix-btn-secondary" style={ctaLinkStyle}>🆓 Registra tu yonke</a>
              </>
            )}
          </div>

        </div>
      </main>

      {yonkes.length > 0 && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: toSafeJsonLdString({
              '@context': 'https://schema.org',
              '@graph': yonkes.map((y) => buildYonkeJsonLd(y, ciudadInfo.label, pageUrl)),
            }),
          }}
        />
      )}
    </>
  );
}

const headerStyle = { backgroundColor: '#1A3C5E', padding: '20px 16px', paddingTop: '24px', position: 'sticky', top: 0, zIndex: 10 };
const backLinkStyle = { color: '#fff', opacity: 0.8, fontSize: '13px', textDecoration: 'none' };
const mainStyle = { minHeight: '100vh', backgroundColor: '#F4F5F5', padding: '24px 16px', fontFamily: "'Inter', sans-serif" };
const introCardStyle = { backgroundColor: '#fff', borderRadius: '20px', padding: '24px 28px', boxShadow: '0 4px 16px rgba(26,60,94,0.07)', marginBottom: '16px' };
const cardStyle = { backgroundColor: '#fff', borderRadius: '16px', padding: '20px', marginBottom: '14px', boxShadow: '0 4px 16px rgba(26,60,94,0.08)', position: 'relative' };
const premiumBadgeStyle = { position: 'absolute', top: '14px', right: '14px', backgroundColor: '#FAEEDA', color: '#854F0B', fontSize: '11px', fontWeight: '700', padding: '4px 10px', borderRadius: '20px' };
const pagoTagStyle = { backgroundColor: '#F0F4F8', color: '#1A3C5E', fontSize: '12px', padding: '4px 10px', borderRadius: '20px', fontWeight: '600' };
const whatsappButtonStyle = { display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '12px 16px', borderRadius: '50px', backgroundColor: '#25D366', color: '#fff', fontWeight: '700', fontSize: '13px', textDecoration: 'none', width: 'fit-content' };
const ciudadTagStyle = { backgroundColor: '#F0F4F8', color: '#1A3C5E', fontSize: '13px', fontWeight: '600', padding: '8px 14px', borderRadius: '20px', textDecoration: 'none' };
const ctaRowStyle = { display: 'flex', gap: '12px', marginTop: '8px' };
const ctaLinkStyle = { display: 'block', textAlign: 'center', textDecoration: 'none', flex: 1 };
