import { collection, getDocs, query, where } from 'firebase/firestore';
import { dbServer } from '../lib/firebase-server';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Yonkes Verificados — Mecanix Yonke Virtual',
  description: 'Yonkes que Mecanix confirmó personalmente que son negocios reales y cumplen lo que ofrecen.',
};

const CIUDADES_BC = [
  { key: 'tijuana', label: 'Tijuana' },
  { key: 'mexicali', label: 'Mexicali' },
  { key: 'ensenada', label: 'Ensenada' },
  { key: 'tecate', label: 'Tecate' },
  { key: 'rosarito', label: 'Playas de Rosarito' },
  { key: 'sanquintin', label: 'San Quintín' },
];

// Página pública (sin auth) — la colección yonkes ya se lee sin autenticación en el buscador,
// así que no hace falta ninguna regla de Firestore nueva para esto.
async function getYonkesVerificados() {
  try {
    const q = query(collection(dbServer, 'yonkes'), where('verificado', '==', true));
    const snap = await getDocs(q);
    const yonkes = snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .filter((y) => y.activo !== false);
    yonkes.sort((a, b) => {
      const ciudadA = a.ciudad || '';
      const ciudadB = b.ciudad || '';
      if (ciudadA !== ciudadB) return ciudadA.localeCompare(ciudadB);
      return (a.nombre || '').localeCompare(b.nombre || '');
    });
    return yonkes;
  } catch (error) {
    console.error('[verificados] No se pudo cargar la lista de yonkes verificados', error);
    return [];
  }
}

export default async function VerificadosPage() {
  const yonkes = await getYonkesVerificados();

  return (
    <main style={{ minHeight: '100vh', backgroundColor: '#F0F2F5', padding: '32px 16px', fontFamily: "'Inter', sans-serif" }}>
      <div style={{ maxWidth: '620px', margin: '0 auto' }}>
        <a href="/" style={{ color: '#1A3C5E', fontSize: '13px', fontWeight: '700', textDecoration: 'none' }}>
          ← Volver al buscador
        </a>

        <div style={{ textAlign: 'center', margin: '20px 0 28px' }}>
          <img
            src="/sello_verificado.png"
            alt=""
            aria-hidden="true"
            style={{ width: '64px', height: '64px', objectFit: 'contain', marginBottom: '12px' }}
          />
          <h1 style={{ color: '#1A3C5E', fontSize: '20px', fontWeight: '700', margin: '0 0 8px' }}>
            Yonkes Verificados por Mecanix
          </h1>
          <p style={{ color: '#666', fontSize: '14px', lineHeight: '1.6', maxWidth: '480px', margin: '0 auto' }}>
            Negocios que confirmamos personalmente que son reales y cumplen lo que ofrecen.
          </p>
        </div>

        {yonkes.length === 0 ? (
          <div style={{ backgroundColor: '#fff', borderRadius: '14px', padding: '20px', textAlign: 'center', color: '#888', fontSize: '13px', boxShadow: '0 2px 10px rgba(26,60,94,0.07)' }}>
            Todavía no hay yonkes verificados publicados.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {yonkes.map((y) => (
              <TarjetaYonkeVerificado key={y.id} yonke={y} />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

function TarjetaYonkeVerificado({ yonke }) {
  // branding.logoUrl es el logo pensado para su página con subdominio propio; en la práctica
  // casi ningún yonke lo tiene configurado todavía, así que se cae al logoUrl "de toda la vida"
  // (el mismo que ya se sube desde el panel y se usa en las tarjetas de búsqueda) antes de
  // rendirse a mostrar solo el nombre.
  const logo = yonke.branding?.logoUrl || yonke.logoUrl || null;
  const ciudadLabel = CIUDADES_BC.find((c) => c.key === yonke.ciudad)?.label || yonke.ciudad || '';
  const href = yonke.subdominio ? `https://${yonke.subdominio}.mecanixyonkevirtual.com` : null;

  const contenido = (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '14px',
      backgroundColor: '#fff', borderRadius: '14px', padding: '14px 16px',
      boxShadow: '0 2px 10px rgba(26,60,94,0.07)',
    }}>
      {logo ? (
        <img src={logo} alt={yonke.nombre} style={{ width: '64px', height: '64px', objectFit: 'contain', borderRadius: '8px', flexShrink: 0 }} />
      ) : (
        <div style={{
          width: '64px', height: '64px', borderRadius: '8px', backgroundColor: '#EEF2F7',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: '22px',
        }}>
          🏪
        </div>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontWeight: '700', color: '#1A3C5E', fontSize: '16px' }}>{yonke.nombre}</p>
        {ciudadLabel && (
          <p style={{ margin: '4px 0 0', color: '#E8720C', fontSize: '13px', fontWeight: '600' }}>📌 {ciudadLabel}</p>
        )}
      </div>
      <img src="/sello_verificado.png" alt="Verificado" style={{ width: '36px', height: '36px', objectFit: 'contain', flexShrink: 0 }} />
    </div>
  );

  if (!href) return contenido;

  return (
    <a href={href} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>
      {contenido}
    </a>
  );
}
