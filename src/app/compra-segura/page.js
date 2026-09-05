export const metadata = {
  title: 'Compra segura — Mecanix Yonke Virtual',
  description: 'Mecanix es un buscador gratuito y nunca pide dinero. Consejos para comprar tu autoparte usada de forma segura, sin caer en fraudes.',
};

export default function CompraSegura() {
  return (
    <main style={{ minHeight: '100vh', backgroundColor: '#F0F2F5', padding: '32px 16px', fontFamily: "'Inter', sans-serif" }}>
      <div style={{ maxWidth: '620px', margin: '0 auto' }}>
        <a href="/" style={{ color: '#1A3C5E', fontSize: '13px', fontWeight: '700', textDecoration: 'none' }}>
          ← Volver al buscador
        </a>

        <div style={{ textAlign: 'center', margin: '20px 0 24px' }}>
          <p style={{ fontSize: '40px', margin: '0 0 8px' }}>🛡️</p>
          <h1 style={{ color: '#1A3C5E', fontSize: '22px', fontWeight: '700', margin: '0 0 8px' }}>
            Compra segura
          </h1>
          <p style={{ color: '#666', fontSize: '14px', lineHeight: '1.6', maxWidth: '480px', margin: '0 auto' }}>
            Mecanix conecta compradores con yonkes — nosotros no vendemos, no cobramos y nunca
            manejamos tu dinero. Estos consejos te ayudan a comprar tranquilo.
          </p>
        </div>

        {/* Mensaje principal — mismo texto que el aviso de la página de inicio, completo */}
        <div style={{
          backgroundColor: '#FFF4E5', border: '2px solid #E8720C', borderRadius: '20px',
          padding: '22px 24px', marginBottom: '20px',
        }}>
          <p style={{ margin: '0 0 12px', fontSize: '16px', fontWeight: '700', color: '#7A4F00' }}>
            ⚠️ Importante
          </p>
          <ul style={{ margin: 0, padding: '0 0 0 20px', fontSize: '14px', color: '#5C3D00', lineHeight: '1.8' }}>
            <li>Mecanix es un buscador gratuito. <strong>Nunca</strong> te pedimos dinero ni cobramos por las piezas.</li>
            <li>Paga tu pieza directamente al yonke, en persona, cuando la tengas frente a ti. Nunca pagues por adelantado.</li>
            <li>Desconfía de cualquiera que te pida un depósito o &quot;apartado&quot; a nombre de Mecanix. Nosotros nunca hacemos eso.</li>
            <li>Revisa la pieza antes de pagar y confirma que sea la correcta para tu vehículo.</li>
          </ul>
        </div>

        <h2 style={{ color: '#1A3C5E', fontSize: '15px', fontWeight: '700', margin: '0 0 12px' }}>
          Más consejos antes de ir por tu pieza
        </h2>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '28px' }}>
          <Consejo emoji="📍" titulo="Confirma la dirección antes de ir">
            Ubica el yonke en el mapa y confirma que la dirección que te dieron coincide con la
            que aparece en su búsqueda. Si algo no cuadra, pregunta antes de moverte.
          </Consejo>
          <Consejo emoji="🔵" titulo="Prefiere yonkes con el sello Mecanix Verificado">
            El sello azul significa que confirmamos personalmente que ese negocio es real.
            No es garantía de cada pieza, pero sí de que hablas con un negocio establecido.{' '}
            <a href="/verificados" style={{ color: '#1A3C5E', fontWeight: '700' }}>Ver yonkes verificados →</a>
          </Consejo>
          <Consejo emoji="🔧" titulo="Confirma el número de parte y la compatibilidad">
            Antes de moverte, confirma con el yonke el año, modelo y detalles de tu vehículo para
            asegurar que la pieza sí es compatible — así evitas viajes en falso.
          </Consejo>
          <Consejo emoji="💬" titulo="Coordina siempre por un medio que puedas mostrar">
            Habla por WhatsApp o llamada, no por mensajes que se puedan borrar sin dejar rastro.
            Si algo sale mal, tener la conversación guardada ayuda a resolverlo.
          </Consejo>
          <Consejo emoji="⭐" titulo="Después de tu compra, califica tu experiencia">
            Tu calificación ayuda a que otros compradores sepan qué yonkes cumplen — y a nosotros
            a detectar negocios que no deberían seguir en la plataforma.{' '}
            <a href="/calificar" style={{ color: '#1A3C5E', fontWeight: '700' }}>Calificar →</a>
          </Consejo>
        </div>

        <div style={{ backgroundColor: '#fff', borderRadius: '16px', padding: '20px', textAlign: 'center', boxShadow: '0 2px 10px rgba(26,60,94,0.07)' }}>
          <p style={{ margin: '0 0 10px', fontSize: '13px', color: '#555', lineHeight: '1.6' }}>
            ¿Alguien te pidió dinero a nombre de Mecanix, o algo no te dio confianza?
            Repórtalo — nos ayuda a proteger a los demás compradores.
          </p>
          <a
            href="https://wa.me/526611034260"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-block', backgroundColor: '#25D366', color: '#fff', fontWeight: '700',
              fontSize: '13px', padding: '10px 20px', borderRadius: '50px', textDecoration: 'none',
            }}
          >
            💬 Reportar por WhatsApp
          </a>
        </div>
      </div>
    </main>
  );
}

function Consejo({ emoji, titulo, children }) {
  return (
    <div style={{ display: 'flex', gap: '14px', backgroundColor: '#fff', borderRadius: '14px', padding: '16px', boxShadow: '0 2px 10px rgba(26,60,94,0.07)' }}>
      <span style={{ fontSize: '24px', flexShrink: 0 }}>{emoji}</span>
      <div>
        <p style={{ margin: '0 0 4px', fontWeight: '700', color: '#1A3C5E', fontSize: '14px' }}>{titulo}</p>
        <p style={{ margin: 0, color: '#666', fontSize: '13px', lineHeight: '1.6' }}>{children}</p>
      </div>
    </div>
  );
}
