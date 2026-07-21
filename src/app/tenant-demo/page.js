import { cache } from 'react';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { getTenantBySub, getInventarioDeTenant, resolveBranding } from '../lib/getTenant';

export const dynamic = 'force-dynamic';

const resolveDemo = cache(async function resolveDemo() {
  const sub = (await headers()).get('x-tenant-sub') || '';
  const tenant = await getTenantBySub(sub);
  if (!tenant) return null;
  const branding = resolveBranding(tenant);
  const inventario = await getInventarioDeTenant(tenant.id);
  return { tenant, branding, inventario };
});

export async function generateMetadata() {
  const demo = await resolveDemo();
  if (!demo) return {};
  return {
    title: `${demo.branding.nombre} — Vista previa Mecanix Yonke Virtual`,
    robots: { index: false, follow: false },
  };
}

export default async function TenantDemoPage() {
  const demo = await resolveDemo();
  if (!demo) notFound();

  const { tenant, branding, inventario } = demo;
  const items = [
    ...inventario.vehiculos.map((v) => ({ ...v, _categoria: 'vehiculo' })),
    ...inventario.motores.map((m) => ({ ...m, _categoria: 'motor' })),
  ];

  function whatsappHref(item) {
    if (!tenant.whatsapp) return null;
    const descripcion = item._categoria === 'motor'
      ? `${item.tipo} ${item.marca} ${item.modelo} ${item.ano}`
      : `${item.marca} ${item.modelo} ${item.ano}`;
    const mensaje = `Hola, vi ${descripcion} en la vista previa de ${branding.nombre}. ¿Sigue disponible?`;
    return `https://wa.me/52${tenant.whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(mensaje)}`;
  }

  return (
    <main style={{ minHeight: '100vh', backgroundColor: branding.colorFondo, fontFamily: "'Inter', sans-serif" }}>
      <div style={{ backgroundColor: branding.colorPrimario, padding: '28px 16px' }}>
        <div style={{ maxWidth: '620px', margin: '0 auto', textAlign: 'center' }}>
          <img
            src={branding.logoUrl}
            alt={branding.nombre}
            style={{ height: '64px', maxWidth: '220px', objectFit: 'contain', marginBottom: '10px' }}
          />
          <h1 style={{ color: '#fff', fontSize: '20px', fontWeight: '700', margin: 0 }}>
            {branding.nombre}
          </h1>
        </div>
      </div>

      <div style={{ backgroundColor: '#FFF8E1', borderBottom: '1px solid #FFD54F', padding: '10px 16px', textAlign: 'center' }}>
        <p style={{ margin: 0, fontSize: '12px', color: '#7A4F00', fontWeight: '600' }}>
          🔍 Vista previa para {branding.nombre} — algunos ajustes pendientes antes de publicarse
        </p>
      </div>

      <div style={{ maxWidth: '620px', margin: '0 auto', padding: '24px 16px' }}>
        <h2 style={{ fontSize: '16px', fontWeight: '700', color: branding.colorPrimario, marginBottom: '16px' }}>
          Inventario disponible ({items.length})
        </h2>

        {items.length === 0 ? (
          <p style={{ textAlign: 'center', color: '#888', marginTop: '32px' }}>
            Aún no hay inventario cargado.
          </p>
        ) : (
          items.map((item) => (
            <div key={`${item._categoria}-${item.id}`} style={cardStyle}>
              {item._categoria === 'motor' ? (
                <>
                  <span style={tipoBadgeStyle(branding.colorAcento)}>
                    {item.tipo === 'Motor' ? '🔧 Motor' : '⚙️ Transmisión'}
                  </span>
                  <p style={itemTituloStyle(branding.colorPrimario)}>
                    {item.marca} {item.modelo} {item.ano}
                  </p>
                  {item.cilindrada && <p style={itemSubStyle}>{item.cilindrada}</p>}
                </>
              ) : (
                <>
                  <p style={itemTituloStyle(branding.colorPrimario)}>
                    🚗 {item.marca} {item.modelo} {item.ano}
                  </p>
                  <p style={itemSubStyle}>
                    {item.transmision}{item.traccion ? ` · ${item.traccion}` : ''}{item.cilindrada ? ` · ${item.cilindrada}` : ''}
                  </p>
                </>
              )}

              {whatsappHref(item) && (
                <a
                  href={whatsappHref(item)}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={whatsappBotonStyle}
                >
                  💬 Preguntar por WhatsApp
                </a>
              )}
            </div>
          ))
        )}
      </div>
    </main>
  );
}

const cardStyle = {
  backgroundColor: '#fff', borderRadius: '16px', padding: '18px', marginBottom: '14px',
  boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
};
const tipoBadgeStyle = (color) => ({
  display: 'inline-block', backgroundColor: color, color: '#fff', fontSize: '11px',
  fontWeight: '700', padding: '3px 8px', borderRadius: '12px', marginBottom: '8px',
});
const itemTituloStyle = (color) => ({
  fontWeight: '700', color, fontSize: '16px', margin: '4px 0 2px',
});
const itemSubStyle = { color: '#888', fontSize: '13px', margin: 0 };
const whatsappBotonStyle = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginTop: '12px',
  padding: '10px 16px', borderRadius: '50px', backgroundColor: '#25D366', color: '#fff',
  fontWeight: '700', fontSize: '13px', textDecoration: 'none',
};
