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
    if (!match) return null;
    return { id: match.id, ...match.data() };
  } catch {
    return null;
  }
}

// Se incluyen las piezas de cada vehículo (necesarias para que la página de tenant muestre
// disponibilidad por pieza) — se piden todas en paralelo, no una por una.
// fechaIngreso (Timestamp de Firestore) se omite: un Server Component no puede pasarle a un
// Client Component nada que no sea serializable en plano, y esta página no la necesita.
export async function getInventarioDeTenant(yonkeId) {
  const [vehiculosSnap, motoresSnap] = await Promise.all([
    getDocs(collection(dbServer, 'yonkes', yonkeId, 'vehiculos')),
    getDocs(collection(dbServer, 'yonkes', yonkeId, 'motores')),
  ]);

  const vehiculosActivos = vehiculosSnap.docs.filter((d) => d.data().disponible !== false);

  const vehiculos = await Promise.all(vehiculosActivos.map(async (vDoc) => {
    const { fechaIngreso, ...datos } = vDoc.data();
    const piezasSnap = await getDocs(collection(dbServer, 'yonkes', yonkeId, 'vehiculos', vDoc.id, 'piezas'));
    const piezas = piezasSnap.docs.map((p) => ({ id: p.id, nombre: p.data().nombre, disponible: p.data().disponible !== false }));
    return { id: vDoc.id, ...datos, piezas };
  }));

  const motores = motoresSnap.docs
    .map((d) => {
      const { fechaIngreso, ...datos } = d.data();
      return { id: d.id, ...datos };
    })
    .filter((m) => m.disponible !== false);

  return { vehiculos, motores };
}

// Interruptor manual del subdominio (independiente de `activo`, que ya filtra el yonke
// completo en getTenantBySub). Compatibilidad: los yonkes que ya tenían subdominio antes de
// este campo no lo traen en Firestore — `undefined !== false` es true, así que se tratan
// como activos por defecto. Solo se apaga cuando el admin lo pone explícitamente en false.
export function subdominioEstaActivo(tenant) {
  return tenant.subdominioActivo !== false;
}

// Combina el branding del tenant con los defaults campo por campo — nunca todo-o-nada.
export function resolveBranding(tenant) {
  const b = tenant.branding || {};
  return {
    nombre: b.nombreComercial || tenant.nombre || 'Yonke Demo',
    // El logo puede vivir en branding.logoUrl (registro) o en logoUrl de nivel superior
    // (panel/perfil, que solo escribe ahí) — se revisan ambos antes de caer al default.
    logoUrl: b.logoUrl || tenant.logoUrl || DEFAULT_BRANDING.logoUrl,
    colorPrimario: b.colorPrimario || DEFAULT_BRANDING.colorPrimario,
    colorAcento: b.colorAcento || DEFAULT_BRANDING.colorAcento,
    colorFondo: b.colorFondo || DEFAULT_BRANDING.colorFondo,
  };
}
