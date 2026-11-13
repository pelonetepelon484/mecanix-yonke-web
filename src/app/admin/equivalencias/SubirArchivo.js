'use client';

// "📁 Subir archivo": muchos registros de un jalón (cada renglón dice su tipo de pieza). Vista previa
// con conteos; nada se guarda hasta tocar "Guardar". Se guarda en lotes (writeBatch) de 400, con ID
// fijo por registro: subir el mismo archivo otra vez sobrescribe en lugar de duplicar.
import { useState } from 'react';
import { doc, serverTimestamp, writeBatch } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { etiquetaTipoPieza } from '../../../lib/comparadorPiezas';
import { COLECCION_EQUIVALENCIAS, MAX_RENGLONES_ARCHIVO, idEquivalencia, parsearArchivo } from '../../../lib/equivalencias';

const LOTE = 400;

export default function SubirArchivo({ existentes, alGuardar }) {
  const [abierto, setAbierto] = useState(false);
  const [vista, setVista] = useState(null);
  const [nombre, setNombre] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [avance, setAvance] = useState(0);
  const [aviso, setAviso] = useState(null);

  const porGuardar = vista ? vista.renglones.filter((r) => r.estado === 'ok') : [];
  const errores = vista ? vista.renglones.filter((r) => r.estado === 'error') : [];
  const repetidos = vista ? vista.renglones.filter((r) => r.estado === 'repetido').length : 0;
  const porTipo = porGuardar.reduce((m, r) => ({ ...m, [r.tipo]: (m[r.tipo] || 0) + 1 }), {});

  async function leer(e) {
    const archivo = e.target.files?.[0];
    setAviso(null); setVista(null);
    if (!archivo) return;
    setNombre(archivo.name);
    setVista(parsearArchivo(await archivo.text(), { existentes }));
  }

  async function guardar() {
    setGuardando(true); setAvance(0);
    const guardados = [];
    try {
      for (let i = 0; i < porGuardar.length; i += LOTE) {
        const lote = writeBatch(db);
        const nuevos = porGuardar.slice(i, i + LOTE).map((r) => {
          const ref = doc(db, COLECCION_EQUIVALENCIAS, idEquivalencia(r.datos.tipoPieza, r.datos.partes));
          lote.set(ref, { ...r.datos, creadoAt: serverTimestamp() });
          return { id: ref.id, ...r.datos };
        });
        await lote.commit();
        guardados.push(...nuevos);
        setAvance(guardados.length);
      }
      setAviso({ tipo: 'ok', texto: `Listo: se guardaron ${guardados.length} registros.` });
      setVista(null);
    } catch (error) {
      console.error('[admin/equivalencias] Falló al guardar el archivo', error);
      setAviso({ tipo: 'error', texto: `Se guardaron ${guardados.length} de ${porGuardar.length}. Vuelve a subir el mismo archivo: lo ya guardado saldrá como "Ya registrado".` });
      setVista(null);
    }
    if (guardados.length) alGuardar(guardados);
    setGuardando(false);
  }

  if (!abierto) {
    return <button type="button" onClick={() => setAbierto(true)} style={{ ...botonSecundario, width: '100%', marginTop: '10px' }}>📁 Subir archivo (cientos de registros a la vez)</button>;
  }

  return (
    <section aria-label="Subir archivo" style={{ ...caja, marginTop: '14px' }}>
      <h2 style={titulo}>📁 Subir archivo</h2>
      <p style={{ margin: '0 0 10px', fontSize: '13px', color: '#555', lineHeight: 1.5 }}>
        Archivo de texto con un registro por renglón: <code>tipo | nota | número, número, …</code>. Tipos: computadora, tcm, bcm, cluster, motor, transmision. Máximo {MAX_RENGLONES_ARCHIVO} renglones.
      </p>
      <label htmlFor="archivo-equivalencias" style={etiqueta}>Archivo</label>
      <input id="archivo-equivalencias" type="file" accept=".txt,.csv,.tsv,text/plain" onChange={leer} disabled={guardando} />
      <div style={{ marginTop: '10px' }}>
        <button type="button" onClick={() => { setAbierto(false); setVista(null); setAviso(null); }} style={botonSecundario} disabled={guardando}>Cerrar</button>
      </div>

      {aviso && <p role={aviso.tipo === 'error' ? 'alert' : 'status'} style={{ margin: '12px 0 0', fontSize: '14px', fontWeight: '700', color: aviso.tipo === 'error' ? '#B3261E' : '#1E6B34' }}>{aviso.texto}</p>}

      {vista && (
        <div style={{ marginTop: '14px' }}>
          {vista.demasiados ? (
            <p role="alert" style={{ color: '#B3261E', fontWeight: '700', fontSize: '14px' }}>El archivo tiene más de {MAX_RENGLONES_ARCHIVO} renglones. Pártelo en dos.</p>
          ) : (
            <>
              <p style={{ margin: '0 0 6px', fontSize: '14px', color: '#1A3C5E', fontWeight: '700' }}>
                {nombre}: {porGuardar.length} por guardar · {repetidos} ya registrados · {errores.length} con problema
              </p>
              {porGuardar.length > 0 && (
                <ul style={{ margin: '0 0 8px', paddingLeft: '18px', fontSize: '13px', color: '#333' }}>
                  {Object.entries(porTipo).map(([t, n]) => <li key={t}>{etiquetaTipoPieza(t)}: {n}</li>)}
                </ul>
              )}
              {errores.length > 0 && (
                <ul aria-label="Renglones con problema" style={{ margin: '0 0 8px', paddingLeft: '18px', fontSize: '12px', color: '#B3261E' }}>
                  {errores.slice(0, 30).map((r) => <li key={r.numero}>Renglón {r.numero}: {r.mensaje}</li>)}
                  {errores.length > 30 && <li>…y {errores.length - 30} más.</li>}
                </ul>
              )}
              <button type="button" disabled={guardando || porGuardar.length === 0} onClick={guardar} style={{ ...botonPrincipal, width: '100%', opacity: porGuardar.length === 0 ? 0.5 : 1 }}>
                {guardando ? `Guardando… ${avance} de ${porGuardar.length}` : `Guardar ${porGuardar.length} registros`}
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
const botonPrincipal = { padding: '10px 16px', borderRadius: '10px', border: 'none', backgroundColor: '#E8720C', color: '#fff', fontWeight: '800', fontSize: '14px', cursor: 'pointer' };
const botonSecundario = { padding: '10px 16px', borderRadius: '10px', border: '1px solid #1A3C5E', backgroundColor: '#fff', color: '#1A3C5E', fontWeight: '700', fontSize: '14px', cursor: 'pointer' };
