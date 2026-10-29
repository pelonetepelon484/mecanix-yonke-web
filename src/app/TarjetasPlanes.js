// Tarjetas de planes de la página principal y de /bienvenida: Plan Básico de yonkes, "Plan Premium"
// de yonkes (con config/planes.limitesActivos), Captura a domicilio (estados con tieneVisitas) y los
// planes de talleres (con config/planes.tarjetasTalleres). Los estilos viven aquí para que todas se
// vean iguales. Con sus valores por defecto quedan exactamente como en la portada; /bienvenida solo
// cambia la ubicación del evento y la dirección de registro (?desde=bienvenida).
import {
  FUNCIONES_PLAN_PREMIUM, FUNCIONES_TALLER_BASICO, FUNCIONES_TALLER_PREMIUM, PRECIO_PREMIUM_TEXTO, URL_QUIERO_PREMIUM,
  URL_QUIERO_PREMIUM_TALLER, tarjetaPlanSinCosto,
} from '../lib/planes';
import { textoPromoRegistro } from '../lib/premiumGratis';

function registrarEvento(nombre, params = {}) {
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('event', nombre, params);
  }
}

const URL_CAPTURA_DOMICILIO = 'https://wa.me/5216611034260?text=Hola%2C%20quiero%20agendar%20el%20servicio%20de%20captura%20a%20domicilio%20de%20Mecanix%20Yonke%20Virtual';

function TarjetaPlan({ nombre, precio, funciones, boton, destacada = false, nota = null }) {
  return (
    <div style={destacada ? planPremiumCardStyle : planCardStyle}>
      <p style={planNombreStyle}>{nombre}</p>
      <p style={{ ...planPrecioStyle, fontSize: '18px' }}>{precio}</p>
      {nota && <p style={notaPromoStyle}>🎁 {nota}</p>}
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
        onClick={boton.evento ? () => registrarEvento(boton.evento.nombre, boton.evento.params) : boton.onClick}
      >
        {boton.texto}
      </a>
    </div>
  );
}

// Plan Básico de yonkes (con límites; sin ellos, el "Plan Gratuito" de antes). Sin precio aparte
// ("Gratis"): sería redundante con el nombre del plan y le resta formalidad a la tarjeta.
// onRegistro: evento opcional al tocar el botón (en la portada no hay).
export function TarjetaBasicoYonke({ limitesActivos, hrefRegistro = '/panel/registro', textoRegistro = 'Registra tu yonke gratis', onRegistro }) {
  const { nombre, funciones } = tarjetaPlanSinCosto(limitesActivos);
  return (
    <div style={planCardStyle}>
      <p style={planNombreStyle}>{nombre}</p>
      <p style={planDescStyle}>
        Tu yonke aparece en el buscador de Mecanix y los clientes te contactan
        directo por WhatsApp. Incluye:
      </p>
      <ul style={{ margin: '0 0 16px', padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {funciones.map((item) => (
          <li key={item} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '13px', color: '#555', lineHeight: '1.5' }}>
            <span style={{ color: '#2E7D32', fontWeight: '700' }}>✓</span>
            {item}
          </li>
        ))}
      </ul>
      <div style={planNotaAzulStyle}>
        Actualmente sin costo. Solo dejas la plataforma si tú decides darte de baja.
      </div>
      <a
        href={hrefRegistro}
        className="mecanix-btn-primary"
        style={{ display: 'block', textAlign: 'center', textDecoration: 'none', marginTop: '18px' }}
        onClick={onRegistro}
      >
        {textoRegistro}
      </a>
    </div>
  );
}

// Servicio de captura a domicilio: PAGO POR VISITA (no mensualidad, no suscripción). Quien la usa
// decide dónde se ofrece (solo estados con tieneVisitas) y dice en cuáles con disponibleEn.
export function TarjetaCapturaDomicilio({ disponibleEn, ubicacion = 'seccion_planes' }) {
  return (
    <div style={{ ...planCardStyle, border: '2px dashed #E8720C', backgroundColor: '#FFF8F0' }}>
      <p style={planNombreStyle}>Captura a domicilio</p>
      <p style={planPrecioStyle}>
        $300 <span style={{ fontSize: '13px', fontWeight: '600', color: '#666' }}>/ visita</span>
      </p>
      <p style={planDescStyle}>
        ¿No tienes tiempo de subir tu inventario? Nosotros vamos a tu yonke y lo
        capturamos por ti. Lo pides cuando lo necesites — sin mensualidad, sin
        compromiso.
      </p>
      <div style={planNotaAzulStyle}>
        Disponible en {disponibleEn}.
      </div>
      <a
        href={URL_CAPTURA_DOMICILIO}
        target="_blank"
        rel="noopener noreferrer"
        className="mecanix-btn-primary"
        style={{ display: 'block', textAlign: 'center', textDecoration: 'none', marginTop: '18px' }}
        onClick={() => registrarEvento('clic_servicio_visitas', { ubicacion, plan_actual: 'visitante' })}
      >
        Quiero agendar una visita
      </a>
    </div>
  );
}

// "Plan Premium" de yonkes: mismo WhatsApp y mismo mensaje que el botón "Quiero Premium" del panel.
export function TarjetaPremiumYonke({ ubicacion = 'seccion_planes' }) {
  return (
    <TarjetaPlan
      destacada
      nombre="Plan Premium"
      precio={PRECIO_PREMIUM_TEXTO}
      funciones={FUNCIONES_PLAN_PREMIUM}
      boton={{
        texto: 'Quiero Premium', href: URL_QUIERO_PREMIUM, externo: true,
        evento: { nombre: 'clic_premium', params: { ubicacion, plan_actual: 'visitante' } },
      }}
    />
  );
}

// Planes de talleres, debajo de "¿Tienes un taller mecánico?". Quien la usa decide si se muestra
// (interruptor config/planes.tarjetasTalleres). onRegistro: evento opcional del botón de registro.
// mesesPromo: con la promoción de config/talleres encendida, "N meses de Premium gratis al
// registrarte" en la tarjeta Premium (null = no se muestra).
export function TarjetasPlanesTaller({
  ubicacion = 'seccion_planes_talleres', hrefRegistro = '/panel/taller/registro', textoRegistro = 'Registra tu taller gratis', onRegistro, mesesPromo = null,
}) {
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
          boton={{ texto: textoRegistro, href: hrefRegistro, onClick: onRegistro }}
        />
        <TarjetaPlan
          destacada
          nombre="Plan Premium"
          precio={PRECIO_PREMIUM_TEXTO}
          funciones={FUNCIONES_TALLER_PREMIUM}
          nota={mesesPromo ? textoPromoRegistro(mesesPromo) : null}
          boton={{
            texto: 'Quiero Premium', href: URL_QUIERO_PREMIUM_TALLER, externo: true,
            evento: { nombre: 'clic_premium', params: { ubicacion, plan_actual: 'visitante' } },
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
export const notaPromoStyle = { display: 'inline-block', backgroundColor: '#FEF3EC', color: '#B4530A', border: '1px solid #F5C9A6', borderRadius: '20px', padding: '4px 12px', fontSize: '13px', fontWeight: '700', margin: '0 0 12px' };
export const planNotaAzulStyle = { backgroundColor: '#EEF2F7', border: '1.5px dashed #1A3C5E', borderRadius: '10px', padding: '12px 14px', fontSize: '12px', color: '#1A3C5E', lineHeight: '1.5', fontWeight: '600', marginTop: '16px' };
