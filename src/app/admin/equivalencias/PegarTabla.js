'use client';

// "📋 Pegar tabla": varios registros de equivalencias de un jalón. Primero una vista previa (qué se
// va a guardar, qué ya existía y qué tiene problema); nada se guarda hasta tocar "Guardar".
import { useState } from 'react';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { COLECCION_EQUIVALENCIAS, MAX_RENGLONES_TABLA, parsearTabla } from '../../../lib/equivalencias';

const ESTILO_ESTADO = {
  ok: { texto: 'Se guarda', color: '#1E6B34', fondo: '#EAF6EE' },
  repetido: { texto: 'Ya registrado', color: '#555', fondo: '#F4F5F5' },
  error: { texto: 'Con problema', color: '#B3261E', fondo: '#FDECEA' },
};

export default function PegarTabla({ existentes, SelectorTipo, alGuardar }) {
  const [abierto, setAbierto] = useState(false);
  const [tipoPieza, setTipoPieza] = useState('');
  const [texto, setTexto] = useState('');
  const [vista, setVista] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [aviso, setAviso] = useState(null);

  const limpiarVista = () => { setVista(null); setAviso(null); };
  const visibles = vista ? vista.renglones.filter((r) => r.estado !== 'ignorado') : [];
  const porGuardar = visibles.filter((r) => r.estado === 'ok');

  async function guardar() {
    setGuardando(true);
    const guardados = [];
    try {
      for (const r of porGuardar) {
        const ref = await addDoc(collection(db, COLECCION_EQUIVALENCIAS), { ...r.datos, creadoAt: serverTimestamp() });
        guardados.push({ id: ref.id, ...r.datos }); // la fecha se ve al recargar
      }
      setAviso({ tipo: 'ok', texto: `Listo: se guardaron ${guardados.length} registros.` });
      setTexto(''); setVista(null);
    } catch (error) {
      console.error('[admin/equivalencias] Falló al guardar la tabla', error);
      setAviso({ tipo: 'error', texto: `Se guardaron ${guardados.length} de ${porGuardar.length}. Vuelve a ver la vista previa: los que ya se guardaron saldrán como "Ya registrado".` });
      setVista(null);
    }
    if (guardados.length) alGuardar(guardados);
    setGuardando(false);
  }

  if (!abierto) {
    return <button type="button" onClick={() => setAbierto(true)} style={{ ...botonSecundario, width: '100%', marginTop: '14px' }}>📋 Pegar tabla (varios registros a la vez)</button>;
  }

  return (
    <section aria-label="Pegar tabla" style={{ ...caja, marginTop: '14px' }}>
      <h2 style={titulo}>📋 Pegar tabla</h2>
      <p style={{ margin: '0 0 10px', fontSize: '13px', color: '#555', lineHeight: 1.5 }}>
        Copia la tabla de Google, Excel o una hoja de cálculo y pégala aquí. Cada renglón con dos o más números de parte se vuelve un registro; las demás columnas (modelo, años, motor) se guardan como nota. Máximo {MAX_RENGLONES_TABLA} renglones.
      </p>
      <label htmlFor="tabla-tipo" style={etiqueta}>Tipo de pieza (para toda la tabla)</label>
      <SelectorTipo id="tabla-tipo" valor={tipoPieza} alCambiar={(v) => { setTipoPieza(v); limpiarVista(); }} />
      <label htmlFor="tabla-texto" style={{ ...etiqueta, marginTop: '10px' }}>Tabla</label>
      <textarea id="tabla-texto" value={texto} onChange={(e) => { setTexto(e.target.value); limpiarVista(); }} rows={7} style={{ ...campo, fontFamily: 'monospace', fontSize: '13px', resize: 'vertical' }} />
      <div style={{ display: 'flex', gap: '8px', marginTop: '10px', flexWrap: 'wrap' }}>
        <button type="button" disabled={!texto.trim()} onClick={() => { setAviso(null); setVista(parsearTabla(texto, { tipoPieza, existentes })); }} style={botonPrincipal}>Ver vista previa</button>
        <button type="button" onClick={() => { setAbierto(false); setTexto(''); limpiarVista(); }} style={botonSecundario}>Cerrar</button>
      </div>

      {aviso && <p role={aviso.tipo === 'error' ? 'alert' : 'status'} style={{ margin: '12px 0 0', fontSize: '14px', fontWeight: '700', color: aviso.tipo === 'error' ? '#B3261E' : '#1E6B34' }}>{aviso.texto}</p>}

      {vista && (
        <div style={{ marginTop: '14px' }}>
          {vista.demasiados ? (
            <p role="alert" style={{ color: '#B3261E', fontWeight: '700', fontSize: '14px' }}>La tabla tiene más de {MAX_RENGLONES_TABLA} renglones. Pégala en partes.</p>
          ) : visibles.length === 0 ? (
            <p role="alert" style={{ color: '#B3261E', fontWeight: '700', fontSize: '14px' }}>No encontré números de parte. Revisa que copiaste la tabla con sus columnas.</p>
          ) : (
            <>
              <p style={{ margin: '0 0 8px', fontSize: '14px', color: '#1A3C5E', fontWeight: '700' }}>
                {porGuardar.length} por guardar · {visibles.filter((r) => r.estado === 'repetido').length} ya registrados · {visibles.filter((r) => r.estado === 'error').length} con problema
              </p>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: '8px' }}>
                {visibles.map((r) => {
                  const e = ESTILO_ESTADO[r.estado];
                  return (
                    <li key={r.numero} style={{ borderRadius: '10px', padding: '8px 10px', backgroundColor: e.fondo }}>
                      <p style={{ margin: 0, fontSize: '12px', fontWeight: '800', color: e.color }}>Renglón {r.numero} · {e.texto}{r.mensaje && r.estado === 'error' ? `: ${r.mensaje}` : ''}</p>
                      <p style={{ margin: '4px 0 0', fontFamily: 'monospace', fontSize: '14px', color: '#1A3C5E', wordBreak: 'break-word' }}>{r.partes.join(' = ')}</p>
                      {r.nota && <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#555', wordBreak: 'break-word' }}>Nota: {r.nota}</p>}
                    </li>
                  );
                })}
              </ul>
              <button type="button" disabled={guardando || porGuardar.length === 0} onClick={guardar} style={{ ...botonPrincipal, width: '100%', marginTop: '12px', opacity: porGuardar.length === 0 ? 0.5 : 1 }}>
                {guardando ? 'Guardando…' : `Guardar ${porGuardar.length} registros`}
              </button>
            </>
          )}
        </div>
      )}
    </section>
  );
}

const caja = { backgroundColor: '#fff', borderRadius: '16px', padding: '14px', boxShadow: '0 2px 10px rgba(26,60,94,0.06)' };
const titulo = { margin: '0 0 8px', fontSize: '16px', color: '#1A3C5E', fontWeight: '800' };
const etiqueta = { display: 'block', fontSize: '13px', color: '#555', fontWeight: '700', margin: '0 0 4px' };
const campo = { width: '100%', boxSizing: 'border-box', padding: '10px', fontSize: '16px', borderRadius: '10px', border: '1px solid #CCC', backgroundColor: '#fff', color: '#1A3C5E' };
const botonPrincipal = { padding: '10px 16px', borderRadius: '10px', border: 'none', backgroundColor: '#E8720C', color: '#fff', fontWeight: '800', fontSize: '14px', cursor: 'pointer' };
const botonSecundario = { padding: '10px 16px', borderRadius: '10px', border: '1px solid #1A3C5E', backgroundColor: '#fff', color: '#1A3C5E', fontWeight: '700', fontSize: '14px', cursor: 'pointer' };
