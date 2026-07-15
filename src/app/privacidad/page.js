export default function Privacidad() {
  return (
    <main style={{ minHeight: '100vh', backgroundColor: '#F4F5F5', padding: '40px 20px' }}>
      <div style={{ maxWidth: '700px', margin: '0 auto', backgroundColor: '#fff', borderRadius: '16px', padding: '40px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>

        <img
          src="/mecanix-logo.webp"
          alt="Mecanix"
          style={{ width: '200px', display: 'block', marginBottom: '24px' }}
        />

        <h1 style={{ color: '#1A3C5E', fontSize: '26px', marginBottom: '8px' }}>
          Política de Privacidad
        </h1>
        <p style={{ color: '#888', fontSize: '13px', marginBottom: '32px' }}>
          Última actualización: julio de 2026
        </p>

        <Seccion titulo="1. Introducción">
          Mecanix Yonke Virtual ("la Plataforma", "nosotros") es un servicio operado en Tijuana, Baja California, México, que conecta a clientes que buscan autopartes usadas con yonkes (deshuesaderos) registrados. Esta Política de Privacidad explica qué información recopilamos, cómo la usamos y cómo la protegemos al utilizar nuestra aplicación móvil y nuestro sitio web.
        </Seccion>

        <Seccion titulo="2. Información que recopilamos">
          <p style={parrafoStyle}><strong>De los clientes que buscan piezas:</strong> nombre, número de teléfono, y la pieza y vehículo que solicitan al momento de hacer una reservación. No requerimos crear una cuenta para buscar o reservar piezas.</p>
          <p style={parrafoStyle}><strong>De los yonkes registrados:</strong> nombre del negocio, ciudad, dirección física (escrita manualmente, no mediante GPS), número de teléfono, número de WhatsApp, correo electrónico de acceso, métodos de pago aceptados, horario de atención, e inventario de vehículos y piezas disponibles.</p>
          <p style={parrafoStyle}><strong>Datos de autenticación:</strong> correo electrónico y contraseña (almacenada de forma cifrada por nuestro proveedor de autenticación, Firebase Authentication de Google) para los usuarios con acceso al panel (yonkes y administradores).</p>
          <p style={parrafoStyle}><strong>Registro propio:</strong> los yonkes pueden registrarse directamente en la plataforma a través del formulario público disponible en el sitio web. La información proporcionada durante el registro es revisada por nuestro equipo antes de ser activada públicamente.</p>
        </Seccion>

        <Seccion titulo="3. Planes de servicio">
          <p style={parrafoStyle}><strong>Plan Básico (anteriormente denominado Plan Freemium, gratuito):</strong> permite a los yonkes registrados publicar su inventario de vehículos y aparecer en el motor de búsqueda público de la plataforma, sin costo alguno.</p>
          <p style={parrafoStyle}><strong>Plan Premium (de pago):</strong> incluye funciones adicionales como gestión de reservaciones, registro de ventas, notificaciones y otras herramientas de administración del negocio.</p>
          <p style={parrafoStyle}>Mecanix Yonke Virtual se reserva el derecho de modificar las funciones incluidas en cada plan, notificando a los yonkes registrados con al menos 30 días naturales de anticipación.</p>
        </Seccion>

        <Seccion titulo="4. Cómo usamos tu información">
          <p style={parrafoStyle}>Utilizamos la información recopilada para: mostrar a los clientes qué yonkes tienen disponible el vehículo o pieza que buscan; generar y dar seguimiento a reservaciones mediante un número de pedido único; permitir que los yonkes gestionen su inventario y consulten su historial de ventas; mostrar calificaciones de servicio basadas en experiencias de compra reales; y enviar notificaciones operativas relacionadas con el funcionamiento de la plataforma.</p>
        </Seccion>

        <Seccion titulo="5. No recopilamos ubicación en tiempo real">
          La Plataforma no accede ni rastrea la ubicación GPS de tu dispositivo. Las direcciones que se muestran corresponden a la dirección del negocio (yonke), capturada manualmente por el propio yonke o por nuestro equipo durante el registro.
        </Seccion>

        <Seccion titulo="6. Con quién compartimos tu información">
          <p style={parrafoStyle}>No vendemos ni rentamos información personal a terceros. La información de contacto de un cliente (nombre y teléfono) que hace una reservación es visible únicamente para el yonke correspondiente a esa reservación, con el fin de coordinar la entrega de la pieza.</p>
          <p style={parrafoStyle}>Utilizamos servicios de terceros para operar la Plataforma, incluyendo Firebase (Google) para almacenamiento de datos y autenticación, y Vercel para el hospedaje del sitio web. Estos proveedores procesan datos en nuestro nombre bajo sus propias políticas de seguridad.</p>
        </Seccion>

        <Seccion titulo="7. Almacenamiento y seguridad">
          Los datos se almacenan en servidores de Firebase (Google Cloud) con reglas de seguridad que restringen el acceso según el rol del usuario (cliente, yonke o administrador). Solo el personal autorizado de Mecanix Yonke Virtual tiene acceso administrativo a la base de datos completa.
        </Seccion>

        <Seccion titulo="8. Tus derechos">
          Puedes solicitar la corrección o eliminación de tu información personal (incluyendo el cierre de una cuenta de yonke) escribiendo directamente al correo de contacto que aparece al final de este documento. Los yonkes registrados en el Plan Básico pueden solicitar la baja de su perfil en cualquier momento; Mecanix Yonke Virtual cuenta con un plazo máximo de 5 días hábiles para procesarla, conforme a los Términos y Condiciones.
        </Seccion>

        <Seccion titulo="9. Menores de edad">
          La Plataforma no está dirigida a menores de edad. No recopilamos intencionalmente información de personas menores de 18 años.
        </Seccion>

        <Seccion titulo="10. Cambios a esta política">
          Podemos actualizar esta Política de Privacidad ocasionalmente. Cualquier cambio será publicado en esta misma página con la fecha de actualización correspondiente.
        </Seccion>

        <Seccion titulo="11. Contacto">
          Si tienes preguntas sobre esta Política de Privacidad o sobre el manejo de tu información, puedes escribirnos a:
          <p style={{ ...parrafoStyle, fontWeight: 'bold', color: '#1A3C5E', marginTop: '8px' }}>
            powerpctijuana@gmail.com
          </p>
        </Seccion>

        <Seccion titulo="12. Datos compartidos con yonkes">
          <p style={parrafoStyle}>Al realizar una reservación, el nombre y teléfono proporcionados por el cliente se comparten únicamente con el yonke correspondiente, con el único fin de completar la reservación de la pieza.</p>
          <p style={parrafoStyle}>Los yonkes se obligan a usar estos datos solo para atender la reservación.</p>
        </Seccion>

        <Seccion titulo="13. Analítica y cookies">
          El sitio utiliza Google Analytics 4 para medir el uso de la plataforma (búsquedas, reservaciones e interés en servicios) de forma agregada, con el fin de mejorar el servicio.
        </Seccion>

        <Seccion titulo="14. Notificaciones">
          Las notificaciones push del Plan Premium requieren el consentimiento del yonke en su dispositivo y pueden desactivarse en cualquier momento desde la configuración del mismo.
        </Seccion>

        <div style={{ textAlign: 'center', marginTop: '40px' }}>
          <p style={{ color: '#aaa', fontSize: '13px', fontStyle: 'italic' }}>
            Mecanix • Tecnología al servicio del mecánico
          </p>
        </div>
      </div>
    </main>
  );
}

function Seccion({ titulo, children }) {
  return (
    <div style={{ marginBottom: '28px' }}>
      <h2 style={{ color: '#1A3C5E', fontSize: '17px', marginBottom: '10px' }}>{titulo}</h2>
      <div style={{ color: '#555', fontSize: '15px', lineHeight: '1.6' }}>{children}</div>
    </div>
  );
}

const parrafoStyle = {
  marginBottom: '10px',
};