import { cache } from 'react';
import { headers } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { getTenantBySub, getInventarioDeTenant, resolveBranding, subdominioEstaActivo, redireccionSinPremium } from '../lib/getTenant';
import { politicasDesdeGarantia } from '../../lib/politicasYonke';
import TenantPageClient from './TenantPageClient';
import { metadataVistaPreviaDeTenant } from '../lib/vistaPreviaTenant';

export const dynamic = 'force-dynamic';

const resolveDemo = cache(async function resolveDemo() {
  const sub = (await headers()).get('x-tenant-sub') || '';
  const tenant = await getTenantBySub(sub);
  if (!tenant) return null;
  const branding = resolveBranding(tenant);
  const inventario = await getInventarioDeTenant(tenant.id);
  return { sub, tenant, branding, inventario };
});

export async function generateMetadata() {
  const demo = await resolveDemo();
  if (!demo) return {};
  // Vista previa al compartir (WhatsApp, Facebook): nombre, ciudad e imagen del yonke en lugar de
  // los de Mecanix. El título de la pestaña y el "no indexar" siguen igual.
  return {
    ...(await metadataVistaPreviaDeTenant(demo.tenant, demo.sub)),
    title: demo.branding.nombre,
    robots: { index: false, follow: false },
  };
}

export default async function TenantDemoPage() {
  const demo = await resolveDemo();
  if (!demo) notFound();

  const { tenant, branding, inventario } = demo;

  // Interruptor manual del admin (ej. plan Premium/Élite vencido): redirect limpio del lado
  // servidor al sitio principal, antes de armar/renderizar nada del tenant — sin parpadeo.
  if (!subdominioEstaActivo(tenant)) {
    redirect('https://mecanixyonkevirtual.com');
  }

  // Límites del plan encendidos y sin Premium vigente: redirección TEMPORAL (307) a su ficha
  // pública en el sitio principal. Temporal a propósito: al volver a ser Premium vigente, su
  // página propia regresa sola.
  const destinoSinPremium = await redireccionSinPremium(tenant);
  if (destinoSinPremium) redirect(destinoSinPremium);

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
    // Solo un booleano: si /politicas existe de verdad para este yonke (ver esa página, misma
    // función pura politicasDesdeGarantia -- nunca se desincronizan).
    tienePoliticas: politicasDesdeGarantia(tenant.garantia) !== null,
  };

  return <TenantPageClient negocio={negocio} branding={branding} inventario={inventario} />;
}
