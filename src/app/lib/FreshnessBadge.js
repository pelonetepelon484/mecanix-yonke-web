// Semáforo visual de frescura de un vehículo (FASE 1) — recibe status/days ya calculados por
// getVehicleFreshness (src/lib/inventoryStatus.ts), no calcula nada aquí. Icono + color + texto
// (nunca solo color, por accesibilidad) y aria-label con la lectura completa para lector de
// pantalla.
const CONFIG = {
  green: { icon: '✅', color: '#2E7D32', background: '#E8F5E9', etiqueta: 'Reciente' },
  yellow: { icon: '⏳', color: '#B26A00', background: '#FFF3E0', etiqueta: 'Atención' },
  red: { icon: '⚠️', color: '#C62828', background: '#FDECEA', etiqueta: 'Desactualizado' },
};

export default function FreshnessBadge({ status, days }) {
  const cfg = CONFIG[status] || CONFIG.red;
  const texto = days === 0 ? 'Capturado hoy' : `Capturado hace ${days} ${days === 1 ? 'día' : 'días'}`;

  return (
    <span
      role="status"
      aria-label={`${cfg.etiqueta}: ${texto}`}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: '5px',
        backgroundColor: cfg.background, color: cfg.color,
        fontSize: '12px', fontWeight: '700', padding: '3px 9px', borderRadius: '20px',
        whiteSpace: 'nowrap',
      }}
    >
      <span aria-hidden="true">{cfg.icon}</span>
      {texto}
    </span>
  );
}
