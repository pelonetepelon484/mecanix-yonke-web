'use client';

// Pantallas del comparador: captura (colores normales de Mecanix) -> "Analizando..." -> resultados
// (tema oscuro, ResultadosComparador.js). Todo en la misma página: los VIN nunca van en la dirección
// ni en el historial. El servidor (api/comparador) decodifica, limita y compara.
// Identificador del navegador: un número al azar en localStorage, solo para el límite diario (el
// servidor lo guarda como hash). Si el navegador no deja guardarlo, se compara igual (límite por IP).
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../lib/firebase';
import {
  AVISO_COMPARADOR, MENSAJES_COMPARADOR, TIPOS_PIEZA, normalizarVin, validarEntrada, vinValido,
} from '../../lib/comparadorPiezas';
import ResultadosComparador from './ResultadosComparador';
import { MONO } from './estilos';

const CLAVE_DISPOSITIVO = 'mecanixComparadorDispositivo';
const VACIO = { vinA: '', vinB: '', parteA: '', parteB: '', tipo: '' };
const ESPERA_MINIMA_MS = 1200; // la animación "Analizando" se ve al menos esto

function dispositivo() {
  try {
    let id = window.localStorage.getItem(CLAVE_DISPOSITIVO);
    if (!id || !/^[A-Za-z0-9_-]{16,64}$/.test(id)) {
      const bytes = crypto.getRandomValues(new Uint8Array(18));
      id = btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
      window.localStorage.setItem(CLAVE_DISPOSITIVO, id);
    }
    return id;
  } catch {
    return undefined;
  }
}

// Aviso al escribir el VIN: cuántos caracteres faltan o si trae I, O o Q.
export function ayudaVin(texto) {
  const v = normalizarVin(texto);
  if (!v) return '';
  if (/[IOQ]/.test(v)) return 'El VIN no lleva I, O ni Q (se confunden con 1 y 0).';
  if (v.length < 17) return `Faltan ${17 - v.length} caracteres.`;
  if (v.length > 17) return 'El VIN tiene 17 caracteres: sobran algunos.';
  return vinValido(v) ? '✓ Formato correcto' : 'Solo letras y números.';
}

function Campo({ id, etiqueta, valor, alCambiar, mono = false, ayuda = '', placeholder = '', maxLength }) {
  return (
    <div>
      <label htmlFor={id} style={etiquetaCampo}>{etiqueta}</label>
      <input
        id={id} value={valor} onChange={(e) => alCambiar(e.target.value)} placeholder={placeholder} maxLength={maxLength}
        autoCapitalize="characters" autoCorrect="off" spellCheck={false}
        style={{ ...campo, ...(mono ? { fontFamily: MONO, letterSpacing: '1px', textTransform: 'uppercase' } : {}) }}
      />
      {ayuda && <p style={{ margin: '4px 0 0', fontSize: '12px', color: ayuda.startsWith('✓') ? '#1E6B34' : '#B3261E' }}>{ayuda}</p>}
    </div>
  );
}

export default function ComparadorClient({ requiereLogin = false, conTalleres = true }) {
  const [f, setF] = useState(VACIO);
  const [pantalla, setPantalla] = useState('captura'); // captura | analizando | resultados
  const [resultado, setResultado] = useState(null);
  const [error, setError] = useState(null); // { mensaje, limite?, conCuenta?, requiereLogin? }
  const [usuario, setUsuario] = useState(null);

  useEffect(() => onAuthStateChanged(auth, setUsuario), []);

  const cambiar = (campo) => (valor) => { setF((x) => ({ ...x, [campo]: valor })); setError(null); };

  async function comparar(e) {
    e.preventDefault();
    const r = validarEntrada(f);
    if (!r.ok) { setError({ mensaje: r.mensaje }); return; }
    setPantalla('analizando'); setError(null);
    const inicio = Date.now();
    try {
      const headers = { 'Content-Type': 'application/json' };
      const token = usuario ? await usuario.getIdToken().catch(() => null) : null;
      if (token) headers.Authorization = `Bearer ${token}`;
      const res = await fetch('/api/comparador', { method: 'POST', headers, body: JSON.stringify({ ...r.datos, dispositivo: dispositivo() }), cache: 'no-store' });
      const json = await res.json().catch(() => ({}));
      await new Promise((ok) => { setTimeout(ok, Math.max(0, ESPERA_MINIMA_MS - (Date.now() - inicio))); });
      if (!res.ok) {
        setError({ mensaje: json.error || MENSAJES_COMPARADOR.fallo, limite: json.limite, conCuenta: json.conCuenta, requiereLogin: json.requiereLogin });
        setPantalla('captura');
        return;
      }
      setResultado(json);
      setPantalla('resultados');
      window.scrollTo?.({ top: 0 });
    } catch {
      setError({ mensaje: MENSAJES_COMPARADOR.fallo });
      setPantalla('captura');
    }
  }

  function nueva() {
    setPantalla('captura'); setResultado(null); setError(null); setF(VACIO);
  }

  if (pantalla !== 'captura') {
    return <ResultadosComparador analizando={pantalla === 'analizando'} resultado={resultado} alNueva={nueva} alEditar={() => setPantalla('captura')} />;
  }

  return (
    <main style={{ minHeight: '100vh', backgroundColor: '#F0F2F5', padding: '24px 16px 40px', fontFamily: "'Inter', sans-serif" }}>
      <div style={{ maxWidth: '620px', margin: '0 auto' }}>
        <Link href="/" style={{ color: '#1A3C5E', fontWeight: '700', fontSize: '14px', textDecoration: 'none' }}>← Red Mecanix</Link>
        <h1 style={{ fontSize: '24px', color: '#1A3C5E', fontWeight: '800', margin: '12px 0 6px' }}>🔎 Comparador de compatibilidad</h1>
        <p style={{ fontSize: '15px', color: '#1A3C5E', lineHeight: '1.5', margin: '0 0 14px' }}>
          Compara el VIN (número de serie) o el número de parte de dos vehículos y mira si la pieza les queda a los dos.
        </p>
        <p role="note" style={aviso}>⚠️ {AVISO_COMPARADOR}</p>
        {requiereLogin && !usuario && <p style={{ ...aviso, backgroundColor: '#EEF2F7', borderColor: '#1A3C5E' }}>{MENSAJES_COMPARADOR.login}</p>}

        <form onSubmit={comparar} noValidate style={caja} aria-label="Comparar piezas">
          <label htmlFor="cp-tipo" style={etiquetaCampo}>Tipo de pieza</label>
          <select id="cp-tipo" value={f.tipo} onChange={(e) => cambiar('tipo')(e.target.value)} style={campo}>
            <option value="">Escoge una pieza</option>
            {TIPOS_PIEZA.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
          </select>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '14px', marginTop: '14px' }}>
            <fieldset style={lado}>
              <legend style={leyenda}>Vehículo A</legend>
              <Campo id="cp-vin-a" etiqueta="VIN (17 caracteres)" valor={f.vinA} alCambiar={cambiar('vinA')} mono maxLength={20} ayuda={ayudaVin(f.vinA)} placeholder="Opcional" />
              <Campo id="cp-parte-a" etiqueta="Número de parte" valor={f.parteA} alCambiar={cambiar('parteA')} mono maxLength={50} placeholder="Opcional" />
            </fieldset>
            <fieldset style={lado}>
              <legend style={leyenda}>Vehículo B</legend>
              <Campo id="cp-vin-b" etiqueta="VIN (17 caracteres)" valor={f.vinB} alCambiar={cambiar('vinB')} mono maxLength={20} ayuda={ayudaVin(f.vinB)} placeholder="Opcional" />
              <Campo id="cp-parte-b" etiqueta="Número de parte" valor={f.parteB} alCambiar={cambiar('parteB')} mono maxLength={50} placeholder="Opcional" />
            </fieldset>
          </div>
          <p style={{ fontSize: '12px', color: '#555', margin: '10px 0 0', lineHeight: 1.5 }}>
            Escribe al menos un dato de cada vehículo. El VIN viene en la tarjeta de circulación o en la base del parabrisas. Del VIN solo usamos la parte que describe el modelo: el número de serie no se guarda.
          </p>

          {error && (
            <div role="alert" style={{ marginTop: '12px', padding: '12px', borderRadius: '12px', backgroundColor: error.limite ? '#FFF4E8' : '#FDECEA', color: '#1A3C5E', fontSize: '14px', lineHeight: 1.5 }}>
              {error.mensaje}
              {(error.requiereLogin || (error.limite && !error.conCuenta)) && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '10px' }}>
                  <Link href="/panel" style={botonChico}>Iniciar sesión</Link>
                  <Link href="/panel/registro" style={botonChico}>Registrar mi yonke</Link>
                  {conTalleres && <Link href="/panel/taller/registro" style={botonChico}>Registrar mi taller</Link>}
                </div>
              )}
            </div>
          )}
          <button type="submit" style={botonPrincipal}>🔎 Comparar</button>
        </form>
      </div>
    </main>
  );
}

const aviso = { margin: '0 0 14px', padding: '12px 14px', borderRadius: '12px', backgroundColor: '#FFF4E8', border: '1.5px solid #E8720C', color: '#1A3C5E', fontSize: '14px', lineHeight: '1.5', fontWeight: '600' };
const caja = { backgroundColor: '#fff', borderRadius: '18px', padding: '16px', boxShadow: '0 4px 16px rgba(26,60,94,0.08)' };
const lado = { border: '1px solid #E3EAF2', borderRadius: '14px', padding: '10px 12px 12px', margin: 0, minWidth: 0, display: 'grid', gap: '8px' };
const leyenda = { fontSize: '13px', fontWeight: '800', color: '#E8720C', padding: '0 6px', textTransform: 'uppercase', letterSpacing: '1px' };
const etiquetaCampo = { display: 'block', fontSize: '13px', color: '#555', fontWeight: '700', margin: '0 0 4px' };
const campo = { width: '100%', boxSizing: 'border-box', padding: '11px', fontSize: '16px', borderRadius: '10px', border: '1px solid #CCC', backgroundColor: '#fff', color: '#1A3C5E' };
const botonPrincipal = { width: '100%', marginTop: '16px', minHeight: '56px', borderRadius: '14px', border: 'none', backgroundColor: '#E8720C', color: '#fff', fontSize: '18px', fontWeight: '800', cursor: 'pointer' };
const botonChico = { display: 'inline-block', padding: '8px 12px', borderRadius: '10px', border: '1px solid #1A3C5E', color: '#1A3C5E', fontWeight: '700', fontSize: '13px', textDecoration: 'none', backgroundColor: '#fff' };
