import { cache } from 'react';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { getTenantBySub, getInventarioDeTenant, resolveBranding } from '../lib/getTenant';
import TenantPageClient from './TenantPageClient';

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
    title: demo.branding.nombre,
    robots: { index: false, follow: false },
  };
}

export default async function TenantDemoPage() {
  const demo = await resolveDemo();
  if (!demo) notFound();

  const { tenant, branding, inventario } = demo;

  // Solo los campos serializables/públicos que la página necesita — el doc del yonke trae
  // más cosas (premiumHasta, fechaRegistro, etc. son Timestamps y no cruzan a un Client
  // Component tal cual).
  const negocio = {
    id: tenant.id,
    nombre: tenant.nombre || branding.nombre,
    direccion: tenant.direccion || '',
    ciudad: tenant.ciudad || '',
    telefono: tenant.telefono || '',
    whatsapp: tenant.whatsapp || '',
    horario: tenant.horario || null,
    verificado: tenant.verificado === true,
  };

  return <TenantPageClient negocio={negocio} branding={branding} inventario={inventario} />;
}
