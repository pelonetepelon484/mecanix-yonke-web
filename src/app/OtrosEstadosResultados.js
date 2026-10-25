'use client';

// "Disponible en otros estados" (etapa 2): va debajo de la alerta de búsqueda cuando no hubo nada
// en el estado del cliente. Tarjetas agrupadas por estado ("📍 Sonora"), cada una con su aviso de
// envío. Las tarjetas las dibuja HomeClient (renderTarjeta), con las opciones de cada caso (ver
// lib/otrosEstadosPantalla.js). Sin grupos con tarjetas no dibuja nada.
// En el caso b (estado por IP) el título trae "¿No es tu zona? Elige tu estado": al elegir uno se
// pone en el selector y se repite la búsqueda (onElegirEstado).
// Scroll (config/buscador.scrollOtrosEstados, llega como info.scroll): una sola vez por búsqueda
// (numeroBusqueda), ya con las tarjetas dibujadas, hacia el encabezado; no al volver a dibujar.
import { useEffect, useRef, useState } from 'react';
import {
  TEXTO_ELIGE_ESTADO_OTROS, avisoTarjetaOtroEstado, opcionesTarjetaOtroEstado, tituloOtrosEstados,
} from '../lib/otrosEstadosPantalla';
import { desplazarHaciaOtrosEstados } from './lib/scrollOtrosEstados';

export default function OtrosEstadosResultados({ info, nombreEstadoCliente, renderTarjeta, estados = [], onElegirEstado, numeroBusqueda = 0 }) {
  const [eligiendo, setEligiendo] = useState(false);
  const encabezado = useRef(null);
  const ultimaDesplazada = useRef(null);
  const grupos = (info?.grupos || []).filter((g) => g.resultados?.length > 0);
  const conScroll = info?.scroll === true && grupos.length > 0;

  useEffect(() => {
    if (!conScroll || !numeroBusqueda || ultimaDesplazada.current === numeroBusqueda) return undefined;
    // Después de pintar (requestAnimationFrame). La marca se pone al desplazar, no antes: así, si
    // React corre el efecto dos veces (modo de desarrollo), la segunda vez sí desplaza.
    const id = requestAnimationFrame(() => {
      ultimaDesplazada.current = numeroBusqueda;
      desplazarHaciaOtrosEstados(encabezado.current);
    });
    return () => cancelAnimationFrame(id);
  }, [conScroll, numeroBusqueda]);

  if (grupos.length === 0) return null;
  const opciones = opcionesTarjetaOtroEstado(info.modo, info.busqueda);

  return (
    <section aria-label="Disponible en otros estados" style={caja}>
      <h3 ref={encabezado} style={titulo}>🌎 {tituloOtrosEstados(info.modo, nombreEstadoCliente)}</h3>
      {info.modo === 'b' && onElegirEstado && (
        eligiendo ? (
          <select
            aria-label="Elige tu estado" defaultValue="" className="mecanix-select" style={{ marginBottom: '12px' }}
            onChange={(e) => { if (e.target.value) onElegirEstado(e.target.value); }}
          >
            <option value="" disabled>Elige tu estado</option>
            {estados.map((e) => <option key={e.id} value={e.id}>{e.nombre}</option>)}
          </select>
        ) : (
          <button type="button" onClick={() => setEligiendo(true)} style={enlace}>{TEXTO_ELIGE_ESTADO_OTROS}</button>
        )
      )}
      {grupos.map((g) => (
        <div key={g.estado} style={{ marginTop: '12px' }}>
          <p style={etiquetaEstado}>📍 {g.estadoNombre}</p>
          {g.resultados.map((r, i) => (
            <div key={`${r.yonkeId}-${r.motorId ?? r.vehiculoId ?? i}`} style={{ marginBottom: '16px' }}>
              {renderTarjeta(r, `otro-estado-${g.estado}-${i}`, opciones)}
              <p style={aviso}>{avisoTarjetaOtroEstado(info.modo, r, g.estadoNombre)}</p>
            </div>
          ))}
        </div>
      ))}
    </section>
  );
}

const caja = { marginBottom: '12px' };
const titulo = { margin: '4px 0 8px', fontSize: '15px', fontWeight: '700', color: '#1A3C5E', lineHeight: '1.4' };
const enlace = { background: 'none', border: 'none', padding: 0, marginBottom: '8px', color: '#E8720C', fontSize: '13px', fontWeight: '700', textDecoration: 'underline', cursor: 'pointer' };
const etiquetaEstado = { margin: '0 0 8px', display: 'inline-block', padding: '4px 12px', borderRadius: '999px', backgroundColor: '#1A3C5E', color: '#fff', fontSize: '13px', fontWeight: '700' };
const aviso = { margin: '-6px 0 0', padding: '10px 14px', borderRadius: '12px', backgroundColor: '#FFF4E5', border: '1px solid #F2C9A0', color: '#7A4F00', fontSize: '12px', lineHeight: '1.5' };
