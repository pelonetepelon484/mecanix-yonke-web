'use client';

// Tarjetas "Vehículo disponible, pregunta por la pieza": yonkes que confirmaron tener el vehículo
// completo al responder una alerta (yonkes/{id}/vehiculosAlerta), vigente y sin esa pieza vendida.
// Nunca afirma que la pieza está en existencia: invita a preguntar. Sin lista (interruptor
// apagado o sin coincidencias) no muestra NADA.
import { MENSAJES_VEHICULO_ALERTA } from '../lib/vehiculosAlerta';

export function mensajeWhatsAppVehiculoAlerta(v, pieza) {
  const vehiculo = [v.vehiculo?.marca, v.vehiculo?.modelo, v.vehiculo?.ano].filter(Boolean).join(' ');
  return `Hola, vi en Mecanix que tienen un ${vehiculo} completo. ${pieza ? `¿Tienen disponible: ${pieza}?` : '¿Tienen la pieza que busco?'}`;
}

function registrarContacto(v) {
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('event', 'contacto_yonke', { yonke: v.yonkeNombre, yonke_id: v.yonkeId, medio: 'whatsapp', ciudad: v.ciudad || 'sin_ciudad', origen: 'vehiculo_alerta' });
  }
}

export default function VehiculosDisponiblesAlerta({ lista, pieza = '' }) {
  if (!Array.isArray(lista) || lista.length === 0) return null;
  return (
    <div style={{ margin: '14px 0' }}>
      {lista.map((v) => (
        <div key={`${v.yonkeId}_${v.vehiculoAlertaId}`} style={tarjeta}>
          <p style={{ margin: 0, fontWeight: '700', color: '#1A3C5E', fontSize: '16px' }}>
            {v.yonkeNombre}
            {v.verificado && <span style={insignia}>✔ Verificado</span>}
          </p>
          {v.ciudad && <p style={{ margin: '2px 0 0', fontSize: '13px', color: '#666' }}>📍 {v.ciudad}</p>}
          <p style={{ margin: '8px 0 0', fontSize: '14px', color: '#1A3C5E', fontWeight: '600' }}>
            🚗 {v.vehiculo?.marca} {v.vehiculo?.modelo} {v.vehiculo?.ano}
          </p>
          <p style={{ margin: '6px 0 0' }}>
            <span style={etiqueta}>✅ {MENSAJES_VEHICULO_ALERTA.textoTarjetaComprador}</span>
          </p>
          <p style={{ margin: '6px 0 0', fontSize: '12px', color: '#666', lineHeight: '1.4' }}>
            Este yonke tiene el vehículo completo. Confirma por WhatsApp si todavía tiene {pieza ? `“${pieza}”` : 'la pieza'} antes de ir.
          </p>
          {v.whatsapp && (
            <a
              href={`https://wa.me/52${v.whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(mensajeWhatsAppVehiculoAlerta(v, pieza))}`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => registrarContacto(v)}
              style={botonWhatsapp}
            >
              💬 Preguntar por WhatsApp
            </a>
          )}
        </div>
      ))}
    </div>
  );
}

const tarjeta = { backgroundColor: '#fff', border: '1px solid #C5D8EC', borderRadius: '14px', padding: '14px', marginBottom: '10px' };
const insignia = { marginLeft: '8px', fontSize: '11px', fontWeight: 'bold', color: '#2E7D32', backgroundColor: '#E8F5E9', padding: '2px 8px', borderRadius: '10px', verticalAlign: 'middle' };
const etiqueta = { display: 'inline-block', backgroundColor: '#E8F5E9', color: '#2E7D32', fontSize: '12px', fontWeight: 'bold', padding: '3px 9px', borderRadius: '12px' };
const botonWhatsapp = { display: 'block', textAlign: 'center', marginTop: '10px', padding: '12px', borderRadius: '50px', backgroundColor: '#25D366', color: '#fff', fontWeight: '700', fontSize: '14px', textDecoration: 'none' };
