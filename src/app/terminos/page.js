export default function Terminos() {
  return (
    <main style={{ minHeight: '100vh', backgroundColor: '#F4F5F5', padding: '40px 20px' }}>
      <div style={{ maxWidth: '700px', margin: '0 auto', backgroundColor: '#fff', borderRadius: '16px', padding: '40px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>

        <img
          src="/mecanix-logo.webp"
          alt="Mecanix"
          style={{ width: '200px', display: 'block', marginBottom: '24px' }}
        />

        <h1 style={{ color: '#1A3C5E', fontSize: '26px', marginBottom: '8px' }}>
          Términos y Condiciones de Uso
        </h1>
        <p style={{ color: '#888', fontSize: '13px', marginBottom: '32px' }}>
          Última actualización: julio de 2026
        </p>

        <Seccion titulo="1. Aceptación de los términos">
          Al acceder o utilizar la plataforma Mecanix Yonke Virtual, ya sea como cliente que busca autopartes o como yonke registrado, aceptas quedar vinculado por estos Términos y Condiciones. Si no estás de acuerdo con alguna parte de estos términos, no debes utilizar la plataforma.
        </Seccion>

        <Seccion titulo="2. Descripción del servicio">
          <p style={parrafoStyle}>Mecanix Yonke Virtual es una plataforma digital que actúa como intermediario entre clientes que buscan autopartes usadas y yonkes (deshuesaderos) registrados en Baja California, México.</p>
          <p style={parrafoStyle}>Mecanix Yonke Virtual <strong>no es vendedor</strong> de autopartes. No compramos, almacenamos ni enviamos piezas. Las transacciones se realizan directamente entre el cliente y el yonke, y Mecanix no es parte de dicha transacción.</p>
        </Seccion>

        <Seccion titulo="3. Registro de yonkes">
          <p style={parrafoStyle}>Para registrar un yonke en la plataforma, el solicitante debe proporcionar información veraz, completa y actualizada sobre su negocio. El registro de información falsa, engañosa o de negocios inexistentes está estrictamente prohibido.</p>
          <p style={parrafoStyle}>Mecanix Yonke Virtual se reserva el derecho de verificar, aprobar o rechazar cualquier registro, así como de suspender o eliminar cuentas que incumplan estos términos, sin previo aviso y sin responsabilidad alguna.</p>
          <p style={parrafoStyle}>El yonke registrado es responsable de mantener actualizado su inventario y de responder oportunamente a las reservaciones que reciba a través de la plataforma.</p>
        </Seccion>

        <Seccion titulo="4. Planes de servicio">
          <p style={parrafoStyle}><strong>Plan Básico (anteriormente denominado Plan Freemium):</strong> acceso gratuito que permite publicar inventario y aparecer en el motor de búsqueda público. Mecanix se reserva el derecho de modificar o descontinuar este plan con notificación previa de al menos 30 días naturales a los yonkes registrados.</p>
          <p style={parrafoStyle}><strong>Plan Premium:</strong> acceso a funciones avanzadas mediante pago periódico acordado entre el yonke y Mecanix. Las condiciones de pago y renovación se establecen en un acuerdo por separado.</p>
          <p style={parrafoStyle}>Mecanix Yonke Virtual puede modificar las funciones incluidas en cada plan en cualquier momento, notificando a los yonkes registrados con al menos 30 días naturales de anticipación.</p>
        </Seccion>

        <Seccion titulo="5. Responsabilidades del yonke">
          <p style={parrafoStyle}>El yonke se compromete a publicar únicamente piezas que estén realmente disponibles en su inventario físico. Publicar piezas inexistentes o con información incorrecta puede resultar en la suspensión de la cuenta.</p>
          <p style={parrafoStyle}>El yonke es responsable de atender y confirmar o cancelar las reservaciones recibidas en un tiempo razonable. El incumplimiento reiterado de reservaciones puede resultar en la suspensión del perfil.</p>
          <p style={parrafoStyle}>El yonke es el único responsable del precio, calidad, condición y entrega de las piezas que vende. Mecanix no interviene en negociaciones de precio ni en disputas entre el yonke y el cliente.</p>
        </Seccion>

        <Seccion titulo="6. Responsabilidades del cliente">
          <p style={parrafoStyle}>El cliente que realiza una reservación se compromete a presentarse en el yonke en el tiempo acordado o a cancelar con anticipación si no puede asistir.</p>
          <p style={parrafoStyle}>El cliente es responsable de verificar la compatibilidad de la pieza con su vehículo antes de realizar la compra. Mecanix no garantiza la compatibilidad de las piezas mostradas en la plataforma.</p>
          <p style={parrafoStyle}>El cliente acepta que la información de contacto proporcionada al hacer una reservación será compartida con el yonke correspondiente para coordinar la entrega.</p>
        </Seccion>

        <Seccion titulo="7. Limitación de responsabilidad">
          <p style={parrafoStyle}>Mecanix Yonke Virtual no se hace responsable por la calidad, condición, legalidad o disponibilidad real de las piezas publicadas por los yonkes registrados.</p>
          <p style={parrafoStyle}>Mecanix no garantiza que la plataforma estará disponible de forma ininterrumpida. Podemos suspender o interrumpir el servicio temporalmente por mantenimiento o causas técnicas sin responsabilidad alguna.</p>
          <p style={parrafoStyle}>Mecanix no será responsable por pérdidas económicas, daños directos o indirectos derivados del uso o la imposibilidad de uso de la plataforma.</p>
        </Seccion>

        <Seccion titulo="8. Contenido prohibido">
          Está estrictamente prohibido utilizar la plataforma para publicar información falsa o engañosa; registrar negocios inexistentes o que no sean yonkes; utilizar la plataforma para actividades ilegales; intentar acceder sin autorización a cuentas de otros usuarios; o publicar piezas de procedencia ilícita o robada.
        </Seccion>

        <Seccion titulo="9. Calificaciones y reseñas">
          Las calificaciones publicadas en la plataforma corresponden a experiencias reales de compra. Mecanix se reserva el derecho de eliminar calificaciones que sean falsas, malintencionadas o que violen estos términos.
        </Seccion>

        <Seccion titulo="10. Propiedad intelectual">
          El nombre, logo y marca Mecanix Yonke Virtual son propiedad de sus creadores. Queda prohibida su reproducción o uso sin autorización expresa por escrito.
        </Seccion>

        <Seccion titulo="11. Modificaciones a los términos">
          <p style={parrafoStyle}>Mecanix Yonke Virtual puede modificar estos Términos y Condiciones en cualquier momento. Los cambios serán publicados en esta página con la fecha de actualización. El uso continuado de la plataforma después de dichos cambios implica la aceptación de los nuevos términos.</p>
          <p style={parrafoStyle}>Los cambios que afecten las características, condiciones o precios de los planes de suscripción se notificarán con al menos 30 días naturales de anticipación, conforme a la sección 15.</p>
        </Seccion>

        <Seccion titulo="12. Ley aplicable">
          Estos Términos y Condiciones se rigen por las leyes de los Estados Unidos Mexicanos y del Estado de Baja California. Cualquier disputa será sometida a la jurisdicción de los tribunales competentes de Tijuana, Baja California.
        </Seccion>

        <Seccion titulo="13. Contacto">
          Para cualquier pregunta relacionada con estos Términos y Condiciones puedes contactarnos en:
          <p style={{ ...parrafoStyle, fontWeight: 'bold', color: '#1A3C5E', marginTop: '8px' }}>
            powerpctijuana@gmail.com
          </p>
        </Seccion>

        <Seccion titulo="14. Planes y suscripciones">
          <p style={parrafoStyle}>Mecanix Yonke Virtual ofrece dos planes para yonkes registrados: Plan Básico y Plan Premium.</p>
          <p style={parrafoStyle}>El <strong>Plan Básico</strong> es gratuito e incluye: carga y administración de inventario, aparición en resultados de búsqueda con nombre, dirección y teléfono del yonke, botón de contacto por WhatsApp, botón de reservación para clientes y control de reservaciones desde el panel.</p>
          <p style={parrafoStyle}>El <strong>Plan Premium</strong> incluye todo lo del Plan Básico más: registro de ventas y venta manual, notificaciones push al recibir una reservación, y botón de WhatsApp para contactar al cliente que reservó.</p>
          <p style={parrafoStyle}>Las funciones anunciadas como "próximamente" son mejoras planeadas sin fecha comprometida; su disponibilidad puede cambiar sin que esto genere obligación alguna para Mecanix Yonke Virtual.</p>
        </Seccion>

        <Seccion titulo="15. Vigencia del Plan Básico">
          <p style={parrafoStyle}>El Plan Básico no tiene fecha de caducidad y permanece sin costo por tiempo indefinido.</p>
          <p style={parrafoStyle}>El yonke solo deja la plataforma si solicita su baja voluntaria.</p>
          <p style={parrafoStyle}>Mecanix Yonke Virtual se reserva el derecho de modificar las características de los planes, notificando a los yonkes registrados con al menos 30 días naturales de anticipación.</p>
        </Seccion>

        <Seccion titulo="16. Periodo de prueba y pagos del Plan Premium">
          <p style={parrafoStyle}>El Plan Premium puede incluir un periodo de prueba sin costo, cuya duración se comunica al yonke al activarlo.</p>
          <p style={parrafoStyle}>No existen cobros automáticos: los pagos se acuerdan y confirman directamente entre el yonke y Mecanix Yonke Virtual.</p>
          <p style={parrafoStyle}>Al terminar el periodo de prueba o de pago sin renovación, la cuenta regresa automáticamente al Plan Básico, sin pérdida del inventario ni de la información del yonke.</p>
          <p style={parrafoStyle}>Los pagos por periodos ya iniciados no son reembolsables.</p>
        </Seccion>

        <Seccion titulo="17. Baja de la plataforma">
          <p style={parrafoStyle}>El yonke puede solicitar su baja en cualquier momento contactando a Mecanix Yonke Virtual por WhatsApp o los medios de contacto publicados en la plataforma.</p>
          <p style={parrafoStyle}>Una vez recibida la solicitud, Mecanix Yonke Virtual la procesará en un plazo máximo de 5 días hábiles.</p>
          <p style={parrafoStyle}>Al procesarse la baja, el inventario y el perfil del yonke dejan de mostrarse públicamente, y sus datos se eliminan conforme a lo establecido en el Aviso de Privacidad.</p>
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