'use client';

import { registrarContactoRefaccionaria } from '../../lib/registrarContactoRefaccionaria';
import { formatoPrecio } from '../../../lib/refaccionarias';

// Mensaje ya escrito: desde la página, sobre la refaccionaria; desde el buscador "Piezas nuevas",
// sobre la pieza (descripción, número de parte y precio que vio el cliente).
export function mensajeWhatsappRefaccionaria(nombre, pieza) {
  if (!pieza) return `Hola, vi su refaccionaria ${nombre} en Mecanix. ¿Me pueden dar información de una pieza?`;
  const descripcion = pieza.descripcion ? `${pieza.descripcion} ` : '';
  return `Hola, vi en Mecanix la pieza ${descripcion}(No. de parte ${pieza.numeroParte}) a ${formatoPrecio(pieza.precio)}. ¿La tienen disponible?`;
}

// Botón de WhatsApp de la refaccionaria (página pública y buscador "Piezas nuevas"): suma al
// contador del mes y registra el evento en Google Analytics (como contacto_yonke), con su origen,
// sin detener el enlace.
export default function BotonWhatsappRefaccionaria({ refaccionariaId, nombre, whatsapp, pieza = null, origen = 'pagina', compacto = false }) {
  const url = `https://wa.me/52${String(whatsapp).replace(/\D/g, '')}?text=${encodeURIComponent(mensajeWhatsappRefaccionaria(nombre, pieza))}`;
  function alTocar() {
    registrarContactoRefaccionaria(refaccionariaId);
    if (typeof window !== 'undefined' && window.gtag) {
      window.gtag('event', 'contacto_refaccionaria', { refaccionaria: nombre, refaccionaria_id: refaccionariaId, medio: 'whatsapp', origen });
    }
  }
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" onClick={alTocar} style={{
      display: 'block', textAlign: 'center', padding: compacto ? '10px' : '14px', borderRadius: '10px', backgroundColor: '#25D366',
      color: '#fff', fontWeight: 'bold', fontSize: compacto ? '14px' : '16px', textDecoration: 'none',
    }}>
      💬 Escribir por WhatsApp
    </a>
  );
}
