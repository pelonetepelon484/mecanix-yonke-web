import { collection, getDocs, query, where } from 'firebase/firestore';
import { dbServer } from './firebase-server';

const DEFAULT_BRANDING = {
  logoUrl: '/mecanix-logo.webp',
  colorPrimario: '#1A3C5E',
  colorAcento: '#E8720C',
  colorFondo: '#F0F2F5',
};

// Filtra 'activo' en JS (no en la query) para no depender de un índice compuesto.
export async function getTenantBySub(sub) {
  if (!sub) return null;
  try {
    const q = query(collection(dbServer, 'yonkes'), where('subdominio', '==', sub));
    const snap = await getDocs(q);
    const match = snap.docs.find((d) => d.data().activo !== false);
    console.log('[getTenantBySub]', { sub, coincidencias: snap.size, encontrado: !!match }); // TODO: quitar tras verificar en producción
    if (!match) return null;
    return { id: match.id, ...match.data() };
  } catch (error) {
    console.error('[getTenantBySub] ERROR', {
      sub,
      code: error?.code,
      message: error?.message,
      name: error?.name,
      stack: error?.stack,
    }); // TODO: quitar tras verificar en producción
    return null;
  }
}

export async function getInventarioDeTenant(yonkeId) {
  const [vehiculosSnap, motoresSnap] = await Promise.all([
    getDocs(collection(dbServer, 'yonkes', yonkeId, 'vehiculos')),
    getDocs(collection(dbServer, 'yonkes', yonkeId, 'motores')),
  ]);

  const vehiculos = vehiculosSnap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((v) => v.disponible !== false);

  const motores = motoresSnap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((m) => m.disponible !== false);

  return { vehiculos, motores };
}

// Combina el branding del tenant con los defaults campo por campo — nunca todo-o-nada.
export function resolveBranding(tenant) {
  const b = tenant.branding || {};
  return {
    nombre: tenant.nombre || 'Yonke Demo',
    logoUrl: b.logoUrl || DEFAULT_BRANDING.logoUrl,
    colorPrimario: b.colorPrimario || DEFAULT_BRANDING.colorPrimario,
    colorAcento: b.colorAcento || DEFAULT_BRANDING.colorAcento,
    colorFondo: b.colorFondo || DEFAULT_BRANDING.colorFondo,
  };
}
