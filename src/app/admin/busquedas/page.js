'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { collection, query, where, orderBy, limit, getDocs, getCountFromServer, doc, updateDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';

const ESTADOS = [
  { key: 'ok', label: 'Con resultados', color: '#2E7D32' },
  { key: 'sin_inventario', label: 'Sin inventario', color: '#E8720C' },
  { key: 'fuera_de_catalogo', label: 'Fuera de catálogo', color: '#E8720C' },
  { key: 'parseo_parcial', label: 'Parseo parcial', color: '#C62828' },
  { key: 'fuera_de_giro', label: 'Fuera de giro', color: '#C62828' },
  { key: 'no_interpretada', label: 'No interpretada', color: '#C62828' },
];

function formatearFecha(fecha) {
  const f = fecha?.toDate ? fecha.toDate() : new Date(fecha);
  return f.toLocaleString('es-MX', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function queBuscaba(d) {
  const vehiculo = [d.marca, d.modelo, d.anio].filter(Boolean).join(' ');
  return [d.pieza, vehiculo].filter(Boolean).join(' — ') || '(sin detalle)';
}

function mensajeWhatsappCliente(d) {
  const vehiculo = [d.marca, d.modelo, d.anio].filter(Boolean).join(' ');
  const detalle = [d.pieza, vehiculo].filter(Boolean).join(' para ');
  return detalle
    ? `Hola, vi que buscabas ${detalle} en Mecanix Yonke Virtual. ¿Sigues interesado?`
    : 'Hola, vi tu búsqueda en Mecanix Yonke Virtual. ¿Sigues interesado?';
}

function agruparPorClave(docs, obtenerClave) {
  const mapa = new Map();
  for (const d of docs) {
    const clave = obtenerClave(d);
    if (!clave) continue;
    const actual = mapa.get(clave) || { clave, conteo: 0, ultima: null };
    actual.conteo++;
    const fecha = d.fecha?.toDate ? d.fecha.toDate() : new Date(d.fecha);
    if (!actual.ultima || fecha > actual.ultima) actual.ultima = fecha;
    mapa.set(clave, actual);
  }
  return [...mapa.values()].sort((a, b) => b.conteo - a.conteo).slice(0, 10);
}

// Filtro de país para las 4 tablas de detalle — se aplica CLIENT-SIDE sobre los docs ya
// descargados (no agrega lecturas ni cambia las queries de Firestore, que siguen exactamente
// igual que antes: estado + orderBy(fecha) + limit). 'mexico' exige pais === 'MX' EXACTO
// (confirmado), no incluye histórico sin país — ver nota grande en el useEffect de abajo sobre
// por qué se decidió así. 'todo' no filtra nada, igual que el dashboard de siempre.
function filtrarPorVista(docs, vista) {
  return vista === 'mexico' ? docs.filter((d) => d.pais === 'MX') : docs;
}

export default function AdminBusquedasPage() {
  const router = useRouter();
  const [cargando, setCargando] = useState(true);
  const [total, setTotal] = useState(0);
  const [conteos, setConteos] = useState({});
  const [conteosMx, setConteosMx] = useState({});
  // Resumen de país (spec: "para que David vea el tamaño del ruido de un vistazo") — SIEMPRE
  // visible sin importar la vista activa, no solo cuando se filtra. totalFueraDeMexico usa
  // pais != 'MX' (excluye por definición los docs sin campo `pais` — comportamiento documentado
  // de Firestore), así que es un conteo de países EXTRANJEROS CONFIRMADOS, nunca histórico
  // colado por error. totalDesconocido se calcula por resta, no por query (Firestore no tiene
  // forma barata de consultar "campo ausente").
  const [totalMx, setTotalMx] = useState(0);
  const [totalFueraDeMexico, setTotalFueraDeMexico] = useState(0);
  const [vista, setVista] = useState('mexico'); // 'mexico' (default) | 'todo'
  const [conContacto, setConContacto] = useState(0);
  // Se guardan los docs CRUDOS (no ya agrupados) para poder re-filtrar por país en el cliente
  // cuando cambia `vista`, sin volver a leer Firestore — ver filtrarPorVista/agruparPorClave más
  // abajo, calculados en cada render a partir de estos arreglos.
  const [docsFueraCatalogo, setDocsFueraCatalogo] = useState([]);
  const [docsSinInventario, setDocsSinInventario] = useState([]);
  const [docsFueraDeGiro, setDocsFueraDeGiro] = useState([]);
  const [docsNoInterpretadas, setDocsNoInterpretadas] = useState([]);
  const [contactosPendientes, setContactosPendientes] = useState([]);
  const [marcandoId, setMarcandoId] = useState(null);
  const [exportando, setExportando] = useState(false);

  useEffect(() => {
    async function cargar() {
      try {
        const ref = collection(db, 'busquedas');

        // Conteos "Todo" (sin filtro de país) y "Solo México" (pais == 'MX') EN PARALELO —
        // estado+pais son dos filtros de igualdad puros, Firestore los resuelve sin necesitar un
        // índice compuesto nuevo (verificado en vivo contra este mismo proyecto). pais != 'MX'
        // combinado con estado SÍ requeriría un índice nuevo por cada estado (equality+inequality
        // en campos distintos) — por eso "Solo México" se define como pais=='MX' exacto, nunca
        // como resta contra "fuera de México", ver nota en filtrarPorVista.
        const [totalSnap, totalMxSnap, totalFueraSnap, ...estadoSnaps] = await Promise.all([
          getCountFromServer(ref),
          getCountFromServer(query(ref, where('pais', '==', 'MX'))),
          getCountFromServer(query(ref, where('pais', '!=', 'MX'))),
          ...ESTADOS.map((e) => getCountFromServer(query(ref, where('estado', '==', e.key)))),
          ...ESTADOS.map((e) => getCountFromServer(query(ref, where('estado', '==', e.key), where('pais', '==', 'MX')))),
        ]);
        setTotal(totalSnap.data().count);
        setTotalMx(totalMxSnap.data().count);
        setTotalFueraDeMexico(totalFueraSnap.data().count);
        const nuevoConteos = {};
        const nuevoConteosMx = {};
        ESTADOS.forEach((e, i) => {
          nuevoConteos[e.key] = estadoSnaps[i].data().count;
          nuevoConteosMx[e.key] = estadoSnaps[ESTADOS.length + i].data().count;
        });
        setConteos(nuevoConteos);
        setConteosMx(nuevoConteosMx);

        const [fueraCatalogoSnap, sinInventarioSnap, fueraDeGiroSnap, noInterpretadasSnap, pendientesSnap] = await Promise.all([
          getDocs(query(ref, where('estado', '==', 'fuera_de_catalogo'), orderBy('fecha', 'desc'), limit(300))),
          getDocs(query(ref, where('estado', '==', 'sin_inventario'), orderBy('fecha', 'desc'), limit(300))),
          getDocs(query(ref, where('estado', '==', 'fuera_de_giro'), orderBy('fecha', 'desc'), limit(30))),
          getDocs(query(ref, where('estado', 'in', ['no_interpretada', 'parseo_parcial']), orderBy('fecha', 'desc'), limit(30))),
          getDocs(query(collection(db, 'busquedas_pendientes'), orderBy('fecha', 'desc'), limit(300))),
        ]);

        setDocsFueraCatalogo(fueraCatalogoSnap.docs.map((d) => d.data()));
        setDocsSinInventario(sinInventarioSnap.docs.map((d) => d.data()));
        setDocsFueraDeGiro(fueraDeGiroSnap.docs.map((d) => d.data()));
        setDocsNoInterpretadas(noInterpretadasSnap.docs.map((d) => d.data()));

        // "Con contacto dejado" se calcula de busquedas_pendientes (no de busquedas.tieneContacto):
        // ahí solo cuenta contacto si la búsqueda realmente quedó sin inventario — el mismo grupo
        // que necesita seguimiento real, para que el número de la tarjeta coincida con la lista.
        // No lleva país (un bot casi nunca deja un WhatsApp real) — se muestra igual en ambas vistas.
        const conContactoDocs = pendientesSnap.docs
          .filter((d) => Boolean(d.data().contacto))
          .map((d) => ({ id: d.id, ...d.data() }));
        setContactosPendientes(conContactoDocs);
        setConContacto(conContactoDocs.length);
      } catch (e) {
        console.error('[admin/busquedas] Error cargando datos', e);
      }
      setCargando(false);
    }
    cargar();
  }, []);

  const totalDesconocido = Math.max(0, total - totalMx - totalFueraDeMexico);
  const totalVista = vista === 'mexico' ? totalMx : total;
  const conteosVista = vista === 'mexico' ? conteosMx : conteos;
  const tablaFueraCatalogo = agruparPorClave(
    filtrarPorVista(docsFueraCatalogo, vista),
    (d) => `${d.marca || '?'} ${d.modelo || ''}`.trim(),
  );
  const tablaSinInventario = agruparPorClave(
    filtrarPorVista(docsSinInventario, vista),
    (d) => `${d.pieza || '?'} — ${d.marca || '?'} ${d.modelo || ''}`.trim(),
  );
  const tablaFueraDeGiro = filtrarPorVista(docsFueraDeGiro, vista);
  const tablaNoInterpretadas = filtrarPorVista(docsNoInterpretadas, vista);

  async function marcarAtendido(id) {
    setMarcandoId(id);
    try {
      await updateDoc(doc(db, 'busquedas_pendientes', id), { atendido: true, atendidoFecha: new Date() });
      setContactosPendientes((prev) => prev.map((c) => (c.id === id ? { ...c, atendido: true } : c)));
    } catch (e) {
      console.error('[admin/busquedas] No se pudo marcar como atendido', e);
      alert('No se pudo marcar como atendido, intenta de nuevo.');
    }
    setMarcandoId(null);
  }

  // Exportación de solo lectura para auditoría manual: TODAS las búsquedas con conResultado
  // false (cualquier estado que no sea 'ok'), sin límite — se descarga como un .json en el
  // navegador del propio admin ya autenticado, nada se sube a ningún lado ni se toca Firestore
  // aparte de esta lectura. fecha se convierte a ISO string porque un Timestamp de Firestore no
  // serializa a JSON legible.
  async function exportarJson() {
    setExportando(true);
    try {
      const ref = collection(db, 'busquedas');
      const q = query(ref, where('conResultado', '==', false), orderBy('fecha', 'desc'));
      const snap = await getDocs(q);
      const docs = snap.docs.map((d) => {
        const data = d.data();
        return { id: d.id, ...data, fecha: data.fecha?.toDate ? data.fecha.toDate().toISOString() : data.fecha };
      });
      const blob = new Blob([JSON.stringify(docs, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `busquedas_sin_resultado_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('[admin/busquedas] No se pudo exportar', error?.code, error);
      alert(`No se pudo exportar${error?.code ? ` (${error.code})` : ''}. Revisa la consola.`);
    } finally {
      setExportando(false);
    }
  }

  return (
    <main style={{ minHeight: '100vh', backgroundColor: '#F0F2F5', fontFamily: "'Inter', sans-serif", paddingBottom: '40px' }}>
      <div style={{ backgroundColor: '#1A3C5E', padding: '20px 16px', paddingTop: '24px', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ maxWidth: '900px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <button onClick={() => router.push('/admin')} style={{ background: 'none', border: 'none', color: '#E8720C', fontSize: '13px', cursor: 'pointer', fontWeight: 'bold', padding: 0 }}>
              ← Volver
            </button>
            <h1 style={{ color: '#fff', fontSize: '18px', margin: '4px 0 0', fontWeight: '700' }}>Búsquedas del Buscador Inteligente</h1>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={exportarJson}
              disabled={exportando}
              style={{ backgroundColor: '#1A3C5E', border: '1px solid #fff', borderRadius: '8px', color: '#fff', fontSize: '13px', fontWeight: '700', padding: '8px 14px', cursor: 'pointer' }}
            >
              {exportando ? 'Exportando...' : '⬇️ Exportar JSON'}
            </button>
            <button
              onClick={() => router.push('/admin/busquedas/mapa')}
              style={{ backgroundColor: '#E8720C', border: 'none', borderRadius: '8px', color: '#fff', fontSize: '13px', fontWeight: '700', padding: '8px 14px', cursor: 'pointer' }}
            >
              🗺️ Mapa
            </button>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: '900px', margin: '0 auto', padding: '16px' }}>
        {cargando ? (
          <p style={{ textAlign: 'center', color: '#888', marginTop: '32px' }}>Cargando...</p>
        ) : (
          <>
            {/* Resumen de país — SIEMPRE visible sin importar la vista, para dimensionar el
                ruido de un vistazo. "Desconocido" es histórico (de antes de capturar país) o
                tráfico local/sin header — no es necesariamente bot, por eso no cuenta como
                "fuera de México" ni se mezcla con él. */}
            <div style={{ marginBottom: '18px' }}>
              <h2 style={{ color: '#1A3C5E', fontSize: '15px', margin: '0 0 10px' }}>Origen por país</h2>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                <MetricaCard label="🇲🇽 México (confirmado)" valor={totalMx} pct={total > 0 ? Math.round((totalMx / total) * 100) : 0} color="#2E7D32" />
                <MetricaCard label="🌎 Fuera de México (confirmado)" valor={totalFueraDeMexico} pct={total > 0 ? Math.round((totalFueraDeMexico / total) * 100) : 0} color="#C62828" />
                <MetricaCard label="❓ País desconocido" valor={totalDesconocido} pct={total > 0 ? Math.round((totalDesconocido / total) * 100) : 0} color="#888" />
              </div>
            </div>

            {/* Vista: qué tan limpios se muestran los datos de abajo (tarjetas por estado +
                tablas). "Solo México" es el default para análisis — excluye tanto lo confirmado
                fuera de México como el histórico sin país, para que los números reflejen SOLO
                búsquedas confirmadas de México. Si se ve vacío o bajo al inicio es esperado: solo
                cuenta búsquedas nuevas que ya traen país detectado, no el histórico (ver arriba,
                "País desconocido" es donde vive ese histórico) — usa "Todo" para verlo completo. */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '18px' }}>
              {[
                { key: 'mexico', label: '🇲🇽 Solo México' },
                { key: 'todo', label: '🌐 Todo' },
              ].map((v) => (
                <button
                  key={v.key}
                  onClick={() => setVista(v.key)}
                  style={{
                    padding: '8px 16px', borderRadius: '20px', fontSize: '13px', fontWeight: '700',
                    border: vista === v.key ? 'none' : '1px solid #ccc', cursor: 'pointer',
                    backgroundColor: vista === v.key ? '#1A3C5E' : '#fff',
                    color: vista === v.key ? '#fff' : '#666',
                  }}
                >
                  {v.label}
                </button>
              ))}
            </div>

            {/* Métricas de la vista activa (México o Todo) */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '24px' }}>
              <MetricaCard label="Total de búsquedas" valor={totalVista} />
              {ESTADOS.map((e) => (
                <MetricaCard
                  key={e.key}
                  label={e.label}
                  valor={conteosVista[e.key] || 0}
                  pct={totalVista > 0 ? Math.round(((conteosVista[e.key] || 0) / totalVista) * 100) : 0}
                  color={e.color}
                />
              ))}
              <MetricaCard
                label="Con contacto dejado"
                valor={conContacto}
                pct={totalVista > 0 ? Math.round((conContacto / totalVista) * 100) : 0}
              />
            </div>

            {/* Contactos pendientes — la parte urgente: clientes que dejaron su WhatsApp en
                una búsqueda sin inventario y siguen esperando aviso. */}
            <div style={{ marginBottom: '28px' }}>
              <h2 style={{ color: '#1A3C5E', fontSize: '15px', margin: '0 0 2px' }}>
                Contactos pendientes de atender
              </h2>
              <p style={{ color: '#888', fontSize: '12px', margin: '0 0 10px' }}>
                Clientes que dejaron su WhatsApp en una búsqueda sin inventario — {contactosPendientes.filter((c) => !c.atendido).length} sin atender
              </p>
              {contactosPendientes.length === 0 ? (
                <div style={{ backgroundColor: '#fff', borderRadius: '12px', padding: '14px 12px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', color: '#aaa', fontSize: '13px', textAlign: 'center' }}>
                  Sin contactos pendientes todavía
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {contactosPendientes.map((c) => (
                    <ContactoCard
                      key={c.id}
                      contacto={c}
                      marcando={marcandoId === c.id}
                      onMarcarAtendido={() => marcarAtendido(c.id)}
                    />
                  ))}
                </div>
              )}
            </div>

            <Tabla
              titulo="Modelos fuera de catálogo más buscados"
              subtitulo="Candidatos a agregar al catálogo vivo"
              columnas={['Marca / modelo', 'Veces buscado', 'Última vez']}
              filas={tablaFueraCatalogo.map((r) => [r.clave, r.conteo, formatearFecha(r.ultima)])}
            />

            <Tabla
              titulo="Piezas sin inventario más buscadas"
              subtitulo="Candidatos a inventariar"
              columnas={['Pieza / vehículo', 'Veces buscado', 'Última vez']}
              filas={tablaSinInventario.map((r) => [r.clave, r.conteo, formatearFecha(r.ultima)])}
            />

            <Tabla
              titulo="Búsquedas fuera de giro recientes"
              subtitulo="Para revisar falsos positivos del heurístico"
              columnas={['Texto', 'Categoría', 'Fecha']}
              filas={tablaFueraDeGiro.map((d) => [d.textoOriginal, d.subtipo || '—', formatearFecha(d.fecha)])}
            />

            <Tabla
              titulo="Búsquedas no interpretadas / parciales recientes"
              subtitulo="Para mejorar la extracción de intención"
              columnas={['Texto', 'Estado', 'Fecha']}
              filas={tablaNoInterpretadas.map((d) => [d.textoOriginal, d.estado, formatearFecha(d.fecha)])}
            />
          </>
        )}
      </div>
    </main>
  );
}

function ContactoCard({ contacto, marcando, onMarcarAtendido }) {
  const atendido = Boolean(contacto.atendido);
  const numero = (contacto.contacto || '').replace(/\D/g, '');
  const whatsappHref = numero
    ? `https://wa.me/52${numero}?text=${encodeURIComponent(mensajeWhatsappCliente(contacto))}`
    : null;

  return (
    <div style={{
      backgroundColor: '#fff', borderRadius: '12px', padding: '14px 16px',
      boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
      borderLeft: atendido ? '4px solid #ccc' : '4px solid #E8720C',
      opacity: atendido ? 0.7 : 1,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px' }}>
        <div>
          <p style={{ fontWeight: '700', color: '#1A3C5E', fontSize: '15px', margin: 0 }}>
            📱 {contacto.contacto || '(sin contacto)'}
          </p>
          <p style={{ color: '#333', fontSize: '13px', margin: '4px 0 2px' }}>{queBuscaba(contacto)}</p>
          <p style={{ color: '#888', fontSize: '12px', margin: 0 }}>{formatearFecha(contacto.fecha)}</p>
        </div>
        {!atendido && (
          <span style={{ backgroundColor: '#FDECEA', color: '#C62828', fontSize: '11px', fontWeight: '700', padding: '3px 9px', borderRadius: '20px' }}>
            Sin atender
          </span>
        )}
      </div>
      <div style={{ display: 'flex', gap: '8px', marginTop: '10px', flexWrap: 'wrap' }}>
        {whatsappHref && (
          <a
            href={whatsappHref}
            target="_blank"
            rel="noopener noreferrer"
            style={{ backgroundColor: '#25D366', color: '#fff', fontSize: '13px', fontWeight: '700', padding: '8px 14px', borderRadius: '8px', textDecoration: 'none' }}
          >
            💬 WhatsApp
          </a>
        )}
        {atendido ? (
          <span style={{ color: '#888', fontSize: '13px', padding: '8px 0' }}>✓ Atendido</span>
        ) : (
          <button
            onClick={onMarcarAtendido}
            disabled={marcando}
            style={{ backgroundColor: '#1A3C5E', color: '#fff', fontSize: '13px', fontWeight: '700', padding: '8px 14px', borderRadius: '8px', border: 'none', cursor: marcando ? 'default' : 'pointer' }}
          >
            {marcando ? 'Marcando...' : 'Marcar como atendido'}
          </button>
        )}
      </div>
    </div>
  );
}

function MetricaCard({ label, valor, pct, color }) {
  return (
    <div style={{
      backgroundColor: '#fff', borderRadius: '12px', padding: '12px 16px',
      minWidth: '140px', flex: '1 1 140px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
    }}>
      <p style={{ color: '#888', fontSize: '12px', margin: '0 0 4px' }}>{label}</p>
      <p style={{ color: color || '#1A3C5E', fontSize: '22px', fontWeight: '700', margin: 0 }}>
        {valor}{typeof pct === 'number' ? <span style={{ fontSize: '13px', fontWeight: '600', marginLeft: '6px' }}>({pct}%)</span> : null}
      </p>
    </div>
  );
}

function Tabla({ titulo, subtitulo, columnas, filas }) {
  return (
    <div style={{ marginBottom: '28px' }}>
      <h2 style={{ color: '#1A3C5E', fontSize: '15px', margin: '0 0 2px' }}>{titulo}</h2>
      <p style={{ color: '#888', fontSize: '12px', margin: '0 0 10px' }}>{subtitulo}</p>
      <div style={{ overflow: 'hidden', borderRadius: '12px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: '#fff' }}>
          <thead>
            <tr style={{ backgroundColor: '#1A3C5E' }}>
              {columnas.map((c) => (
                <th key={c} style={{ color: '#fff', textAlign: 'left', padding: '10px 12px', fontSize: '12px', fontWeight: '600' }}>{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filas.length === 0 ? (
              <tr>
                <td colSpan={columnas.length} style={{ padding: '14px 12px', color: '#aaa', fontSize: '13px', textAlign: 'center' }}>
                  Sin datos todavía
                </td>
              </tr>
            ) : filas.map((fila, i) => (
              <tr key={i} style={{ backgroundColor: i % 2 === 0 ? '#fff' : '#F0F2F5' }}>
                {fila.map((valor, j) => (
                  <td key={j} style={{ padding: '10px 12px', fontSize: '13px', color: '#333' }}>{valor}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
