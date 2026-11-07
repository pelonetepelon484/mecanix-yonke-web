'use client';

// Resultados del comparador, tema oscuro (solo esta sección). Mismos colores de Mecanix: el azul
// marino #1A3C5E llevado a oscuro y el naranja #E8720C de acento. REGLA ESTRICTA: solo datos reales;
// un campo vacío dice "Sin datos" y el porcentaje sale solo de los campos que sí se compararon.
import { AVISO_COMPARADOR, CAMPOS_VEHICULO, SIN_DATOS, etiquetaTipoPieza } from '../../lib/comparadorPiezas';
import { MONO } from './estilos';

const C = {
  fondo: '#0B1622', panel: '#12233A', borde: '#22405F', texto: '#E6EEF6', tenue: '#8FA6BD', naranja: '#E8720C',
  verde: '#3FB27F', rojo: '#E5534B', gris: '#6B7F93', ambar: '#E8A33D',
};
const COLOR_RESULTADO = { compatible: C.verde, registros: C.verde, probable: C.ambar, no_compatible: C.rojo, indeterminado: C.gris };
const ICONO_RESULTADO = { compatible: '✓', registros: '✓', probable: '≈', no_compatible: '✕', indeterminado: '?' };
const ESTADO = {
  coincide: { texto: 'Coincide', color: C.verde, icono: '●' },
  difiere: { texto: 'Difiere', color: C.rojo, icono: '●' },
  sin_datos: { texto: SIN_DATOS, color: C.gris, icono: '○' },
};

function Analizando() {
  return (
    <div role="status" aria-live="polite" style={{ textAlign: 'center', padding: '60px 0' }}>
      <style>{`
        @keyframes mxBarrido { 0% { transform: translateX(-100%); } 100% { transform: translateX(250%); } }
        @keyframes mxPulso { 0%, 100% { opacity: .35; } 50% { opacity: 1; } }
        @media (prefers-reduced-motion: reduce) { .mx-anim { animation: none !important; } }
      `}</style>
      <p style={{ fontFamily: MONO, color: C.naranja, letterSpacing: '3px', fontSize: '13px', margin: '0 0 14px' }}>TECNOLOGÍA MECANIX</p>
      <p className="mx-anim" style={{ color: C.texto, fontSize: '20px', fontWeight: '800', margin: '0 0 18px', animation: 'mxPulso 1.2s ease-in-out infinite' }}>Analizando…</p>
      <div style={{ position: 'relative', height: '4px', maxWidth: '280px', margin: '0 auto', backgroundColor: C.borde, borderRadius: '4px', overflow: 'hidden' }}>
        <div className="mx-anim" style={{ position: 'absolute', inset: 0, width: '40%', backgroundColor: C.naranja, borderRadius: '4px', animation: 'mxBarrido 1s linear infinite' }} />
      </div>
      <p style={{ fontFamily: MONO, color: C.tenue, fontSize: '12px', margin: '16px 0 0' }}>Decodificando VIN · Buscando registros</p>
    </div>
  );
}

function TarjetaVehiculo({ letra, lado }) {
  const datos = lado?.datos;
  return (
    <section aria-label={`Vehículo ${letra}`} style={{ backgroundColor: C.panel, border: `1px solid ${C.borde}`, borderRadius: '16px', padding: '14px', minWidth: 0 }}>
      <p style={{ margin: 0, fontFamily: MONO, color: C.naranja, fontSize: '12px', letterSpacing: '2px' }}>VEHÍCULO {letra}</p>
      {lado?.vin && <p style={{ margin: '6px 0 0', fontFamily: MONO, color: C.texto, fontSize: '15px', letterSpacing: '1.5px', wordBreak: 'break-all' }}>{lado.vin}</p>}
      {lado?.parte && <p style={{ margin: '4px 0 0', fontFamily: MONO, color: C.tenue, fontSize: '13px' }}>N.º de parte: <span style={{ color: C.texto }}>{lado.parte}</span></p>}
      {lado?.estado === 'sin_vin' && <p style={{ margin: '8px 0 0', color: C.tenue, fontSize: '13px' }}>Sin VIN capturado.</p>}
      {lado?.estado === 'sin_datos' && <p style={{ margin: '8px 0 0', color: C.ambar, fontSize: '13px', fontWeight: '700' }}>Sin datos de VIN</p>}
      {datos && (
        <dl style={{ margin: '10px 0 0', display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '4px 10px', fontSize: '13px' }}>
          {CAMPOS_VEHICULO.map((c) => (
            <div key={c.key} style={{ display: 'contents' }}>
              <dt style={{ color: C.tenue }}>{c.label}</dt>
              <dd style={{ margin: 0, color: datos[c.key] ? C.texto : C.gris, fontFamily: datos[c.key] ? MONO : 'inherit', wordBreak: 'break-word' }}>{datos[c.key] || SIN_DATOS}</dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  );
}

function TablaComparacion({ comparacion }) {
  return (
    <section aria-label="Comparación campo por campo" style={{ marginTop: '14px', backgroundColor: C.panel, border: `1px solid ${C.borde}`, borderRadius: '16px', padding: '14px', overflowX: 'auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '10px', flexWrap: 'wrap', marginBottom: '8px' }}>
        <h2 style={{ margin: 0, color: C.texto, fontSize: '15px', fontWeight: '800' }}>Campo por campo</h2>
        {comparacion.comparados > 0 ? (
          <p style={{ margin: 0, fontFamily: MONO, color: C.texto, fontSize: '13px' }}>
            <strong style={{ color: C.naranja, fontSize: '18px' }}>{comparacion.porcentaje}%</strong> · {comparacion.coinciden} de {comparacion.comparados} campos comparados coinciden
          </p>
        ) : <p style={{ margin: 0, color: C.tenue, fontSize: '13px' }}>Ningún campo se pudo comparar.</p>}
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
        <thead>
          <tr style={{ color: C.tenue, textAlign: 'left' }}>
            <th scope="col" style={celdaTitulo}>Campo</th>
            <th scope="col" style={celdaTitulo}>A</th>
            <th scope="col" style={celdaTitulo}>B</th>
            <th scope="col" style={celdaTitulo}>Estado</th>
          </tr>
        </thead>
        <tbody>
          {comparacion.filas.map((f) => {
            const e = ESTADO[f.estado];
            return (
              <tr key={f.key} style={{ borderTop: `1px solid ${C.borde}` }}>
                <th scope="row" style={{ ...celda, color: C.tenue, fontWeight: '600' }}>{f.label}</th>
                <td style={{ ...celda, fontFamily: f.a ? MONO : 'inherit', color: f.a ? C.texto : C.gris }}>{f.a || SIN_DATOS}</td>
                <td style={{ ...celda, fontFamily: f.b ? MONO : 'inherit', color: f.b ? C.texto : C.gris }}>{f.b || SIN_DATOS}</td>
                <td style={{ ...celda, color: e.color, fontWeight: '700', whiteSpace: 'nowrap' }}><span aria-hidden="true">{e.icono} </span>{e.texto}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}

export default function ResultadosComparador({ analizando = false, resultado = null, alNueva, alEditar }) {
  const color = resultado ? COLOR_RESULTADO[resultado.resultado.key] : C.gris;
  return (
    <main style={{ minHeight: '100vh', backgroundColor: C.fondo, color: C.texto, padding: '24px 16px 40px', fontFamily: "'Inter', sans-serif" }}>
      <div style={{ maxWidth: '760px', margin: '0 auto' }}>
        <p role="note" style={{ margin: '0 0 16px', padding: '10px 14px', borderRadius: '12px', border: `1.5px solid ${C.naranja}`, color: C.texto, fontSize: '14px', lineHeight: 1.5, fontWeight: '600' }}>
          ⚠️ {AVISO_COMPARADOR}
        </p>
        {analizando || !resultado ? <Analizando /> : (
          <>
            <p style={{ margin: 0, fontFamily: MONO, color: C.naranja, letterSpacing: '3px', fontSize: '12px' }}>RESULTADO · {etiquetaTipoPieza(resultado.tipo).toUpperCase()}</p>
            <section aria-label="Resultado" style={{ marginTop: '8px', padding: '16px', borderRadius: '16px', backgroundColor: C.panel, border: `2px solid ${color}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span aria-hidden="true" style={{ flexShrink: 0, width: '44px', height: '44px', borderRadius: '50%', border: `2px solid ${color}`, color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px', fontWeight: '800' }}>
                  {ICONO_RESULTADO[resultado.resultado.key]}
                </span>
                <div>
                  <h1 style={{ margin: 0, fontSize: '22px', fontWeight: '800', color }}>{resultado.resultado.titulo}</h1>
                  <p style={{ margin: '4px 0 0', color: C.tenue, fontSize: '14px', lineHeight: 1.5 }}>{resultado.resultado.desc}</p>
                </div>
              </div>
              {resultado.nota && <p style={{ margin: '12px 0 0', padding: '10px 12px', borderRadius: '10px', backgroundColor: '#1B2F48', color: C.ambar, fontSize: '14px', fontWeight: '700' }}>{resultado.nota}</p>}
              {resultado.motivos?.length > 0 && (
                <ul style={{ margin: '12px 0 0', paddingLeft: '18px', color: C.texto, fontSize: '13px', lineHeight: 1.6 }}>
                  {resultado.motivos.map((m) => <li key={m}>{m}</li>)}
                </ul>
              )}
            </section>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '12px', marginTop: '14px' }}>
              <TarjetaVehiculo letra="A" lado={resultado.vehiculoA} />
              <TarjetaVehiculo letra="B" lado={resultado.vehiculoB} />
            </div>
            {resultado.comparacion && <TablaComparacion comparacion={resultado.comparacion} />}
            <p style={{ margin: '12px 0 0', color: C.tenue, fontSize: '12px', lineHeight: 1.5 }}>
              Datos del VIN: NHTSA vPIC (EE. UU.), tal como los regresa; algunos vehículos vendidos en México tienen pocos datos o ninguno.
            </p>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginTop: '18px' }}>
              <button type="button" onClick={alNueva} style={{ ...boton, backgroundColor: C.naranja, borderColor: C.naranja, color: '#fff' }}>Nueva comparación</button>
              <button type="button" onClick={alEditar} style={boton}>Cambiar datos</button>
            </div>
          </>
        )}
        <p style={{ margin: '28px 0 0', textAlign: 'center', fontFamily: MONO, color: C.tenue, fontSize: '12px', letterSpacing: '2px' }}>Tecnología Mecanix</p>
      </div>
    </main>
  );
}

const celdaTitulo = { padding: '6px 8px', fontWeight: '600', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '1px' };
const celda = { padding: '7px 8px', textAlign: 'left', verticalAlign: 'top' };
const boton = { flex: '1 1 160px', minHeight: '50px', borderRadius: '14px', border: `1px solid ${C.borde}`, backgroundColor: 'transparent', color: C.texto, fontSize: '15px', fontWeight: '800', cursor: 'pointer' };
