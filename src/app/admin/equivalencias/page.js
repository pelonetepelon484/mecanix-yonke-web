'use client';

// Equivalencias de números de parte para el comparador (/comparador).
//   "Registradas": el admin captura números que son la misma pieza (ej. el número viejo de GM y el
//     nuevo que lo reemplaza). El comparador las usa para "Compatible según registros de Mecanix".
//   "Sugerencias": lo que encontró la búsqueda automática (apagada por defecto: interruptor
//     sugerenciasIA en config/comparador). Nada llega al cliente hasta que el admin lo aprueba.
// Costo: al abrir, 1 lectura por equivalencia (máx. 300) y 1 por sugerencia abierta (máx. 100).
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { addDoc, collection, deleteDoc, doc, getDocs, limit, query, serverTimestamp, updateDoc, where } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { TIPOS_PIEZA, GRUPOS_PIEZA, etiquetaTipoPieza, normalizarParte } from '../../../lib/comparadorPiezas';
import {
  COLECCION_EQUIVALENCIAS, COLECCION_SUGERENCIAS, ESTADOS_SUGERENCIA, MAX_NOTA, notaDesdeSugerencia, validarEquivalencia,
} from '../../../lib/equivalencias';
import { leerConfigComparador } from '../../../lib/configComparador';
import PegarTabla from './PegarTabla';

const VACIO = { tipoPieza: '', textoPartes: '', nota: '' };
const segundos = (t) => t?.seconds || 0;
const fecha = (t) => (t?.toDate ? t.toDate().toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' }) : '');

function SelectorTipo({ id, valor, alCambiar }) {
  return (
    <select id={id} value={valor} onChange={(e) => alCambiar(e.target.value)} style={campo}>
      <option value="">Cualquier tipo de pieza</option>
      {GRUPOS_PIEZA.map((g) => (
        <optgroup key={g.key} label={g.label}>
          {TIPOS_PIEZA.filter((t) => t.grupo === g.key).map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
        </optgroup>
      ))}
    </select>
  );
}

export default function AdminEquivalenciasPage() {
  const router = useRouter();
  const [pestana, setPestana] = useState('registradas');
  const [cargando, setCargando] = useState(true);
  const [registradas, setRegistradas] = useState([]);
  const [sugerencias, setSugerencias] = useState([]);
  const [iaEncendida, setIaEncendida] = useState(false);
  const [f, setF] = useState(VACIO);
  const [deSugerencia, setDeSugerencia] = useState(null); // id de la sugerencia que se está aprobando
  const [mensaje, setMensaje] = useState(null); // { tipo: 'ok' | 'error', texto }
  const [guardando, setGuardando] = useState(false);
  const [filtro, setFiltro] = useState('');

  useEffect(() => {
    async function cargar() {
      try {
        const [eq, sug, config] = await Promise.all([
          getDocs(query(collection(db, COLECCION_EQUIVALENCIAS), limit(300))),
          getDocs(query(collection(db, COLECCION_SUGERENCIAS), where('estado', 'in', ['buscando', 'pendiente', 'sin_resultado', 'error']), limit(100))),
          leerConfigComparador(db),
        ]);
        setRegistradas(eq.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => segundos(b.creadoAt) - segundos(a.creadoAt)));
        // Primero las que la búsqueda sí confirmó.
        const orden = { pendiente: 0, sin_resultado: 1, buscando: 2, error: 3 };
        setSugerencias(sug.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => (orden[a.estado] ?? 9) - (orden[b.estado] ?? 9) || segundos(b.creadoAt) - segundos(a.creadoAt)));
        setIaEncendida(config.sugerenciasIA);
      } catch (e) {
        console.error('[admin/equivalencias] Error al cargar', e);
        setMensaje({ tipo: 'error', texto: 'No se pudo cargar. Recarga la página.' });
      }
      setCargando(false);
    }
    cargar();
  }, []);

  const cambiar = (campoF) => (valor) => { setF((x) => ({ ...x, [campoF]: valor })); setMensaje(null); };

  async function guardar(e) {
    e.preventDefault();
    const r = validarEquivalencia(f);
    if (!r.ok) { setMensaje({ tipo: 'error', texto: r.mensaje }); return; }
    setGuardando(true);
    try {
      const ref = await addDoc(collection(db, COLECCION_EQUIVALENCIAS), { ...r.datos, creadoAt: serverTimestamp() });
      setRegistradas((x) => [{ id: ref.id, ...r.datos, creadoAt: { seconds: Date.now() / 1000 } }, ...x]);
      if (deSugerencia) {
        await updateDoc(doc(db, COLECCION_SUGERENCIAS, deSugerencia), { estado: 'aprobada', revisadoAt: serverTimestamp() });
        setSugerencias((x) => x.filter((s) => s.id !== deSugerencia));
      }
      setF(VACIO); setDeSugerencia(null);
      setMensaje({ tipo: 'ok', texto: `Guardado: ${r.datos.partes.join(', ')}` });
    } catch (error) {
      console.error('[admin/equivalencias] No se pudo guardar', error);
      setMensaje({ tipo: 'error', texto: 'No se pudo guardar. Intenta de nuevo.' });
    }
    setGuardando(false);
  }

  async function borrar(eq) {
    if (!window.confirm(`¿Borrar la equivalencia ${eq.partes?.join(', ')}? El comparador dejará de usarla.`)) return;
    try {
      await deleteDoc(doc(db, COLECCION_EQUIVALENCIAS, eq.id));
      setRegistradas((x) => x.filter((r) => r.id !== eq.id));
    } catch (error) {
      console.error('[admin/equivalencias] No se pudo borrar', error);
      alert('No se pudo borrar, intenta de nuevo.');
    }
  }

  // "Revisar y aprobar": llena el formulario con la pareja, los números relacionados y la fuente.
  // El admin corrige lo que haga falta y guarda; entonces la sugerencia queda "aprobada".
  function revisar(s) {
    const partes = [...new Set([...(s.partes || []), ...(s.partesRelacionadas || [])])];
    setF({ tipoPieza: s.tipoPieza || '', textoPartes: partes.join(', '), nota: notaDesdeSugerencia(s) });
    setDeSugerencia(s.id);
    setPestana('registradas');
    setMensaje({ tipo: 'ok', texto: 'Revisa los números y la nota; quita los que no estés seguro y toca "Guardar".' });
    window.scrollTo?.({ top: 0 });
  }

  async function descartar(s) {
    try {
      if (s.estado === 'error' || s.estado === 'buscando') {
        // Falló o se quedó a medias: se borra para que se pueda buscar otra vez.
        await deleteDoc(doc(db, COLECCION_SUGERENCIAS, s.id));
      } else {
        await updateDoc(doc(db, COLECCION_SUGERENCIAS, s.id), { estado: 'descartada', revisadoAt: serverTimestamp() });
      }
      setSugerencias((x) => x.filter((y) => y.id !== s.id));
    } catch (error) {
      console.error('[admin/equivalencias] No se pudo descartar', error);
      alert('No se pudo descartar, intenta de nuevo.');
    }
  }

  const buscado = normalizarParte(filtro);
  const visibles = buscado ? registradas.filter((r) => r.partes?.some((p) => p.includes(buscado))) : registradas;
  const porRevisar = sugerencias.filter((s) => s.estado === 'pendiente').length;

  return (
    <main style={{ minHeight: '100vh', backgroundColor: '#F0F2F5', padding: '20px 16px 40px', fontFamily: "'Inter', sans-serif" }}>
      <div style={{ maxWidth: '760px', margin: '0 auto' }}>
        <button type="button" onClick={() => router.push('/admin')} style={enlace}>← Admin</button>
        <h1 style={{ fontSize: '22px', color: '#1A3C5E', fontWeight: '800', margin: '10px 0 4px' }}>🔁 Equivalencias de piezas</h1>
        <p style={{ fontSize: '14px', color: '#1A3C5E', margin: '0 0 14px', lineHeight: 1.5 }}>
          Números de parte que son la misma pieza (por ejemplo, el número viejo y el nuevo que lo reemplaza). El comparador los usa para decir &quot;Compatible según registros de Mecanix&quot;.
        </p>

        <div role="tablist" style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
          <button type="button" role="tab" aria-selected={pestana === 'registradas'} onClick={() => setPestana('registradas')} style={pestana === 'registradas' ? tabActiva : tab}>
            Registradas ({registradas.length})
          </button>
          <button type="button" role="tab" aria-selected={pestana === 'sugerencias'} onClick={() => setPestana('sugerencias')} style={pestana === 'sugerencias' ? tabActiva : tab}>
            Sugerencias{porRevisar > 0 ? ` (${porRevisar} por revisar)` : ''}
          </button>
        </div>

        {mensaje && (
          <p role={mensaje.tipo === 'error' ? 'alert' : 'status'} style={{ ...caja, padding: '10px 14px', margin: '0 0 12px', color: mensaje.tipo === 'error' ? '#B3261E' : '#1E6B34', fontWeight: '600', fontSize: '14px' }}>
            {mensaje.texto}
          </p>
        )}

        {cargando ? <p style={{ color: '#1A3C5E' }}>Cargando…</p> : pestana === 'registradas' ? (
          <>
            <form onSubmit={guardar} style={caja} aria-label="Nueva equivalencia">
              <h2 style={titulo}>{deSugerencia ? 'Aprobar sugerencia' : 'Nueva equivalencia'}</h2>
              <label htmlFor="eq-tipo" style={etiqueta}>Tipo de pieza</label>
              <SelectorTipo id="eq-tipo" valor={f.tipoPieza} alCambiar={cambiar('tipoPieza')} />
              <label htmlFor="eq-partes" style={{ ...etiqueta, marginTop: '10px' }}>Números de parte (separados por coma)</label>
              <textarea id="eq-partes" value={f.textoPartes} onChange={(e) => cambiar('textoPartes')(e.target.value)} rows={3} placeholder="12605843, 19210736" style={{ ...campo, fontFamily: 'monospace', resize: 'vertical' }} />
              <label htmlFor="eq-nota" style={{ ...etiqueta, marginTop: '10px' }}>Nota: de dónde sale el dato (opcional)</label>
              <textarea id="eq-nota" value={f.nota} onChange={(e) => cambiar('nota')(e.target.value)} rows={2} maxLength={MAX_NOTA} placeholder="Catálogo GM: 19210736 reemplaza a 12605843 (Saturn Outlook 2007 3.6L)" style={{ ...campo, resize: 'vertical' }} />
              <div style={{ display: 'flex', gap: '8px', marginTop: '12px', flexWrap: 'wrap' }}>
                <button type="submit" disabled={guardando} style={botonPrincipal}>{guardando ? 'Guardando…' : 'Guardar'}</button>
                {deSugerencia && <button type="button" onClick={() => { setF(VACIO); setDeSugerencia(null); setMensaje(null); }} style={botonSecundario}>Cancelar</button>}
              </div>
            </form>

            <PegarTabla
              existentes={registradas}
              SelectorTipo={SelectorTipo}
              alGuardar={(nuevos) => setRegistradas((x) => [...nuevos.reverse(), ...x])}
            />

            <div style={{ ...caja, marginTop: '14px' }}>
              <label htmlFor="eq-filtro" style={etiqueta}>Buscar un número</label>
              <input id="eq-filtro" value={filtro} onChange={(e) => setFiltro(e.target.value)} placeholder="12605843" style={{ ...campo, fontFamily: 'monospace' }} />
              {visibles.length === 0 ? <p style={{ color: '#555', fontSize: '14px', margin: '12px 0 0' }}>Todavía no hay equivalencias{buscado ? ' con ese número' : ''}.</p> : (
                <ul style={{ listStyle: 'none', padding: 0, margin: '12px 0 0', display: 'grid', gap: '10px' }}>
                  {visibles.map((r) => (
                    <li key={r.id} style={{ border: '1px solid #E3EAF2', borderRadius: '12px', padding: '10px 12px' }}>
                      <p style={{ margin: 0, fontSize: '12px', color: '#E8720C', fontWeight: '800', textTransform: 'uppercase' }}>
                        {r.tipoPieza ? etiquetaTipoPieza(r.tipoPieza) : 'Cualquier tipo'}{r.clase === 'aplicacion' ? ' · aplicación' : ''}
                      </p>
                      <p style={{ margin: '4px 0 0', fontFamily: 'monospace', fontSize: '15px', color: '#1A3C5E', wordBreak: 'break-word' }}>{(r.partes || [r.parte]).filter(Boolean).join(' = ')}</p>
                      {r.nota && <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#555', wordBreak: 'break-word' }}>{r.nota}</p>}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px' }}>
                        <span style={{ fontSize: '12px', color: '#888' }}>{fecha(r.creadoAt)}</span>
                        <button type="button" onClick={() => borrar(r)} style={botonBorrar}>Borrar</button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        ) : (
          <>
            <p style={{ ...caja, padding: '10px 14px', margin: '0 0 12px', fontSize: '13px', color: '#1A3C5E', lineHeight: 1.5 }}>
              {iaEncendida
                ? '🟢 Búsqueda automática ENCENDIDA. Cuando alguien compara dos números distintos sin registro, se busca en internet y aparece aquí. El cliente no ve nada hasta que tú lo apruebes.'
                : '⚪ Búsqueda automática APAGADA (config/comparador → sugerenciasIA). No se hacen búsquedas ni hay costo.'}
            </p>
            {sugerencias.length === 0 ? <p style={{ color: '#555', fontSize: '14px' }}>No hay sugerencias por revisar.</p> : (
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: '10px' }}>
                {sugerencias.map((s) => {
                  const e = ESTADOS_SUGERENCIA[s.estado] || ESTADOS_SUGERENCIA.error;
                  return (
                    <li key={s.id} style={caja}>
                      <p style={{ margin: 0, fontSize: '12px', color: '#E8720C', fontWeight: '800', textTransform: 'uppercase' }}>{etiquetaTipoPieza(s.tipoPieza)}</p>
                      <p style={{ margin: '4px 0 0', fontFamily: 'monospace', fontSize: '16px', color: '#1A3C5E' }}>{(s.partes || []).join('  ↔  ')}</p>
                      <p style={{ margin: '6px 0 0', fontSize: '13px', fontWeight: '700', color: e.color }}>
                        {e.texto}{s.confianza && s.estado === 'pendiente' ? ` · confianza ${s.confianza}` : ''}
                      </p>
                      {s.resumen && <p style={{ margin: '6px 0 0', fontSize: '14px', color: '#333', lineHeight: 1.5 }}>{s.resumen}</p>}
                      {s.partesRelacionadas?.length > 0 && (
                        <p style={{ margin: '6px 0 0', fontSize: '13px', color: '#555' }}>Otros números mencionados: <span style={{ fontFamily: 'monospace' }}>{s.partesRelacionadas.join(', ')}</span></p>
                      )}
                      {s.fuentes?.length > 0 && (
                        <ul style={{ margin: '6px 0 0', paddingLeft: '18px', fontSize: '13px' }}>
                          {s.fuentes.map((fu) => (
                            <li key={fu.url} style={{ wordBreak: 'break-all' }}>
                              <a href={fu.url} target="_blank" rel="noopener noreferrer nofollow" style={{ color: '#1A3C5E' }}>{fu.titulo || fu.url}</a>
                            </li>
                          ))}
                        </ul>
                      )}
                      <div style={{ display: 'flex', gap: '8px', marginTop: '10px', flexWrap: 'wrap' }}>
                        {(s.estado === 'pendiente' || s.estado === 'sin_resultado') && <button type="button" onClick={() => revisar(s)} style={botonPrincipal}>Revisar y aprobar</button>}
                        <button type="button" onClick={() => descartar(s)} style={botonSecundario}>{s.estado === 'error' || s.estado === 'buscando' ? 'Borrar' : 'Descartar'}</button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </>
        )}
      </div>
    </main>
  );
}

const caja = { backgroundColor: '#fff', borderRadius: '16px', padding: '14px', boxShadow: '0 2px 10px rgba(26,60,94,0.06)' };
const titulo = { margin: '0 0 10px', fontSize: '16px', color: '#1A3C5E', fontWeight: '800' };
const etiqueta = { display: 'block', fontSize: '13px', color: '#555', fontWeight: '700', margin: '0 0 4px' };
const campo = { width: '100%', boxSizing: 'border-box', padding: '10px', fontSize: '16px', borderRadius: '10px', border: '1px solid #CCC', backgroundColor: '#fff', color: '#1A3C5E' };
const tab = { flex: 1, padding: '10px', borderRadius: '10px', border: '1px solid #1A3C5E', backgroundColor: '#fff', color: '#1A3C5E', fontWeight: '700', fontSize: '14px', cursor: 'pointer' };
const tabActiva = { ...tab, backgroundColor: '#1A3C5E', color: '#fff' };
const botonPrincipal = { padding: '10px 16px', borderRadius: '10px', border: 'none', backgroundColor: '#E8720C', color: '#fff', fontWeight: '800', fontSize: '14px', cursor: 'pointer' };
const botonSecundario = { padding: '10px 16px', borderRadius: '10px', border: '1px solid #1A3C5E', backgroundColor: '#fff', color: '#1A3C5E', fontWeight: '700', fontSize: '14px', cursor: 'pointer' };
const botonBorrar = { padding: '6px 10px', borderRadius: '8px', border: '1px solid #B3261E', backgroundColor: '#fff', color: '#B3261E', fontWeight: '700', fontSize: '12px', cursor: 'pointer' };
const enlace = { background: 'none', border: 'none', padding: 0, color: '#1A3C5E', fontWeight: '700', fontSize: '14px', cursor: 'pointer' };
