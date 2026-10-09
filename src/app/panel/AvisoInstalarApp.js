'use client';

// Aviso "Instalar app" del panel de yonkes y talleres. Solo en el dominio principal y nunca si la
// app ya está abierta desde el ícono. Según el teléfono:
//  - navegador dentro de WhatsApp/Facebook/Instagram: pide abrir el enlace en Safari o Chrome;
//  - iPhone/iPad: 3 pasos (Compartir, "Agregar a inicio", abrir desde el ícono);
//  - Android/Chrome: botón "Instalar app" con el aviso del navegador (o, si no hay, el menú ⋮).
// Se puede cerrar y se recuerda (localStorage). Con siempre=true (panel de Negocio) se muestra
// aunque se haya cerrado.
import { useState, useSyncExternalStore } from 'react';
import {
  NOMBRE_NAVEGADOR_INTERNO, decidirAviso, detectarNavegadorInterno, detectarPlataforma, esDominioPrincipal, estaInstalada,
  guardarAvisoCerrado, leerAvisoCerrado,
} from '../../lib/instalacionApp';
import { pedirInstalacion, usePromptInstalacion } from './promptInstalacion';

const AZUL = '#1A3C5E';
const NARANJA = '#E8720C';

function almacenamiento() {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

// El entorno no cambia durante la visita: se lee una vez, como texto (para que React lo compare igual).
function leerEntorno() {
  const ua = navigator.userAgent || '';
  return JSON.stringify({
    plataforma: detectarPlataforma(ua, navigator.maxTouchPoints || 0),
    interno: detectarNavegadorInterno(ua),
    instalada: estaInstalada({
      standalone: typeof window.matchMedia === 'function' && window.matchMedia('(display-mode: standalone)').matches,
      navigatorStandalone: navigator.standalone,
    }),
    dominioPrincipal: esDominioPrincipal(window.location.hostname),
    cerrado: leerAvisoCerrado(almacenamiento()),
  });
}
const sinCambios = () => () => {};

export default function AvisoInstalarApp({ siempre = false }) {
  const prompt = usePromptInstalacion();
  const entornoTexto = useSyncExternalStore(sinCambios, leerEntorno, () => null);
  const [cerradoAhora, setCerradoAhora] = useState(false);
  const [copiado, setCopiado] = useState(''); // '' | 'ok' | 'manual'

  if (!entornoTexto) return null;
  const entorno = JSON.parse(entornoTexto);
  if (!entorno.dominioPrincipal) return null;
  if (!siempre && (entorno.cerrado || cerradoAhora)) return null;

  const modo = decidirAviso({
    instalada: entorno.instalada, plataforma: entorno.plataforma, navegadorInterno: entorno.interno, hayPrompt: Boolean(prompt),
  });

  function cerrar() {
    guardarAvisoCerrado(almacenamiento());
    setCerradoAhora(true);
  }

  async function instalar() {
    const resultado = await pedirInstalacion();
    if (resultado === 'accepted') setCerradoAhora(true);
  }

  function copiarEnlace() {
    const enlace = window.location.href;
    if (!navigator.clipboard?.writeText) { setCopiado('manual'); return; }
    navigator.clipboard.writeText(enlace).then(() => setCopiado('ok')).catch(() => setCopiado('manual'));
  }

  const botonCerrar = !siempre && (
    <button type="button" onClick={cerrar} aria-label="Cerrar aviso" style={estilos.cerrar}>×</button>
  );

  if (modo === 'nada') {
    if (!siempre) return null;
    return (
      <div role="note" style={estilos.caja}>
        <p style={estilos.texto}>
          {entorno.instalada
            ? '✅ Ya estás usando la app de Mecanix.'
            : 'Abre esta página desde tu teléfono (Chrome en Android o Safari en iPhone) para instalar la app.'}
        </p>
      </div>
    );
  }

  if (modo === 'interno') {
    return (
      <div role="alert" style={{ ...estilos.caja, border: `3px solid ${NARANJA}`, backgroundColor: '#FFF4E8' }}>
        {botonCerrar}
        <p style={{ ...estilos.titulo, fontSize: '18px' }}>
          Abre este enlace en Safari (iPhone) o Chrome (Android) para instalar la app
        </p>
        <p style={estilos.texto}>
          Estás dentro de {NOMBRE_NAVEGADOR_INTERNO[entorno.interno]} y desde aquí no se puede instalar. Copia el enlace y pégalo en Safari o Chrome.
        </p>
        <button type="button" onClick={copiarEnlace} style={estilos.botonNaranja}>Copiar enlace</button>
        {copiado === 'ok' && <p style={{ ...estilos.texto, color: '#2E7D32', fontWeight: 'bold', marginTop: '8px' }}>¡Enlace copiado! Ahora pégalo en Safari o Chrome.</p>}
        {copiado === 'manual' && (
          <input readOnly value={window.location.href} onFocus={(e) => e.target.select()} aria-label="Enlace para copiar" style={estilos.enlace} />
        )}
      </div>
    );
  }

  if (modo === 'ios') {
    return (
      <div role="note" style={estilos.caja}>
        {botonCerrar}
        <p style={estilos.titulo}>📲 Instala Mecanix en tu iPhone</p>
        <ol style={estilos.pasos}>
          <li>Toca el botón <strong>Compartir</strong> (el cuadro con una flecha hacia arriba).</li>
          <li>Elige <strong>&quot;Agregar a inicio&quot;</strong>. Si no lo ves, desliza el menú hacia abajo.</li>
          <li>Abre <strong>Mecanix</strong> desde el ícono nuevo en tu pantalla de inicio.</li>
        </ol>
      </div>
    );
  }

  if (modo === 'boton') {
    return (
      <div role="note" style={estilos.caja}>
        {botonCerrar}
        <p style={estilos.titulo}>📲 Instala Mecanix en tu teléfono</p>
        <p style={estilos.texto}>Entra más rápido a tus pedidos, como una app, desde tu pantalla de inicio.</p>
        <button type="button" onClick={instalar} style={estilos.botonNaranja}>Instalar app</button>
      </div>
    );
  }

  // 'android-menu': Android sin el aviso del navegador (por ejemplo, otro navegador o ya se descartó).
  return (
    <div role="note" style={estilos.caja}>
      {botonCerrar}
      <p style={estilos.titulo}>📲 Instala Mecanix en tu teléfono</p>
      <p style={estilos.texto}>
        Abre esta página en <strong>Chrome</strong>, toca el menú <strong>⋮</strong> (arriba a la derecha) y elige <strong>&quot;Instalar app&quot;</strong> o <strong>&quot;Agregar a pantalla principal&quot;</strong>.
      </p>
    </div>
  );
}

const estilos = {
  caja: { position: 'relative', maxWidth: '600px', margin: '12px auto', padding: '16px 18px', borderRadius: '14px', backgroundColor: '#fff', border: `2px solid ${AZUL}`, boxShadow: '0 2px 10px rgba(0,0,0,0.06)', boxSizing: 'border-box' },
  titulo: { margin: '0 28px 6px 0', fontWeight: 'bold', fontSize: '16px', color: AZUL, lineHeight: '1.35' },
  texto: { margin: '0 0 10px', fontSize: '14px', color: '#333', lineHeight: '1.5' },
  pasos: { margin: '0 0 4px', paddingLeft: '20px', fontSize: '14px', color: '#333', lineHeight: '1.7' },
  botonNaranja: { width: '100%', minHeight: '48px', borderRadius: '12px', border: 'none', backgroundColor: NARANJA, color: '#fff', fontWeight: 'bold', fontSize: '16px', cursor: 'pointer' },
  cerrar: { position: 'absolute', top: '6px', right: '8px', width: '36px', height: '36px', border: 'none', background: 'none', color: AZUL, fontSize: '24px', lineHeight: '1', cursor: 'pointer' },
  enlace: { width: '100%', boxSizing: 'border-box', marginTop: '8px', padding: '10px', fontSize: '13px', borderRadius: '8px', border: '1px solid #CCC' },
};

// Opción fija en el panel de Negocio (/panel/perfil): vuelve a mostrar el aviso aunque se haya cerrado.
export function OpcionInstalarApp({ estiloSeccion, estiloTitulo }) {
  const [abierto, setAbierto] = useState(false);
  return (
    <div style={estiloSeccion}>
      <h2 style={estiloTitulo}>Instalar app</h2>
      <p style={{ fontSize: '13px', color: '#888', margin: '0 0 12px' }}>
        Ten Mecanix en la pantalla de inicio de tu teléfono y entra a tus pedidos como en una app.
      </p>
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        aria-expanded={abierto}
        style={{ ...estilos.botonNaranja, backgroundColor: abierto ? AZUL : NARANJA }}
      >
        {abierto ? 'Ocultar instrucciones' : 'Instalar app'}
      </button>
      {abierto && <AvisoInstalarApp siempre />}
    </div>
  );
}
