'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useContactos } from './contexto';
import { buscarContactos, listarContactos, lugaresOcupados } from './datos';
import {
  LIMITE_CONTACTOS_BASICO, MENSAJES_CONTACTO, TEXTO_RETENCION_CONTACTO, coincide, esRanuraBasico, nombreVehiculoContacto, textoLugares,
} from '../../../../lib/contactosTaller';
import { URL_QUIERO_PREMIUM_TALLER } from '../../../../lib/planes';
import { AvisoPremium } from '../../CandadoPremium';

const telefonoBonito = (t) => (t && t.length === 10 ? `${t.slice(0, 3)} ${t.slice(3, 6)} ${t.slice(6)}` : '');

// Lista de contactos (A-Z, de 50 en 50) con buscador. Si toda la lista ya está en pantalla, el
// buscador filtra ahí mismo (sin lecturas); si hay más, busca en Firestore al tocar "Buscar".
// Plan Básico: "Usas N de 25 lugares" y, con los 25 ocupados, el aviso de Premium.
export default function ContactosPage() {
  const router = useRouter();
  const { tallerId, premium, puedeEscribir } = useContactos();
  const [items, setItems] = useState(null);
  const [cursor, setCursor] = useState(null);
  const [hayMas, setHayMas] = useState(false);
  const [ocupados, setOcupados] = useState(null);
  const [texto, setTexto] = useState('');
  const [resultados, setResultados] = useState(null);
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);

  useEffect(() => {
    let cancelado = false;
    listarContactos(tallerId)
      .then(async (r) => {
        if (cancelado) return;
        setItems(r.items); setCursor(r.cursor); setHayMas(r.hayMas);
        if (premium) return;
        // Lugares ocupados: con la lista completa se cuentan aquí; si no, una consulta aparte.
        const n = r.hayMas ? (await lugaresOcupados(tallerId)).length : r.items.filter((c) => esRanuraBasico(c.id)).length;
        if (!cancelado) setOcupados(n);
      })
      .catch((err) => { console.error(err); if (!cancelado) setError('No pudimos cargar tus contactos. Intenta de nuevo.'); });
    return () => { cancelado = true; };
  }, [tallerId, premium]);

  async function verMas() {
    setCargando(true);
    try {
      const r = await listarContactos(tallerId, cursor);
      setItems((prev) => [...prev, ...r.items]); setCursor(r.cursor); setHayMas(r.hayMas);
    } catch (err) {
      console.error(err);
      setError('No pudimos cargar más contactos. Intenta de nuevo.');
    } finally {
      setCargando(false);
    }
  }

  async function buscar(e) {
    e.preventDefault();
    if (!hayMas) return;
    if (!texto.trim()) { setResultados(null); return; }
    setCargando(true);
    try {
      setResultados(await buscarContactos(tallerId, texto));
    } catch (err) {
      console.error(err);
      setError('No pudimos buscar. Intenta de nuevo.');
    } finally {
      setCargando(false);
    }
  }

  const lleno = !premium && ocupados !== null && ocupados >= LIMITE_CONTACTOS_BASICO;
  const visibles = items && (hayMas ? (resultados ?? items) : items.filter((c) => coincide(c, texto)));

  return (
    <main style={{ minHeight: '100vh', backgroundColor: '#F4F5F5', padding: '16px' }}>
      <div style={{ maxWidth: '560px', margin: '0 auto' }}>
        <button type="button" onClick={() => router.push('/panel/taller')} style={volver}>← Inicio del taller</button>
        <h1 style={{ fontSize: '22px', color: '#1A3C5E', margin: '8px 0 6px' }}>Contactos</h1>
        <p style={{ fontSize: '13px', color: '#555', margin: '0 0 8px' }}>{TEXTO_RETENCION_CONTACTO}</p>
        <p style={{ fontSize: '14px', color: '#1A3C5E', fontWeight: '600', margin: '0 0 12px' }}>
          {premium ? 'Plan Premium: contactos sin límite.' : (ocupados !== null ? textoLugares(ocupados) : '')}
        </p>
        {lleno && <AvisoPremium descripcion={MENSAJES_CONTACTO.lleno} ubicacion="contactos_taller" url={URL_QUIERO_PREMIUM_TALLER} />}
        {puedeEscribir && !lleno && (
          <button type="button" onClick={() => router.push('/panel/taller/contactos/nuevo')} style={agregar}>＋ Agregar contacto</button>
        )}

        <form onSubmit={buscar} role="search" style={{ display: 'flex', gap: '8px', margin: '12px 0' }}>
          <input
            aria-label="Buscar por nombre, WhatsApp o placas" placeholder="Buscar por nombre, WhatsApp o placas"
            value={texto} onChange={(e) => { setTexto(e.target.value); if (!e.target.value) setResultados(null); }} style={campo}
          />
          {hayMas && <button type="submit" disabled={cargando} style={botonBuscar}>Buscar</button>}
        </form>

        {error && <p role="alert" style={{ color: '#B3261E' }}>{error}</p>}
        {!error && items === null && <p style={{ color: '#555' }}>Cargando...</p>}
        {items && items.length === 0 && <p style={{ color: '#555' }}>Todavía no tienes contactos.</p>}
        {visibles && items.length > 0 && visibles.length === 0 && <p style={{ color: '#555' }}>No encontramos contactos con esa búsqueda.</p>}
        {visibles && visibles.map((c) => (
          <button key={c.id} type="button" onClick={() => router.push(`/panel/taller/contactos/${c.id}`)} style={tarjeta}>
            <strong style={{ display: 'block', color: '#1A3C5E', fontSize: '16px' }}>{c.nombre}</strong>
            {c.telefono && <span style={{ display: 'block', color: '#333' }}>📱 {telefonoBonito(c.telefono)}</span>}
            {(c.vehiculos ?? []).map((v, i) => <span key={i} style={{ display: 'block', fontSize: '13px', color: '#555' }}>🚗 {nombreVehiculoContacto(v)}</span>)}
          </button>
        ))}
        {hayMas && resultados === null && (
          <button type="button" onClick={verMas} disabled={cargando} style={verMasStyle}>{cargando ? 'Cargando...' : 'Ver más'}</button>
        )}
      </div>
    </main>
  );
}

const volver = { background: 'none', border: 'none', color: '#1A3C5E', fontWeight: '600', cursor: 'pointer', padding: 0, fontSize: '14px' };
const agregar = { width: '100%', minHeight: '52px', borderRadius: '12px', border: 'none', backgroundColor: '#E8720C', color: '#fff', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer' };
const campo = { flex: 1, minWidth: 0, boxSizing: 'border-box', padding: '12px', fontSize: '16px', borderRadius: '10px', border: '1px solid #CCC' };
const botonBuscar = { minHeight: '46px', padding: '0 16px', borderRadius: '10px', border: 'none', backgroundColor: '#1A3C5E', color: '#fff', fontWeight: 'bold', cursor: 'pointer' };
const tarjeta = { display: 'block', width: '100%', textAlign: 'left', backgroundColor: '#fff', border: '1px solid #E3E3E3', borderRadius: '14px', padding: '14px', marginBottom: '10px', cursor: 'pointer', fontSize: '14px' };
const verMasStyle = { width: '100%', minHeight: '48px', borderRadius: '12px', border: '1px solid #1A3C5E', backgroundColor: '#fff', color: '#1A3C5E', fontWeight: 'bold', cursor: 'pointer' };
