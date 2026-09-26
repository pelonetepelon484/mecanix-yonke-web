import { URL_PRIVACIDAD } from '../../lib/versionesLegales';

// Aviso corto bajo los formularios de reservación: qué se comparte y con quién, con enlace al
// Aviso de Privacidad completo. Compartido por el buscador principal y los subdominios white-label
// para que el texto nunca se desincronice. `color` permite usar el color de acento del tenant.
export default function AvisoPrivacidadReserva({ color = '#1A3C5E' }) {
  return (
    <p style={{ fontSize: '11px', color: '#888', lineHeight: '1.4', margin: '0 0 8px' }}>
      Al confirmar, compartimos tu nombre y teléfono con este yonke para atender tu reservación.
      Consulta nuestro{' '}
      <a href={URL_PRIVACIDAD} target="_blank" rel="noopener noreferrer" style={{ color, fontWeight: '700' }}>
        Aviso de Privacidad
      </a>.
    </p>
  );
}
