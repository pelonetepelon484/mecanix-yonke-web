'use client';

// Buscador "Piezas nuevas" de la portada (etapa 4), aparte del de yonkes: por número de parte o
// descripción entre las refaccionarias visibles (/api/refacciones/buscar). Solo existe con
// config/refaccionarias.buscador encendida (page.js); apagada, la portada queda igual que siempre.
// Comparte con el buscador de yonkes solo el estado elegido (mismo selector).
import { useState } from 'react';
import { TEXTOS_PROVISIONALES, formatoPrecio } from '../lib/refaccionarias';
import BotonWhatsappRefaccionaria from './refaccionarias/[slug]/BotonWhatsappRefaccionaria';

export const TEXTO_PIEZAS_USADAS = '♻️ Piezas usadas (yonkes)';
export const TEXTO_PIEZAS_NUEVAS = '📦 Piezas nuevas (refaccionarias)';

export function SelectorTipoPiezas({ tipo, onCambiar }) {
  return (
    <div role="group" aria-label="Tipo de pieza" style={{ display: 'flex', gap: '8px', maxWidth: '440px', margin: '0 auto 16px' }}>
      {[['usadas', TEXTO_PIEZAS_USADAS], ['nuevas', TEXTO_PIEZAS_NUEVAS]].map(([valor, texto]) => (
        <button key={valor} type="button" aria-pressed={tipo === valor} onClick={() => onCambiar(valor)} style={opcion(tipo === valor)}>
          {texto}
        </button>
      ))}
    </div>
  );
}

const MENSAJE_ERROR = 'No pudimos buscar en este momento. Intenta de nuevo.';

export default function BuscadorPiezasNuevas({ estados = [], estado, onCambiarEstado }) {
  const [texto, setTexto] = useState('');
  const [buscando, setBuscando] = useState(false);
  const [error, setError] = useState('');
  // null = todavía no se busca. { consulta, estado, resultados, total, pagina, hayMas }
  const [respuesta, setRespuesta] = useState(null);

  async function buscar(pagina = 1) {
    const consulta = pagina === 1 ? texto.trim() : respuesta.consulta;
    const estadoConsulta = pagina === 1 ? estado : respuesta.estado;
    if (consulta.length < 2) { setError('Escribe un número de parte o una descripción.'); return; }
    setBuscando(true);
    setError('');
    try {
      const res = await fetch('/api/refacciones/buscar', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ texto: consulta, estado: estadoConsulta, pagina }),
      });
      const datos = await res.json().catch(() => ({}));
      if (datos.estado !== 'ok') { setError(datos.mensaje || MENSAJE_ERROR); return; }
      setRespuesta((previa) => ({
        consulta, estado: estadoConsulta, total: datos.total, pagina: datos.pagina, hayMas: datos.hayMas,
        resultados: pagina === 1 ? datos.resultados : [...previa.resultados, ...datos.resultados],
      }));
    } catch {
      setError(MENSAJE_ERROR);
    } finally {
      setBuscando(false);
    }
  }

  return (
    <>
      <p style={{ textAlign: 'center', fontSize: '14px', color: '#1A3C5E', lineHeight: '1.5', maxWidth: '440px', margin: '0 auto 16px' }}>
        {TEXTOS_PROVISIONALES.introPiezasNuevas}
      </p>
      <div style={{ maxWidth: '320px', margin: '0 auto 16px' }}>
        <select aria-label="Estado" value={estado} onChange={(e) => onCambiarEstado(e.target.value)} style={selectorEstado}>
          <option value="todos">Todos los estados</option>
          {estados.map((e) => <option key={e.id} value={e.id}>{e.nombre}</option>)}
        </select>
      </div>

      <div style={{ backgroundColor: '#fff', borderRadius: '20px', padding: '24px 28px', boxShadow: '0 8px 32px rgba(26,60,94,0.10)', marginBottom: '12px' }}>
        <h2 style={{ fontSize: '18px', color: '#1A3C5E', marginBottom: '6px', fontWeight: '700' }}>📦 Piezas nuevas</h2>
        <p style={{ fontSize: '13px', color: '#888', marginBottom: '16px' }}>Ej. &ldquo;ABC-123&rdquo; o &ldquo;balatas delanteras&rdquo;</p>
        <input
          className="mecanix-input" type="text" aria-label="Número de parte o descripción" placeholder="Número de parte o descripción"
          value={texto} maxLength={100} onChange={(e) => setTexto(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') buscar(1); }}
        />
        <button type="button" onClick={() => buscar(1)} disabled={buscando} className="mecanix-btn-primary">
          {buscando && !respuesta?.resultados?.length ? 'Buscando...' : '🔍 Buscar piezas nuevas'}
        </button>
        {error && <p role="alert" style={{ color: '#C62828', fontSize: '13px', margin: '10px 0 0' }}>{error}</p>}
      </div>

      {respuesta && (
        <div style={{ marginBottom: '24px' }}>
          <p style={{ fontSize: '14px', color: '#1A3C5E', fontWeight: '700', margin: '16px 0 4px' }}>
            {respuesta.total === 0 ? 'No encontramos piezas nuevas con esa búsqueda.' : `${respuesta.total} ${respuesta.total === 1 ? 'pieza encontrada' : 'piezas encontradas'}`}
          </p>
          {respuesta.total > 0 && (
            <>
              <p style={nota}>{TEXTOS_PROVISIONALES.ordenResultados}</p>
              <p style={nota}>{TEXTOS_PROVISIONALES.avisoPrecios}</p>
            </>
          )}
          {respuesta.resultados.map(({ refaccionaria: r, pieza: p }, i) => (
            <div key={`${r.id}-${p.numeroParte}-${i}`} style={tarjeta}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
                <div style={{ minWidth: 0 }}>
                  <p style={{ margin: 0, fontWeight: '700', color: '#1A3C5E', fontSize: '15px' }}>{p.descripcion || p.numeroParte}</p>
                  <p style={{ margin: '2px 0 0', fontSize: '13px', color: '#666', overflowWrap: 'anywhere' }}>
                    No. de parte {p.numeroParte}{p.marca ? ` · ${p.marca}` : ''} · {p.tipo === 'marca' ? 'De marca' : 'Genérica'}
                  </p>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <p style={{ margin: 0, fontWeight: '700', color: '#E8720C', fontSize: '16px' }}>{formatoPrecio(p.precio)}</p>
                  <p style={{ margin: 0, fontSize: '12px', color: '#888' }}>{p.incluyeIva ? 'IVA incluido' : 'Más IVA'}</p>
                </div>
              </div>
              <p style={{ margin: '10px 0', fontSize: '13px', color: '#333' }}>
                🏪 <a href={`/refaccionarias/${r.slug}`} style={{ color: '#1A3C5E', fontWeight: '700' }}>{r.nombre}</a>
                {r.verificado && <span style={{ color: '#1A7F37', fontWeight: '700' }}> ✓ Verificado</span>}
                {r.ciudad && ` · 📍 ${r.ciudad}`}
              </p>
              {r.whatsapp && (
                <BotonWhatsappRefaccionaria refaccionariaId={r.id} nombre={r.nombre} whatsapp={r.whatsapp} pieza={p} origen="buscador" compacto />
              )}
            </div>
          ))}
          {respuesta.hayMas && (
            <button type="button" onClick={() => buscar(respuesta.pagina + 1)} disabled={buscando} style={verMas}>
              {buscando ? 'Cargando...' : 'Ver más'}
            </button>
          )}
        </div>
      )}
    </>
  );
}

const opcion = (activa) => ({
  flex: 1, padding: '10px 8px', borderRadius: '10px', border: '2px solid', borderColor: activa ? '#E8720C' : '#ddd',
  backgroundColor: activa ? '#FEF3EC' : '#fff', color: activa ? '#7A3C0C' : '#666', fontWeight: '700', fontSize: '13px', cursor: 'pointer',
  fontFamily: "'Inter', sans-serif",
});
const selectorEstado = { width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px', backgroundColor: '#fff', color: '#333', cursor: 'pointer' };
const nota = { fontSize: '12px', color: '#666', margin: '0 0 6px', lineHeight: '1.5' };
const tarjeta = { backgroundColor: '#fff', borderRadius: '16px', padding: '16px', margin: '12px 0', boxShadow: '0 4px 16px rgba(26,60,94,0.08)' };
const verMas = { width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #1A3C5E', backgroundColor: '#fff', color: '#1A3C5E', fontWeight: '700', fontSize: '14px', cursor: 'pointer' };
