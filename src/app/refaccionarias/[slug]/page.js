import { notFound } from 'next/navigation';
import { formatearHorario } from '../../lib/horario';
import { bloqueDeInventario, paginaPublicaEncendida, refaccionariaPorSlug } from '../../lib/refaccionariaPublica';
import {
  TEXTOS_PROVISIONALES, formatoPrecio, paginaDeParametro, piezasDePagina, refaccionariaVisible, totalPaginas, ubicacionPagina,
} from '../../../lib/refaccionarias';
import BotonWhatsappRefaccionaria from './BotonWhatsappRefaccionaria';

// Página pública de una refaccionaria (etapa 3), por slug. Detrás de config/refaccionarias.paginaPublica:
// apagada, cualquier /refaccionarias/... da 404 como hoy. Solo se muestra activa y con prueba o pago
// vigente; si no, "no disponible" (sin leer el inventario). Lecturas: refaccionaria por slug + el
// bloque de la página pedida (50 piezas), con caché de 5 min (lib/refaccionariaPublica.js).
// Sin índice en buscadores hasta que se decida.
export const dynamic = 'force-dynamic';

async function resolver(slug) {
  if (!(await paginaPublicaEncendida('config'))) return null;
  return refaccionariaPorSlug(slug);
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const r = await resolver(slug);
  if (!r) return {};
  return { title: r.nombre || 'Refaccionaria', robots: { index: false, follow: false } };
}

export default async function PaginaRefaccionaria({ params, searchParams }) {
  const { slug } = await params;
  const r = await resolver(slug);
  if (!r) notFound();

  const visible = refaccionariaVisible({
    activo: r.activo,
    pruebaHasta: r.pruebaHastaMs ? new Date(r.pruebaHastaMs) : null,
    premiumHasta: r.premiumHastaMs ? new Date(r.premiumHastaMs) : null,
  });
  if (!visible) {
    return (
      <main style={fondo}>
        <div style={{ ...tarjeta, textAlign: 'center' }}>
          <h1 style={{ fontSize: '20px', color: '#1A3C5E', margin: '0 0 10px' }}>{r.nombre}</h1>
          <p style={{ color: '#555', margin: 0 }}>{TEXTOS_PROVISIONALES.noDisponible}</p>
        </div>
      </main>
    );
  }

  const paginas = totalPaginas(r.totalPiezas);
  const pagina = paginaDeParametro((await searchParams)?.pagina);
  if (paginas > 0 && pagina > paginas) notFound();
  const piezas = paginas > 0 ? piezasDePagina(await bloqueDeInventario(`${r.id}/${ubicacionPagina(pagina).bloque}`), pagina) : [];
  const horario = formatearHorario(r.horario);
  const zona = r.zonaEntrega;
  const actualizado = r.inventarioActualizadoMs ? new Date(r.inventarioActualizadoMs).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' }) : '';

  return (
    <main style={fondo}>
      <div style={{ maxWidth: '720px', width: '100%' }}>
        <div style={tarjeta}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '12px' }}>
            {r.logoUrl && <img src={r.logoUrl} alt={`Logo de ${r.nombre}`} style={{ width: '64px', height: '64px', objectFit: 'contain', borderRadius: '10px' }} />}
            <div>
              <h1 style={{ fontSize: '22px', color: '#1A3C5E', margin: 0 }}>{r.nombre}</h1>
              {r.ciudad && <p style={{ margin: '2px 0 0', color: '#555', fontSize: '14px' }}>📍 {r.ciudad}</p>}
            </div>
          </div>
          {horario && <p style={dato}>🕒 {horario}</p>}
          {zona && (zona.descripcion || zona.municipios?.length > 0) && (
            <p style={dato}>🚚 Entrega local: {zona.descripcion}{zona.municipios?.length ? ` (${zona.municipios.join(', ')})` : ''}</p>
          )}
          {r.whatsapp && <BotonWhatsappRefaccionaria refaccionariaId={r.id} nombre={r.nombre} whatsapp={r.whatsapp} />}
        </div>

        <div style={tarjeta}>
          <h2 style={{ fontSize: '18px', color: '#1A3C5E', margin: '0 0 4px' }}>Piezas con precio</h2>
          {actualizado && <p style={{ ...dato, color: '#666', fontSize: '13px' }}>Precios actualizados el {actualizado}</p>}
          <p style={{ ...dato, color: '#666', fontSize: '13px' }}>{TEXTOS_PROVISIONALES.avisoPrecios}</p>
          {piezas.length === 0 && <p style={{ color: '#555' }}>Esta refaccionaria todavía no tiene piezas cargadas.</p>}
          {piezas.length > 0 && (
            <ul style={{ listStyle: 'none', padding: 0, margin: '12px 0 0' }}>
              {piezas.map((p, i) => (
                <li key={`${p.numeroParte}-${i}`} style={renglon}>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ margin: 0, fontWeight: '600', color: '#1A3C5E', fontSize: '15px' }}>{p.descripcion || p.numeroParte}</p>
                    <p style={{ margin: '2px 0 0', fontSize: '13px', color: '#666', overflowWrap: 'anywhere' }}>
                      No. de parte {p.numeroParte}{p.marca ? ` · ${p.marca}` : ''} · {p.tipo === 'marca' ? 'De marca' : 'Genérica'}
                    </p>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <p style={{ margin: 0, fontWeight: '700', color: '#E8720C', fontSize: '16px' }}>{formatoPrecio(p.precio)}</p>
                    <p style={{ margin: 0, fontSize: '12px', color: '#888' }}>{p.incluyeIva ? 'IVA incluido' : 'Más IVA'}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
          {paginas > 1 && (
            <nav aria-label="Páginas de piezas" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '14px', fontSize: '14px' }}>
              {pagina > 1 ? <a href={`?pagina=${pagina - 1}`} style={enlace}>← Anterior</a> : <span />}
              <span style={{ color: '#666' }}>Página {pagina} de {paginas}</span>
              {pagina < paginas ? <a href={`?pagina=${pagina + 1}`} style={enlace}>Siguiente →</a> : <span />}
            </nav>
          )}
        </div>
      </div>
    </main>
  );
}

const fondo = { minHeight: '100vh', backgroundColor: '#F4F5F5', display: 'flex', justifyContent: 'center', padding: '24px 16px', boxSizing: 'border-box' };
const tarjeta = { backgroundColor: '#fff', borderRadius: '16px', padding: '20px', marginBottom: '16px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', boxSizing: 'border-box', width: '100%' };
const dato = { margin: '0 0 10px', fontSize: '14px', color: '#333', lineHeight: '1.5' };
const renglon = { display: 'flex', justifyContent: 'space-between', gap: '12px', padding: '12px 0', borderTop: '1px solid #EEE' };
const enlace = { color: '#1A3C5E', fontWeight: '600', textDecoration: 'none' };
