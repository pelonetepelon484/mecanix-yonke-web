import { headers } from 'next/headers';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getTenantBySub, resolveBranding, subdominioEstaActivo } from '../../lib/getTenant';
import { politicasDesdeGarantia } from '../../../lib/politicasYonke';

export const dynamic = 'force-dynamic';

export async function generateMetadata() {
  const sub = (await headers()).get('x-tenant-sub') || '';
  const tenant = await getTenantBySub(sub);
  if (!tenant) return {};
  return {
    title: `Políticas y garantía · ${tenant.nombre || 'Yonke'}`,
    robots: { index: false, follow: false },
  };
}

// Página pública /politicas de un tenant — SIN datos nuevos: lee yonkes/{id}.garantia con la
// MISMA función pura que usa NotaGarantiaModal.js al precargar una nota nueva (ver
// src/lib/politicasYonke.ts), así el ticket y esta página nunca pueden mostrar cosas distintas.
// Si el yonke nunca capturó queCubre/queNoCubre reales, la página no existe (404) — nunca muestra
// el texto genérico de garantiaDefault.js como si fuera la política real de este yonke.
export default async function PoliticasTenantPage() {
  const sub = (await headers()).get('x-tenant-sub') || '';
  const tenant = await getTenantBySub(sub);
  if (!tenant || !subdominioEstaActivo(tenant)) notFound();

  const politicas = politicasDesdeGarantia(tenant.garantia);
  if (!politicas) notFound();

  const branding = resolveBranding(tenant);
  const actualizado = politicas.actualizadoAtMs
    ? new Date(politicas.actualizadoAtMs).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })
    : null;

  return (
    <main style={{ minHeight: '100vh', backgroundColor: '#F4F5F5', padding: '32px 16px' }}>
      <div style={{ maxWidth: '620px', margin: '0 auto', backgroundColor: '#fff', borderRadius: '16px', padding: '28px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
        <Link href="/" style={{ color: branding.colorPrimario, fontSize: '13px', fontWeight: '700', textDecoration: 'none' }}>
          ← Volver a {branding.nombre}
        </Link>

        <h1 style={{ color: branding.colorPrimario, fontSize: '22px', margin: '16px 0 4px' }}>
          Políticas y garantía
        </h1>
        <p style={{ color: '#888', fontSize: '13px', marginBottom: '24px' }}>
          {branding.nombre}{actualizado ? ` · Última actualización: ${actualizado}` : ''}
        </p>

        {politicas.diasDefault && (
          <p style={{ fontSize: '15px', fontWeight: '700', color: branding.colorPrimario, marginBottom: '16px' }}>
            Garantía de {politicas.diasDefault} días en las piezas que vendemos.
          </p>
        )}

        {politicas.queCubre && (
          <>
            <h2 style={{ fontSize: '15px', fontWeight: '700', color: branding.colorPrimario, marginBottom: '8px' }}>Qué cubre</h2>
            <p style={{ fontSize: '14px', color: '#333', lineHeight: '1.6', whiteSpace: 'pre-wrap', marginBottom: '20px' }}>{politicas.queCubre}</p>
          </>
        )}

        {politicas.queNoCubre && (
          <>
            <h2 style={{ fontSize: '15px', fontWeight: '700', color: branding.colorPrimario, marginBottom: '8px' }}>Qué NO cubre</h2>
            <p style={{ fontSize: '14px', color: '#333', lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>{politicas.queNoCubre}</p>
          </>
        )}
      </div>
    </main>
  );
}
