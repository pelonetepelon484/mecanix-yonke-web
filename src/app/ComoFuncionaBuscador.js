'use client';

// "¿Cómo funciona el buscador de Mecanix?" de la portada (pestaña "Busco una pieza", solo antes
// de la primera búsqueda): diagrama de flujo hecho con HTML y CSS, sin imágenes ni librerías.
// En celular todo va hacia abajo; desde 640 px las ramas "Sí" y "No" van lado a lado.
// "Deja una alerta" solo aparece con config/pedidosClientes.habilitado, igual que el botón
// "Avisar a los yonkes"; sin la bandera (o mientras no se sabe), esa rama solo dice lo de buscar
// en otros estados. No dice cuántos años cercanos: eso depende de config/buscador.
import { useEffect, useState } from 'react';
import { leerBanderaPedidosClientes } from './lib/banderaPedidosClientes';

export const TITULO_COMO_FUNCIONA = '¿CÓMO FUNCIONA EL BUSCADOR DE MECANIX?';

const PASOS = [
  { emoji: '✍️', titulo: '1. Escribe lo que buscas', desc: '"alternador civic 2016" — entendemos pieza, marca, modelo y año' },
  { emoji: '📍', titulo: '2. Elige tu estado (o todos)' },
  { emoji: '🔍', titulo: '3. Buscamos en los yonkes de la red', desc: 'Primero tu año exacto, luego años cercanos' },
];
const RAMA_SI = [
  { emoji: '🏪', titulo: 'Ves qué yonke la tiene' },
  { emoji: '💬', titulo: 'WhatsApp o reserva' },
  // Términos 8 ("confirmar directamente con el yonke antes de pagar"), advertencia de pago aprobada
  // (TEXTO_AVISO_PAGO) y Términos 9 ("el yonke envía piezas a otros estados").
  { emoji: '🤝', titulo: 'Confirma antes de pagar', desc: 'Antes de pagar, confirma la pieza directamente con el yonke. Con yonkes sin verificar, evita pagos por adelantado. Hay yonkes que envían piezas a otros estados.' },
];
const OTROS_ESTADOS = { emoji: '🌎', titulo: 'Busca en otros estados', desc: 'Hay yonkes con envíos' };
// Aviso de privacidad, sección 14: "(b) Mostrarte, en tu enlace privado, las respuestas de los
// yonkes", "Si decides escribirle a un yonke desde tu enlace…" y "Nunca ven tu número de WhatsApp".
const ALERTA = { emoji: '🔔', titulo: 'Publica tu búsqueda', desc: 'Ves las respuestas de los yonkes en tu enlace privado y tú decides a quién escribirle. Nunca ven tu número de WhatsApp.' };

function Paso({ emoji, titulo, desc }) {
  return (
    <div style={paso}>
      <span style={{ fontSize: '22px', lineHeight: 1 }} aria-hidden="true">{emoji}</span>
      <div>
        <p style={tituloPaso}>{titulo}</p>
        {desc && <p style={descPaso}>{desc}</p>}
      </div>
    </div>
  );
}

const Flecha = () => <div style={flecha} aria-hidden="true">↓</div>;

export default function ComoFuncionaBuscador() {
  const [conAlertas, setConAlertas] = useState(false);
  useEffect(() => {
    let cancelado = false;
    leerBanderaPedidosClientes().then((v) => { if (!cancelado) setConAlertas(v); });
    return () => { cancelado = true; };
  }, []);

  return (
    <div style={caja}>
      <style>{CSS}</style>
      <h3 style={titulo}>{TITULO_COMO_FUNCIONA}</h3>
      <ol style={lista}>
        {PASOS.map((p) => (
          <li key={p.titulo}><Paso {...p} /><Flecha /></li>
        ))}
      </ol>
      <p style={pregunta}>¿La encontramos?</p>
      <div className="mecanix-como-ramas">
        <div style={rama} aria-label="Sí la encontramos">
          <p style={{ ...etiqueta, color: '#2E7D32' }}>Sí ↓</p>
          {RAMA_SI.map((p, i) => (
            <div key={p.titulo}>
              <Paso {...p} />
              {i < RAMA_SI.length - 1 && <Flecha />}
            </div>
          ))}
        </div>
        <div style={rama} aria-label="No la encontramos">
          <p style={{ ...etiqueta, color: '#E8720C' }}>No ↓</p>
          <Paso {...OTROS_ESTADOS} />
          {conAlertas && (
            <>
              <p style={separador}>o</p>
              <Paso {...ALERTA} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

const CSS = `
.mecanix-como-ramas { display: grid; grid-template-columns: 1fr; gap: 12px; }
@media (min-width: 640px) { .mecanix-como-ramas { grid-template-columns: 1fr 1fr; } }
`;

const caja = { backgroundColor: '#fff', borderRadius: '20px', padding: '24px 20px', boxShadow: '0 4px 16px rgba(26,60,94,0.07)', marginBottom: '12px' };
const titulo = { fontSize: '14px', color: '#1A3C5E', fontWeight: '700', letterSpacing: '1px', marginBottom: '16px', textAlign: 'center' };
const lista = { listStyle: 'none', margin: 0, padding: 0, maxWidth: '420px', marginInline: 'auto' };
const paso = { display: 'flex', alignItems: 'center', gap: '12px', backgroundColor: '#F5F8FB', border: '1px solid #E3EAF2', borderRadius: '14px', padding: '10px 14px', textAlign: 'left' };
const tituloPaso = { fontSize: '13px', fontWeight: '700', color: '#1A3C5E', margin: 0 };
const descPaso = { fontSize: '11px', color: '#888', margin: '2px 0 0', lineHeight: '1.4' };
const flecha = { textAlign: 'center', color: '#E8720C', fontSize: '16px', fontWeight: '700', lineHeight: '22px' };
const pregunta = { margin: '0 auto 12px', width: 'fit-content', padding: '6px 16px', borderRadius: '999px', backgroundColor: '#1A3C5E', color: '#fff', fontSize: '13px', fontWeight: '700' };
const rama = { border: '1px dashed #E3EAF2', borderRadius: '16px', padding: '10px' };
const etiqueta = { margin: '0 0 8px', fontSize: '12px', fontWeight: '700', textAlign: 'center' };
const separador = { margin: '6px 0', textAlign: 'center', fontSize: '12px', color: '#888', fontWeight: '600' };
