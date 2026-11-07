'use client';

// Lista pública de /asistencia-vial: filtros (ciudad, servicio, 24 horas) en el navegador sobre lo
// que ya mandó el servidor, sin lecturas nuevas. Cada tarjeta: Llamar (tel:) y WhatsApp (wa.me con
// el mensaje escrito), con su contador. El sello "Documentos en regla" es distinto de la insignia
// "Verificado" de los yonkes (otro nombre, otro color y otro ícono).
import { useState } from 'react';
import Link from 'next/link';
import { registrarContactoAsistencia } from '../lib/registrarContactoAsistencia';
import MapaAsistencia from './MapaAsistencia';
import {
  AVISO_ASISTENCIA, CIUDADES_ASISTENCIA, TIPOS_SERVICIO, enlaceLlamar, enlaceWhatsappAsistencia, etiquetaCiudad, etiquetaGrua,
  etiquetaServicio, ordenarProveedores, selloVigente, textoSello,
} from '../../lib/asistenciaVial';

export const TITULO_ASISTENCIA = 'Asistencia vial';
export const ENTRADA_ASISTENCIA = 'Grúas, llanteras y ayuda en carretera en Baja California. Llama o escribe directo al proveedor.';
export const textoVacio = (ciudad) => (ciudad
  ? `Aún no hay proveedores colaboradores de la red Mecanix en ${etiquetaCiudad(ciudad)} con esos filtros.`
  : 'Aún no hay proveedores colaboradores de la red Mecanix con esos filtros.');

function Tarjeta({ p, ahoraMs, extra = '' }) {
  const sello = selloVigente(p, ahoraMs);
  return (
    <li style={tarjeta}>
      <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
        {p.logoUrl && (
          // eslint-disable-next-line @next/next/no-img-element -- logo chico de Storage, igual que en las tarjetas de yonkes
          <img src={p.logoUrl} alt="" width={52} height={52} style={{ width: '52px', height: '52px', objectFit: 'contain', borderRadius: '10px', flexShrink: 0 }} />
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <h3 style={{ margin: 0, fontSize: '17px', color: '#1A3C5E', fontWeight: '800', lineHeight: '1.3' }}>{p.nombre}</h3>
          {extra && <p style={{ margin: '4px 0 0', fontSize: '14px', color: '#E8720C', fontWeight: '800' }}>📍 {extra}</p>}
          {sello && <span style={selloDocumentos}>📄 {textoSello(p)}</span>}
        </div>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', margin: '10px 0 6px' }}>
        {p.servicios.map((s) => <span key={s} style={chip}>{etiquetaServicio(s)}</span>)}
      </div>
      {p.tiposGrua.length > 0 && <p style={linea}>🚛 Grúa: {p.tiposGrua.map(etiquetaGrua).join(', ')}</p>}
      <p style={linea}>📍 {p.ciudades.map(etiquetaCiudad).join(', ')}</p>
      <p style={linea}>{p.atiende24h ? <strong style={{ color: '#E8720C' }}>🕒 24 horas</strong> : `🕒 ${p.horario}`}</p>
      {p.descripcion && <p style={{ ...linea, color: '#555' }}>{p.descripcion}</p>}
      <div style={{ display: 'grid', gridTemplateColumns: p.whatsapp ? '1fr 1fr' : '1fr', gap: '10px', marginTop: '12px' }}>
        <a href={enlaceLlamar(p.telefono)} onClick={() => registrarContactoAsistencia(p.id, 'llamadas')} style={botonLlamar}>📞 Llamar</a>
        {p.whatsapp && (
          <a href={enlaceWhatsappAsistencia(p.whatsapp)} target="_blank" rel="noopener noreferrer" onClick={() => registrarContactoAsistencia(p.id, 'whatsapp')} style={botonWhatsapp}>💬 WhatsApp</a>
        )}
      </div>
    </li>
  );
}

function Lista({ titulo, proveedores, ahoraMs }) {
  return (
    <section style={{ marginTop: '18px' }}>
      {titulo && <h2 style={subtitulo}>{titulo}</h2>}
      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: '12px' }}>
        {proveedores.map((p) => <Tarjeta key={p.id} p={p} ahoraMs={ahoraMs} />)}
      </ul>
    </section>
  );
}

// mapa: config/portada.asistenciaVialMapa (etapa 2). Apagada, la página queda igual que antes.
export default function AsistenciaVialClient({ proveedores = [], ahoraMs, mapa = false }) {
  const [ciudad, setCiudad] = useState('');
  const [servicio, setServicio] = useState('');
  const [solo24h, setSolo24h] = useState(false);
  const { enCiudad, cercanos } = ordenarProveedores(proveedores, { ciudad, servicio, solo24h }, ahoraMs);

  return (
    <main style={{ minHeight: '100vh', backgroundColor: '#F0F2F5', padding: '24px 16px 40px', fontFamily: "'Inter', sans-serif" }}>
      <div style={{ maxWidth: '620px', margin: '0 auto' }}>
        <Link href="/" style={{ color: '#1A3C5E', fontWeight: '700', fontSize: '14px', textDecoration: 'none' }}>← Red Mecanix</Link>
        <h1 style={{ fontSize: '26px', color: '#1A3C5E', fontWeight: '800', margin: '12px 0 6px' }}>🚨 {TITULO_ASISTENCIA}</h1>
        <p style={{ fontSize: '15px', color: '#1A3C5E', lineHeight: '1.5', margin: '0 0 14px' }}>{ENTRADA_ASISTENCIA}</p>

        <p role="note" style={aviso}>{AVISO_ASISTENCIA}</p>

        {mapa && <MapaAsistencia proveedores={proveedores} Tarjeta={Tarjeta} ahoraMs={ahoraMs} />}

        <div style={filtros}>
          <label style={etiqueta} htmlFor="av-ciudad">Ciudad</label>
          <select id="av-ciudad" value={ciudad} onChange={(e) => setCiudad(e.target.value)} style={campo}>
            <option value="">Todas las ciudades</option>
            {CIUDADES_ASISTENCIA.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
          </select>
          <label style={etiqueta} htmlFor="av-servicio">Servicio</label>
          <select id="av-servicio" value={servicio} onChange={(e) => setServicio(e.target.value)} style={campo}>
            <option value="">Todos los servicios</option>
            {TIPOS_SERVICIO.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
          </select>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '15px', color: '#1A3C5E', fontWeight: '700', marginTop: '12px', cursor: 'pointer' }}>
            <input type="checkbox" checked={solo24h} onChange={(e) => setSolo24h(e.target.checked)} style={{ width: '20px', height: '20px' }} />
            Atiende 24 horas
          </label>
        </div>

        {enCiudad.length > 0
          ? <Lista titulo={ciudad ? `En ${etiquetaCiudad(ciudad)}` : null} proveedores={enCiudad} ahoraMs={ahoraMs} />
          : <p role="status" style={vacio}>{textoVacio(ciudad)}</p>}
        {cercanos.length > 0 && <Lista titulo={`Cerca de ${etiquetaCiudad(ciudad)}`} proveedores={cercanos} ahoraMs={ahoraMs} />}
      </div>
    </main>
  );
}

// Colores de Red Mecanix: azul marino #1A3C5E, naranja #E8720C, blanco.
const tarjeta = { backgroundColor: '#fff', borderRadius: '18px', padding: '16px', boxShadow: '0 4px 16px rgba(26,60,94,0.08)' };
const chip = { backgroundColor: '#EEF2F7', color: '#1A3C5E', fontSize: '12px', fontWeight: '700', padding: '4px 10px', borderRadius: '12px' };
const linea = { margin: '4px 0 0', fontSize: '14px', color: '#1A3C5E', lineHeight: '1.45' };
const botonBase = { display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '52px', borderRadius: '14px', color: '#fff', fontSize: '17px', fontWeight: '800', textDecoration: 'none' };
const botonLlamar = { ...botonBase, backgroundColor: '#1A3C5E' };
const botonWhatsapp = { ...botonBase, backgroundColor: '#25D366' };
// Distinto del "✓ Verificado" verde de los yonkes: azul marino sobre crema, con borde naranja.
const selloDocumentos = { display: 'inline-block', marginTop: '6px', backgroundColor: '#FFF4E8', color: '#1A3C5E', border: '1.5px solid #E8720C', fontSize: '12px', fontWeight: '700', padding: '3px 10px', borderRadius: '12px' };
const aviso = { margin: '0 0 14px', padding: '12px 14px', borderRadius: '12px', backgroundColor: '#FFF4E8', border: '1.5px solid #E8720C', color: '#1A3C5E', fontSize: '14px', lineHeight: '1.5', fontWeight: '600' };
const filtros = { backgroundColor: '#fff', borderRadius: '18px', padding: '14px 16px 16px', boxShadow: '0 4px 16px rgba(26,60,94,0.06)' };
const etiqueta = { display: 'block', fontSize: '13px', color: '#555', fontWeight: '700', margin: '8px 0 4px' };
const campo = { width: '100%', boxSizing: 'border-box', padding: '11px', fontSize: '15px', borderRadius: '10px', border: '1px solid #CCC', backgroundColor: '#fff', color: '#1A3C5E' };
const subtitulo = { fontSize: '15px', color: '#1A3C5E', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.5px', margin: '0 0 10px' };
const vacio = { marginTop: '18px', padding: '18px', borderRadius: '14px', backgroundColor: '#fff', color: '#1A3C5E', fontSize: '15px', textAlign: 'center', lineHeight: '1.5' };
