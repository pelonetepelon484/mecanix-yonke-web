'use client';

// "¿Quieres saber más sobre Mecanix?" de la portada (pestaña "Busco una pieza", solo antes de la
// primera búsqueda). Reemplaza al diagrama "¿Cómo funciona el buscador?" cuando /bienvenida está
// encendida (config/portada.bienvenida); apagada, la portada sigue con el diagrama, porque el
// enlace daría 404. Cada botón abre /bienvenida con su pestaña elegida. "Tengo un taller" solo con
// talleres. Evento de Google Analytics: conoce_mecanix (tipo).
import { enlaceBienvenida } from '../lib/enlaceBienvenida';

export const TITULO_CONOCE = '¿Quieres saber más sobre Mecanix?';
export const TEXTO_CONOCE = 'Te explicamos cómo funciona según quién eres.';
export const BOTONES_CONOCE = [
  { tipo: 'cliente', texto: '🚗 Soy cliente' },
  { tipo: 'yonke', texto: '🏪 Tengo un yonke' },
  { tipo: 'taller', texto: '🔧 Tengo un taller' },
];

function registrarClic(tipo) {
  if (typeof window !== 'undefined' && window.gtag) window.gtag('event', 'conoce_mecanix', { tipo });
}

export default function ConoceMecanix({ conTalleres = false }) {
  const botones = BOTONES_CONOCE.filter((b) => conTalleres || b.tipo !== 'taller');
  return (
    <section style={caja} aria-labelledby="conoce-mecanix">
      <h3 id="conoce-mecanix" style={titulo}>{TITULO_CONOCE}</h3>
      <p style={texto}>{TEXTO_CONOCE}</p>
      <div style={lista}>
        {botones.map((b) => (
          <a key={b.tipo} href={enlaceBienvenida(b.tipo)} onClick={() => registrarClic(b.tipo)} style={b.tipo === 'cliente' ? botonPrincipal : boton}>
            {b.texto}
          </a>
        ))}
      </div>
    </section>
  );
}

// Misma caja y título que tenía el diagrama (ComoFuncionaBuscador.js).
const caja = { backgroundColor: '#fff', borderRadius: '20px', padding: '24px 20px', boxShadow: '0 4px 16px rgba(26,60,94,0.07)', marginBottom: '12px', textAlign: 'center' };
const titulo = { fontSize: '14px', color: '#1A3C5E', fontWeight: '700', letterSpacing: '1px', margin: '0 0 6px', textTransform: 'uppercase' };
const texto = { fontSize: '13px', color: '#666', margin: '0 0 16px' };
const lista = { display: 'flex', flexDirection: 'column', gap: '10px', maxWidth: '420px', marginInline: 'auto' };
const boton = {
  display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '46px', borderRadius: '14px', border: '1px solid #E3EAF2',
  backgroundColor: '#F5F8FB', color: '#1A3C5E', fontSize: '14px', fontWeight: '700', textDecoration: 'none',
};
const botonPrincipal = { ...boton, backgroundColor: '#E8720C', borderColor: '#E8720C', color: '#fff' };
