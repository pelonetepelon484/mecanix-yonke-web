'use client';

import { registrarContactoRefaccionaria } from '../../lib/registrarContactoRefaccionaria';

// Botón de WhatsApp de la página pública: suma al contador del mes y registra el evento en Google
// Analytics (como contacto_yonke), sin detener el enlace.
export default function BotonWhatsappRefaccionaria({ refaccionariaId, nombre, whatsapp }) {
  const mensaje = `Hola, vi su refaccionaria ${nombre} en Mecanix. ¿Me pueden dar información de una pieza?`;
  const url = `https://wa.me/52${String(whatsapp).replace(/\D/g, '')}?text=${encodeURIComponent(mensaje)}`;
  function alTocar() {
    registrarContactoRefaccionaria(refaccionariaId);
    if (typeof window !== 'undefined' && window.gtag) {
      window.gtag('event', 'contacto_refaccionaria', { refaccionaria: nombre, refaccionaria_id: refaccionariaId, medio: 'whatsapp' });
    }
  }
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" onClick={alTocar} style={{
      display: 'block', textAlign: 'center', padding: '14px', borderRadius: '10px', backgroundColor: '#25D366',
      color: '#fff', fontWeight: 'bold', fontSize: '16px', textDecoration: 'none',
    }}>
      💬 Escribir por WhatsApp
    </a>
  );
}
