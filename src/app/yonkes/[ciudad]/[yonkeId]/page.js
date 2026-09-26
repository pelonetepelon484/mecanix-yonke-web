import { cache } from 'react';
import { notFound } from 'next/navigation';
import { CIUDADES_BC } from '../../../lib/ciudades';
import { getYonkeById } from '../../../lib/yonkesServerData';
import { obtenerEstadosCombinado } from '../../../lib/busqueda/estadosServer';
import { formatearHorario, obtenerEstadoAbierto, metodosPagoLabels } from '../../../lib/horario';
import { toSafeJsonLdString } from '../../../lib/jsonLd';
import { buildYonkeJsonLd } from '../../../lib/yonkeJsonLd';
import YonkeActividadBadge from '../../../lib/YonkeActividadBadge';

export const revalidate = 3600;

// cache(): dedupea entre generateMetadata() y la página — mismo patrón que Home()/resolveDemo().
const resolveYonke = cache(async function resolveYonke(ciudad, yonkeId) {
  const ciudadInfo = CIUDADES_BC.find((c) => c.key === ciudad);
  if (!ciudadInfo) return null;
  const yonke = await getYonkeById(yonkeId, ciudad);
  if (!yonke) return null;
  const estados = await obtenerEstadosCombinado();
  const estadoLabel = estados.find((e) => e.id === yonke.estado)?.nombre || 'Baja California';
  return { ciudadInfo, yonke, estadoLabel };
});

export async function generateMetadata({ params }) {
  const { ciudad, yonkeId } = await params;
  const resuelto = await resolveYonke(ciudad, yonkeId);
  if (!resuelto) return {};
  const { ciudadInfo, yonke, estadoLabel } = resuelto;

  // titleBase (sin sufijo) es lo que se manda como `title` de la página — el layout raíz ya le
  // agrega " | Mecanix Yonke Virtual" vía el template; openGraph/twitter no pasan por ese
  // template, así que ahí sí se manda el título completo.
  const titleBase = `${yonke.nombre} – Yonke en ${ciudadInfo.label}, ${estadoLabel}`;
  const title = `${titleBase} | Mecanix Yonke Virtual`;
  const description = `${yonke.nombre} es un yonke afiliado en ${ciudadInfo.label}, ${estadoLabel}. Consulta dirección, teléfono, horario y contacta directo por WhatsApp para tu refacción usada.`;
  const url = `/yonkes/${ciudad}/${yonkeId}`;

  return {
    title: titleBase,
    description,
    alternates: { canonical: url },
    openGraph: {
      title, description, url,
      siteName: 'Mecanix Yonke Virtual',
      locale: 'es_MX',
      type: 'website',
      images: [{ url: yonke.logoUrl || '/mecanix-logo.webp', width: 800, height: 600, alt: yonke.nombre }],
    },
    twitter: {
      card: 'summary_large_image', title, description,
      images: [yonke.logoUrl || '/mecanix-logo.webp'],
    },
  };
}

export default async function YonkeDetallePage({ params }) {
  const { ciudad, yonkeId } = await params;
  const resuelto = await resolveYonke(ciudad, yonkeId);
  if (!resuelto) notFound();
  const { ciudadInfo, yonke, estadoLabel } = resuelto;

  const pageUrl = `https://mecanixyonkevirtual.com/yonkes/${ciudad}/${yonkeId}`;
  const estadoAbierto = obtenerEstadoAbierto(yonke.horario);
  const horarioTexto = formatearHorario(yonke.horario);

  return (
    <>
      <div style={headerStyle}>
        <div style={{ maxWidth: '620px', margin: '0 auto' }}>
          <a href={`/yonkes/${ciudad}`} style={backLinkStyle}>← Yonkes en {ciudadInfo.label}</a>
          <h1 style={{ color: '#fff', fontSize: '22px', fontWeight: '700', margin: '8px 0 2px' }}>
            {yonke.nombre}
          </h1>
          <p style={{ color: '#C5D4E8', fontSize: '13px', margin: 0 }}>
            Yonke en {ciudadInfo.label}, {estadoLabel}
          </p>
        </div>
      </div>

      <main style={mainStyle}>
        <div style={{ maxWidth: '620px', margin: '0 auto' }}>
          <div style={cardStyle}>
            {yonke.plan === 'premium' && <div style={premiumBadgeStyle}>⭐ Premium</div>}
            {yonke.verificado && <p style={verificadoStyle}>✅ Yonke verificado</p>}
            {yonke.ultimaActividadAt !== null && (
              <div style={{ marginBottom: '8px' }}><YonkeActividadBadge ultimaActividadAt={yonke.ultimaActividadAt} /></div>
            )}

            {yonke.calificacion.promedio ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
                <span style={{ color: '#E8720C', fontSize: '16px' }}>
                  {'★'.repeat(Math.round(yonke.calificacion.promedio))}{'☆'.repeat(5 - Math.round(yonke.calificacion.promedio))}
                </span>
                <span style={{ color: '#888', fontSize: '13px' }}>
                  {yonke.calificacion.promedio} ({yonke.calificacion.total} {yonke.calificacion.total === 1 ? 'opinión' : 'opiniones'})
                </span>
              </div>
            ) : (
              <p style={{ color: '#ccc', fontSize: '13px', marginTop: '4px' }}>Sin calificaciones todavía</p>
            )}

            {estadoAbierto && (
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: '6px',
                backgroundColor: estadoAbierto.abierto ? '#E8F5E9' : '#FDECEA',
                color: estadoAbierto.abierto ? '#2E7D32' : '#C62828',
                fontSize: '13px', fontWeight: '700', padding: '5px 12px',
                borderRadius: '20px', marginTop: '10px', marginBottom: '4px',
              }}>
                <span style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: estadoAbierto.abierto ? '#2E7D32' : '#C62828', display: 'inline-block' }} />
                {estadoAbierto.texto}
              </div>
            )}

            <p style={{ color: '#666', fontSize: '15px', margin: '14px 0 6px' }}>📍 {yonke.direccion}</p>
            <p style={{ color: '#666', fontSize: '15px', margin: '6px 0' }}>📞 {yonke.telefono}</p>

            {horarioTexto && (
              <p style={{ color: '#555', fontSize: '14px', margin: '6px 0' }}>🕐 {horarioTexto}</p>
            )}

            {yonke.metodosPago.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '12px', marginBottom: '18px' }}>
                {yonke.metodosPago.map((m) => (
                  <span key={m} style={pagoTagStyle}>{metodosPagoLabels[m] || m}</span>
                ))}
              </div>
            )}

            {yonke.whatsapp && (
              <a
                href={`https://wa.me/52${yonke.whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(`Hola, vi ${yonke.nombre} en Mecanix Yonke Virtual. ¿Me pueden ayudar con una pieza?`)}`}
                target="_blank"
                rel="noopener noreferrer"
                style={whatsappButtonStyle}
              >
                💬 Contactar por WhatsApp
              </a>
            )}
          </div>

          <div style={ctaRowStyle}>
            <a href="/" className="mecanix-btn-primary" style={ctaLinkStyle}>🔍 Buscar piezas</a>
            <a href={`/yonkes/${ciudad}`} className="mecanix-btn-secondary" style={ctaLinkStyle}>Ver más yonkes en {ciudadInfo.label}</a>
          </div>
        </div>
      </main>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: toSafeJsonLdString({
            '@context': 'https://schema.org',
            ...buildYonkeJsonLd(yonke, ciudadInfo.label, pageUrl),
          }),
        }}
      />
    </>
  );
}

const headerStyle = { backgroundColor: '#1A3C5E', padding: '20px 16px', paddingTop: '24px', position: 'sticky', top: 0, zIndex: 10 };
const backLinkStyle = { color: '#fff', opacity: 0.8, fontSize: '13px', textDecoration: 'none' };
const mainStyle = { minHeight: '100vh', backgroundColor: '#F4F5F5', padding: '24px 16px', fontFamily: "'Inter', sans-serif" };
const cardStyle = { backgroundColor: '#fff', borderRadius: '20px', padding: '24px', marginBottom: '16px', boxShadow: '0 4px 16px rgba(26,60,94,0.08)', position: 'relative' };
const premiumBadgeStyle = { position: 'absolute', top: '18px', right: '18px', backgroundColor: '#FAEEDA', color: '#854F0B', fontSize: '11px', fontWeight: '700', padding: '4px 10px', borderRadius: '20px' };
const verificadoStyle = { color: '#2E7D32', fontSize: '13px', fontWeight: '700', margin: '0 0 8px' };
const pagoTagStyle = { backgroundColor: '#F0F4F8', color: '#1A3C5E', fontSize: '12px', padding: '4px 10px', borderRadius: '20px', fontWeight: '600' };
const whatsappButtonStyle = { display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '14px 16px', borderRadius: '50px', backgroundColor: '#25D366', color: '#fff', fontWeight: '700', fontSize: '14px', textDecoration: 'none', width: 'fit-content' };
const ctaRowStyle = { display: 'flex', gap: '12px', marginTop: '8px' };
const ctaLinkStyle = { display: 'block', textAlign: 'center', textDecoration: 'none', flex: 1 };
