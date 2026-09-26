import { getYonkeActividad, toMillis } from '../../lib/inventoryStatus';

// Indicador de ACTIVIDAD del yonke (Fase 2 del semáforo): qué tan reciente fue la última vez que
// su dueño usó la plataforma. Un solo componente para todas las tarjetas del yonke (buscadores,
// /yonkes, detalle, verificados, admin) para que nunca se desincronicen. Sin hooks: sirve en
// Server y Client Components. Recibe ultimaActividadAt en ms (lo que cruza servidor -> cliente)
// o cualquier valor que toMillis entienda (p. ej. el Timestamp de un componente cliente).
//
// Icono + color + texto (nunca solo color). NUNCA muestra fechas, horas ni días exactos. No
// pinta nada si no hay fecha válida (yonke que aún no ha entrado al panel).
const CONFIG = {
  green: { icon: '✅', color: '#2E7D32', background: '#E8F5E9', texto: 'Activo recientemente' },
  yellow: { icon: '⏳', color: '#B26A00', background: '#FFF3E0', texto: 'Actividad moderada' },
  red: { icon: '⚠️', color: '#C62828', background: '#FDECEA', texto: 'Sin actividad reciente' },
};

export default function YonkeActividadBadge({ ultimaActividadAt }) {
  const status = getYonkeActividad(toMillis(ultimaActividadAt));
  if (!status) return null;
  const cfg = CONFIG[status];

  return (
    <span
      role="status"
      aria-label={cfg.texto}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: '5px',
        backgroundColor: cfg.background, color: cfg.color,
        fontSize: '12px', fontWeight: '700', padding: '3px 9px', borderRadius: '20px',
        whiteSpace: 'nowrap',
      }}
    >
      <span aria-hidden="true">{cfg.icon}</span>
      {cfg.texto}
    </span>
  );
}
