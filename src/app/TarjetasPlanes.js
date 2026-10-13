// Tarjetas de planes de la página principal: "Plan Premium" de yonkes (con
// config/planes.limitesActivos) y los planes de talleres (con config/planes.tarjetasTalleres).
// La tarjeta del Plan Básico de yonkes y la de Captura a domicilio siguen en HomeClient.js; los
// estilos de las tarjetas viven aquí y HomeClient los importa, para que todas se vean iguales.
import {
  FUNCIONES_PLAN_PREMIUM, FUNCIONES_TALLER_BASICO, FUNCIONES_TALLER_PREMIUM, PRECIO_PREMIUM_TEXTO, URL_QUIERO_PREMIUM,
  URL_QUIERO_PREMIUM_TALLER,
} from '../lib/planes';

function registrarEvento(nombre, params = {}) {
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('event', nombre, params);
  }
}

function TarjetaPlan({ nombre, precio, funciones, boton, destacada = false }) {
  return (
    <div style={destacada ? planPremiumCardStyle : planCardStyle}>
      <p style={planNombreStyle}>{nombre}</p>
      <p style={{ ...planPrecioStyle, fontSize: '18px' }}>{precio}</p>
      <ul style={{ margin: '0 0 16px', padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {funciones.map((item) => (
          <li key={item} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '13px', color: '#555', lineHeight: '1.5' }}>
            <span style={{ color: '#2E7D32', fontWeight: '700' }}>✓</span>
            {item}
          </li>
        ))}
      </ul>
      <a
        href={boton.href}
        target={boton.externo ? '_blank' : undefined}
        rel={boton.externo ? 'noopener noreferrer' : undefined}
        className="mecanix-btn-primary"
        style={{ display: 'block', textAlign: 'center', textDecoration: 'none', marginTop: '18px' }}
        onClick={boton.evento ? () => registrarEvento(boton.evento.nombre, boton.evento.params) : undefined}
      >
        {boton.texto}
      </a>
    </div>
  );
}

// "Plan Premium" de yonkes: mismo WhatsApp y mismo mensaje que el botón "Quiero Premium" del panel.
export function TarjetaPremiumYonke() {
  return (
    <TarjetaPlan
      destacada
      nombre="Plan Premium"
      precio={PRECIO_PREMIUM_TEXTO}
      funciones={FUNCIONES_PLAN_PREMIUM}
      boton={{
        texto: 'Quiero Premium', href: URL_QUIERO_PREMIUM, externo: true,
        evento: { nombre: 'clic_premium', params: { ubicacion: 'seccion_planes', plan_actual: 'visitante' } },
      }}
    />
  );
}

// Planes de talleres, debajo de "¿Tienes un taller mecánico?". Quien la usa decide si se muestra
// (interruptor config/planes.tarjetasTalleres).
export function TarjetasPlanesTaller() {
  return (
    <div style={{ marginTop: '32px' }}>
      <div style={{ textAlign: 'center', marginBottom: '20px' }}>
        <h2 style={{ fontSize: '22px', fontWeight: '700', color: '#1A3C5E', margin: 0 }}>
          Planes para tu taller
        </h2>
      </div>
      <div style={gridPlanesStyle}>
        <TarjetaPlan
          nombre="Plan Básico"
          precio="Sin costo"
          funciones={FUNCIONES_TALLER_BASICO}
          boton={{ texto: 'Registra tu taller gratis', href: '/panel/taller/registro' }}
        />
        <TarjetaPlan
          destacada
          nombre="Plan Premium"
          precio={PRECIO_PREMIUM_TEXTO}
          funciones={FUNCIONES_TALLER_PREMIUM}
          boton={{
            texto: 'Quiero Premium', href: URL_QUIERO_PREMIUM_TALLER, externo: true,
            evento: { nombre: 'clic_premium', params: { ubicacion: 'seccion_planes_talleres', plan_actual: 'visitante' } },
          }}
        />
      </div>
    </div>
  );
}

// Varias tarjetas: columnas de al menos 240 px; en celular quedan una debajo de otra.
export const gridPlanesStyle = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' };
// Tres tarjetas: la página mide 620 px y ahí solo caben dos por fila, así que la cuadrícula se
// ensancha hasta 900 px (centrada sobre la página, sin pasarse de la pantalla con 16 px por lado).
export const gridTresPlanesStyle = {
  ...gridPlanesStyle,
  width: 'min(900px, calc(100vw - 32px))', position: 'relative', left: '50%', transform: 'translateX(-50%)',
};
export const planCardStyle = { backgroundColor: '#fff', borderRadius: '20px', padding: '28px 24px', boxShadow: '0 4px 16px rgba(26,60,94,0.08)', position: 'relative' };
export const planPremiumCardStyle = { ...planCardStyle, border: '2px solid #E8720C' };
export const planNombreStyle = { fontSize: '15px', fontWeight: '700', color: '#1A3C5E', margin: '0 0 4px', letterSpacing: '0.3px', textTransform: 'uppercase' };
export const planPrecioStyle = { fontSize: '22px', fontWeight: '700', color: '#1A3C5E', margin: '0 0 10px' };
export const planDescStyle = { fontSize: '13px', color: '#666', lineHeight: '1.6', margin: '0 0 16px' };
export const planNotaAzulStyle = { backgroundColor: '#EEF2F7', border: '1.5px dashed #1A3C5E', borderRadius: '10px', padding: '12px 14px', fontSize: '12px', color: '#1A3C5E', lineHeight: '1.5', fontWeight: '600', marginTop: '16px' };
