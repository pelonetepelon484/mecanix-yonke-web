'use client';

// Pantalla de /bienvenida (page.js decide si existe y le pasa las banderas). Una columna, primero
// celular. Textos nuevos en lib/textosBienvenida.js; planes, los mismos componentes y textos de la
// portada (TarjetasPlanes.js, lib/planes.js). Selector "Soy yonke / Soy taller / Soy cliente": cambia
// los pasos y los planes ("Soy taller" solo con talleres). Eventos de Google Analytics:
// clic_registro, contacto_mecanix, clic_premium (ubicacion "bienvenida") y bienvenida_selector.
import { useState } from 'react';
import Link from 'next/link';
import {
  ASI_FUNCIONA, AVISO_PROVISIONAL, BOTON_REGISTRO_PLANES, HERO, LLAMADA_FINAL, PIE, PREGUNTAS_FRECUENTES, PRIMEROS_PASOS, TEXTOS_APROBADOS,
  TITULO_PLANES_YONKE, TITULO_PROXIMAMENTE, WHATSAPP_MECANIX, pasosVisibles,
} from '../../lib/textosBienvenida';
import {
  TarjetaBasicoYonke, TarjetaCapturaDomicilio, TarjetaPremiumYonke, TarjetasPlanesTaller, gridPlanesStyle, gridTresPlanesStyle,
} from '../TarjetasPlanes';
import { ProximamenteMecanix } from '../EcosistemaMecanix';

export const REGISTRO_YONKE = '/panel/registro?desde=bienvenida';
export const REGISTRO_TALLER = '/panel/taller/registro?desde=bienvenida';
const UBICACION = 'bienvenida';

function registrarEvento(nombre, params = {}) {
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('event', nombre, params);
  }
}

const clicRegistro = (tipo, ubicacion) => () => registrarEvento('clic_registro', { tipo, ubicacion });

// "Baja California", "Baja California y Sonora", "A, B y C".
export function listaConY(nombres) {
  if (nombres.length <= 1) return nombres[0] || '';
  return `${nombres.slice(0, -1).join(', ')} y ${nombres[nombres.length - 1]}`;
}

export default function BienvenidaClient({ talleres = false, planes, banderas, estadosConVisitas = [], buscadorRefacciones = false }) {
  const [tipo, setTipo] = useState('yonke');
  const opciones = ['yonke', ...(talleres ? ['taller'] : []), 'cliente'];

  function elegir(nuevo, origen = 'selector') {
    setTipo(nuevo);
    registrarEvento('bienvenida_selector', { tipo: nuevo, origen });
  }

  const pasos = pasosVisibles(PRIMEROS_PASOS[tipo], banderas || {});
  const conPremium = planes?.limitesActivos === true;
  const conCaptura = estadosConVisitas.length > 0;

  return (
    <main style={{ minHeight: '100vh', backgroundColor: '#F0F2F5', padding: '16px 16px 32px', fontFamily: "'Inter', sans-serif" }}>
      <div style={{ maxWidth: '620px', margin: '0 auto' }}>
        {!TEXTOS_APROBADOS && <p role="note" style={avisoProvisional}>{AVISO_PROVISIONAL}</p>}

        <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginBottom: '28px' }}>
          <Link href="/" style={{ flex: '1 1 auto', minWidth: 0, maxWidth: '260px' }}>
            <img
              src="/logo-mecanix-red-yonkes.webp" alt="Mecanix, motor de búsqueda de autopartes, red de yonkes de México"
              width={900} height={318} style={{ width: '100%', height: 'auto', display: 'block' }}
            />
          </Link>
          <a
            href={WHATSAPP_MECANIX.url} target="_blank" rel="noopener noreferrer" style={botonWhatsapp}
            aria-label={`WhatsApp ${WHATSAPP_MECANIX.numero}`}
            onClick={() => registrarEvento('contacto_mecanix', { medio: 'whatsapp', ubicacion: 'bienvenida_encabezado' })}
          >
            {WHATSAPP_MECANIX.texto}
          </a>
        </header>

        <section style={{ textAlign: 'center', marginBottom: '32px' }}>
          <p style={etiqueta}>{HERO.etiqueta}</p>
          <h1 style={{ fontSize: 'clamp(26px, 7vw, 36px)', lineHeight: 1.2, color: '#1A3C5E', fontWeight: 800, margin: '0 0 12px' }}>{HERO.titulo}</h1>
          <p style={{ fontSize: '15px', color: '#555', lineHeight: 1.6, margin: '0 auto 22px', maxWidth: '480px' }}>{HERO.entrada}</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', justifyContent: 'center' }}>
            <a href={REGISTRO_YONKE} style={botonNaranja} onClick={clicRegistro('yonke', 'bienvenida_hero')}>🏪 {HERO.botonYonke}</a>
            {talleres && (
              <a href={REGISTRO_TALLER} style={botonAzul} onClick={clicRegistro('taller', 'bienvenida_hero')}>🔧 {HERO.botonTaller}</a>
            )}
          </div>
          <a href="#primeros-pasos" onClick={() => elegir('cliente', 'hero')} style={{ display: 'inline-block', marginTop: '18px', fontSize: '14px', color: '#1A3C5E', fontWeight: 600 }}>
            {HERO.enlaceCliente}
          </a>
        </section>

        <section style={caja} aria-labelledby="asi-funciona">
          <h2 id="asi-funciona" style={tituloSeccion}>{ASI_FUNCIONA.titulo}</h2>
          <ol style={lista}>
            {ASI_FUNCIONA.pasos.map((p) => (
              <li key={p.titulo} style={renglon}>
                <span style={{ fontSize: '24px', lineHeight: 1 }} aria-hidden="true">{p.emoji}</span>
                <div>
                  <h3 style={tituloPaso}>{p.titulo}</h3>
                  <p style={descPaso}>{p.desc}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section id="primeros-pasos" style={{ ...caja, scrollMarginTop: '16px' }} aria-labelledby="titulo-primeros-pasos">
          <h2 id="titulo-primeros-pasos" style={tituloSeccion}>{tipo === 'cliente' ? PRIMEROS_PASOS.tituloCliente : PRIMEROS_PASOS.titulo}</h2>
          <div role="group" aria-label="¿Quién eres?" style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
            {opciones.map((o) => (
              <button key={o} type="button" aria-pressed={tipo === o} onClick={() => elegir(o)} style={opcion(tipo === o)}>
                {PRIMEROS_PASOS.opciones[o]}
              </button>
            ))}
          </div>
          <ol style={lista}>
            {pasos.map((p, i) => (
              <li key={p.titulo} style={renglon}>
                <span style={numero} aria-hidden="true">{i + 1}</span>
                <div>
                  <h3 style={tituloPaso}>{p.titulo}</h3>
                  <p style={descPaso}>{p.desc}</p>
                </div>
              </li>
            ))}
          </ol>
          {tipo === 'cliente' && (
            <div style={tarjetaCliente}>
              <p style={{ margin: '0 0 6px', fontSize: '17px', fontWeight: 700 }}>{PRIMEROS_PASOS.tarjetaCliente.titulo}</p>
              {banderas?.consultas === true && <p style={{ margin: '0 0 16px', fontSize: '14px', lineHeight: 1.5, opacity: 0.9 }}>{PRIMEROS_PASOS.tarjetaCliente.texto}</p>}
              <Link href="/" style={{ ...botonNaranja, marginTop: banderas?.consultas === true ? 0 : '10px' }}>🔍 {PRIMEROS_PASOS.tarjetaCliente.boton}</Link>
            </div>
          )}
        </section>

        {tipo === 'yonke' && (
          <section style={{ marginBottom: '12px' }} aria-labelledby="planes-yonke">
            <h2 id="planes-yonke" style={{ ...tituloSeccion, fontSize: '22px', margin: '28px 0 20px' }}>{TITULO_PLANES_YONKE}</h2>
            <div style={conCaptura && conPremium ? gridTresPlanesStyle
              : (conCaptura || conPremium) ? gridPlanesStyle
                : { display: 'grid', gridTemplateColumns: '1fr', gap: '16px', maxWidth: '360px', margin: '0 auto' }}>
              <TarjetaBasicoYonke limitesActivos={conPremium} hrefRegistro={REGISTRO_YONKE} textoRegistro={BOTON_REGISTRO_PLANES.yonke} onRegistro={clicRegistro('yonke', 'bienvenida_planes')} />
              {conPremium && <TarjetaPremiumYonke ubicacion={UBICACION} />}
              {conCaptura && <TarjetaCapturaDomicilio disponibleEn={listaConY(estadosConVisitas)} ubicacion={UBICACION} />}
            </div>
          </section>
        )}

        {tipo === 'taller' && talleres && planes?.tarjetasTalleres === true && (
          <section style={{ marginBottom: '12px' }}>
            <TarjetasPlanesTaller ubicacion={UBICACION} hrefRegistro={REGISTRO_TALLER} textoRegistro={BOTON_REGISTRO_PLANES.taller} onRegistro={clicRegistro('taller', 'bienvenida_planes')} />
          </section>
        )}

        <div style={{ marginTop: '28px' }}>
          <ProximamenteMecanix titulo={TITULO_PROXIMAMENTE} ocultarRefacciones={buscadorRefacciones} />
        </div>

        {/* Etapa 2: preguntas frecuentes (desplegables) y llamada final. Vacías en
            lib/textosBienvenida.js, no se muestran. */}
        {PREGUNTAS_FRECUENTES.length > 0 && (
          <section style={caja} aria-labelledby="preguntas-frecuentes">
            <h2 id="preguntas-frecuentes" style={tituloSeccion}>Preguntas frecuentes</h2>
            {PREGUNTAS_FRECUENTES.map((p) => (
              <details key={p.pregunta} style={{ borderTop: '1px solid #E3EAF2', padding: '12px 0' }}>
                <summary style={{ cursor: 'pointer', fontWeight: 700, color: '#1A3C5E', fontSize: '15px' }}>{p.pregunta}</summary>
                <p style={{ ...descPaso, marginTop: '8px' }}>{p.respuesta}</p>
              </details>
            ))}
          </section>
        )}
        {LLAMADA_FINAL && (
          <section style={{ ...tarjetaCliente, marginTop: '12px' }}>
            <p style={{ margin: '0 0 8px', fontSize: '20px', fontWeight: 700 }}>{LLAMADA_FINAL.titulo}</p>
            {LLAMADA_FINAL.texto && <p style={{ margin: 0, fontSize: '14px', lineHeight: 1.5, opacity: 0.9 }}>{LLAMADA_FINAL.texto}</p>}
          </section>
        )}

        <footer style={{ marginTop: '32px', paddingTop: '20px', borderTop: '1px solid #ddd', textAlign: 'center' }}>
          <p style={{ margin: '0 0 10px', fontSize: '13px', color: '#888', fontWeight: 600 }}>{PIE.tecnologia}</p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', flexWrap: 'wrap' }}>
            <a href="/terminos" style={enlacePie}>{PIE.terminos}</a>
            <a href="/privacidad" style={enlacePie}>{PIE.privacidad}</a>
          </div>
        </footer>
      </div>
    </main>
  );
}

const avisoProvisional = { backgroundColor: '#FFF8E1', border: '1px solid #FFD54F', borderRadius: '10px', padding: '10px 14px', fontSize: '13px', color: '#7A5A00', margin: '0 0 16px', textAlign: 'center' };
const botonWhatsapp = { flexShrink: 0, padding: '10px 16px', borderRadius: '50px', backgroundColor: '#25D366', color: '#fff', fontWeight: 700, fontSize: '14px', textDecoration: 'none', whiteSpace: 'nowrap' };
const etiqueta = { fontSize: '13px', fontWeight: 700, color: '#E8720C', letterSpacing: '1.5px', textTransform: 'uppercase', margin: '0 0 10px' };
const botonBase = { display: 'inline-block', padding: '14px 24px', borderRadius: '50px', color: '#fff', fontWeight: 700, fontSize: '15px', textDecoration: 'none' };
const botonNaranja = { ...botonBase, background: 'linear-gradient(135deg, #E8720C 0%, #cf6209 100%)', boxShadow: '0 4px 14px rgba(232,114,12,0.4)' };
const botonAzul = { ...botonBase, backgroundColor: '#1A3C5E', boxShadow: '0 4px 12px rgba(26,60,94,0.3)' };
const caja = { backgroundColor: '#fff', borderRadius: '20px', padding: '24px 20px', boxShadow: '0 4px 16px rgba(26,60,94,0.07)', marginBottom: '12px' };
const tituloSeccion = { fontSize: '20px', color: '#1A3C5E', fontWeight: 700, margin: '0 0 18px', textAlign: 'center' };
const lista = { listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: '14px' };
const renglon = { display: 'flex', alignItems: 'flex-start', gap: '14px' };
const tituloPaso = { fontSize: '15px', fontWeight: 700, color: '#1A3C5E', margin: 0 };
const descPaso = { fontSize: '14px', color: '#555', lineHeight: 1.55, margin: '4px 0 0' };
const numero = { flexShrink: 0, width: '28px', height: '28px', borderRadius: '50%', backgroundColor: '#E8720C', color: '#fff', fontWeight: 700, fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center' };
const opcion = (activa) => ({
  flex: 1, padding: '10px 6px', borderRadius: '12px', border: '2px solid', borderColor: activa ? '#1A3C5E' : '#ddd',
  backgroundColor: activa ? '#1A3C5E' : '#fff', color: activa ? '#fff' : '#666', fontWeight: 700, fontSize: '13px', cursor: 'pointer',
  fontFamily: "'Inter', sans-serif",
});
const tarjetaCliente = { marginTop: '20px', backgroundColor: '#1A3C5E', color: '#fff', borderRadius: '16px', padding: '22px 20px', textAlign: 'center' };
const enlacePie = { fontSize: '13px', color: '#1A3C5E', fontWeight: 600 };
