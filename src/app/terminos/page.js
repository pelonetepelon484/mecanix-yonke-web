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
          Última actualización: 9 de septiembre de 2026
        </p>

        <Seccion titulo="1. Aceptación de los términos">
          Al acceder o utilizar la plataforma Mecanix Yonke Virtual, ya sea como cliente que busca autopartes o como yonke registrado, aceptas quedar vinculado por estos Términos y Condiciones. Si no estás de acuerdo con alguna parte de estos términos, no debes utilizar la plataforma.
        </Seccion>

        <Seccion titulo="2. Descripción del servicio">
          <p style={parrafoStyle}>Mecanix Yonke Virtual es una plataforma digital, con sede en Tijuana, Baja California, México, que actúa como intermediario entre clientes que buscan autopartes usadas y yonkes (deshuesaderos) registrados en los estados de México donde la plataforma tenga cobertura. La cobertura geográfica actual puede consultarse directamente en la plataforma.</p>
          <p style={parrafoStyle}>Mecanix Yonke Virtual <strong>no es vendedor</strong> de autopartes. No compramos, almacenamos ni enviamos piezas. Las transacciones se realizan directamente entre el cliente y el yonke, y Mecanix no es parte de dicha transacción.</p>
        </Seccion>

        <Seccion titulo="3. Registro de yonkes">
          <p style={parrafoStyle}>Para registrar un yonke en la plataforma, el solicitante debe proporcionar información veraz, completa y actualizada sobre su negocio. El registro de información falsa, engañosa o de negocios inexistentes está estrictamente prohibido.</p>
          <p style={parrafoStyle}>Mecanix Yonke Virtual se reserva el derecho de verificar, aprobar o rechazar cualquier registro, así como de suspender o eliminar cuentas que incumplan estos términos, sin previo aviso y sin responsabilidad alguna.</p>
          <p style={parrafoStyle}>El yonke registrado es responsable de mantener actualizado su inventario y de responder oportunamente a las reservaciones que reciba a través de la plataforma.</p>
        </Seccion>

        <Seccion titulo="4. Planes de servicio">
          <p style={parrafoStyle}><strong>Plan Gratuito:</strong> acceso gratuito que permite publicar inventario y aparecer en el motor de búsqueda público, sin costo ni mensualidad. Mecanix se reserva el derecho de modificar este plan con notificación previa de al menos 30 días naturales a los yonkes registrados.</p>
          <p style={parrafoStyle}><strong>Servicio de captura a domicilio:</strong> servicio opcional de pago por visita (no es una suscripción ni un cobro periódico), sujeto a disponibilidad según el estado donde esté registrado el yonke. Las condiciones se detallan en la sección 14.</p>
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
          <p style={parrafoStyle}>Los cambios que afecten las características del Plan Gratuito o la disponibilidad y tarifa del servicio de captura a domicilio se notificarán con al menos 30 días naturales de anticipación, conforme a las secciones 14 y 15.</p>
        </Seccion>

        <Seccion titulo="12. Ley aplicable">
          Estos Términos y Condiciones se rigen por las leyes de los Estados Unidos Mexicanos y del Estado de Baja California. Cualquier disputa será sometida a la jurisdicción de los tribunales competentes de Tijuana, Baja California.
        </Seccion>

        <Seccion titulo="13. Contacto">
          Para cualquier pregunta relacionada con estos Términos y Condiciones puedes contactarnos en:
          <p style={{ ...parrafoStyle, fontWeight: 'bold', color: '#1A3C5E', marginTop: '8px' }}>
            contacto@mecanixyonkevirtual.com
          </p>
        </Seccion>

        <Seccion titulo="14. Plan Gratuito y servicio de captura a domicilio">
          <p style={parrafoStyle}>Mecanix Yonke Virtual ofrece un Plan Gratuito para todos los yonkes registrados, igual en todos los estados donde opera la plataforma.</p>
          <p style={parrafoStyle}>El <strong>Plan Gratuito</strong> incluye: carga y administración de inventario, aparición en resultados de búsqueda con nombre, dirección y teléfono del yonke, botón de contacto por WhatsApp, botón de reservación para clientes y control de reservaciones desde el panel. El yonke es responsable de subir y actualizar su propio inventario.</p>
          <p style={parrafoStyle}><strong>Servicio de captura a domicilio (opcional, sujeto a disponibilidad por estado):</strong> en los estados donde Mecanix cuenta con este servicio activo, el yonke puede solicitarlo cuando lo necesite para que nuestro personal visite su negocio y ayude a capturar su inventario. Es un servicio de pago por visita: se contrata y se paga cada vez que el yonke lo solicita, sin mensualidad ni suscripción asociada. Su disponibilidad depende del estado donde esté registrado el yonke; Mecanix puede activar o desactivar este servicio por estado según su capacidad operativa.</p>
          <p style={parrafoStyle}>La tarifa vigente del servicio de captura a domicilio puede consultarse en la plataforma.</p>
          <p style={parrafoStyle}>Cuando el servicio de captura a domicilio sea solicitado, el yonke sigue siendo el único responsable de que la información capturada sea correcta y de mantener actualizado su inventario después de la visita.</p>
          <p style={parrafoStyle}>Las funciones anunciadas como "próximamente" son mejoras planeadas sin fecha comprometida; su disponibilidad puede cambiar sin que esto genere obligación alguna para Mecanix Yonke Virtual.</p>
        </Seccion>

        <Seccion titulo="15. Vigencia del Plan Gratuito">
          <p style={parrafoStyle}>El Plan Gratuito no tiene fecha de caducidad y permanece sin costo por tiempo indefinido.</p>
          <p style={parrafoStyle}>El yonke solo deja la plataforma si solicita su baja voluntaria.</p>
          <p style={parrafoStyle}>Mecanix Yonke Virtual se reserva el derecho de modificar las características del Plan Gratuito, notificando a los yonkes registrados con al menos 30 días naturales de anticipación.</p>
        </Seccion>

        <Seccion titulo="16. Bienvenida y pago del servicio de captura a domicilio">
          <p style={parrafoStyle}>Los yonkes que se registran por primera vez pueden recibir, como promoción de bienvenida, la primera visita de captura de inventario sin costo, en los estados donde el servicio de captura a domicilio esté disponible. Esta promoción aplica una sola vez y sus condiciones vigentes se publican en la plataforma.</p>
          <p style={parrafoStyle}>Fuera de esa promoción de bienvenida, el servicio de captura a domicilio se paga por visita, cada vez que el yonke lo solicita. No existen cobros automáticos ni recurrentes: cada visita se acuerda y se paga directamente entre el yonke y Mecanix Yonke Virtual.</p>
          <p style={parrafoStyle}>Si el yonke necesita cancelar o reagendar una visita ya acordada, debe avisar a Mecanix Yonke Virtual con anticipación razonable; no se realiza ningún cobro por visitas que no se lleven a cabo.</p>
        </Seccion>

        <Seccion titulo="17. Baja de la plataforma">
          <p style={parrafoStyle}>El yonke puede solicitar su baja en cualquier momento contactando a Mecanix Yonke Virtual por WhatsApp o los medios de contacto publicados en la plataforma.</p>
          <p style={parrafoStyle}>Una vez recibida la solicitud, Mecanix Yonke Virtual la procesará en un plazo máximo de 5 días hábiles.</p>
          <p style={parrafoStyle}>Al procesarse la baja, el inventario y el perfil del yonke dejan de mostrarse públicamente, y sus datos se eliminan conforme a lo establecido en el Aviso de Privacidad.</p>
        </Seccion>

        <Seccion titulo="18. Buscador Inteligente">
          <p style={parrafoStyle}>El uso del buscador de texto libre es opcional y complementario al buscador estructurado por menús. Al usarlo, aceptas que el texto que ingreses sea almacenado con fines de mejora del servicio y de nuestro catálogo de vehículos.</p>
          <p style={parrafoStyle}>Nos reservamos el derecho de limitar el número de búsquedas por usuario en un periodo determinado, con el fin de garantizar el buen funcionamiento de la plataforma para todos.</p>
        </Seccion>

        <Seccion titulo="19. Entrega Inmediata">
          <p style={parrafoStyle}>Algunos yonkes participan en el servicio de Entrega Inmediata, identificado con el distintivo correspondiente en la plataforma. En estos casos, el cliente puede solicitar que Mecanix Yonke Virtual coordine el traslado de una pieza desde el yonke hasta su taller, mediante un servicio de logística operado directamente por Mecanix Yonke Virtual con un costo adicional que se acuerda por separado.</p>
          <p style={parrafoStyle}>Aun cuando Mecanix Yonke Virtual participe físicamente en la entrega, esto no lo convierte en vendedor de la pieza: el yonke sigue siendo el único responsable de la calidad, condición, legalidad y garantía de la pieza entregada. El cobro de la pieza y de la tarifa de entrega se coordina directamente entre el cliente y Mecanix Yonke Virtual o el yonke, según se acuerde, y no se procesa mediante una pasarela de pagos dentro de la plataforma.</p>
          <p style={parrafoStyle}>La disponibilidad de este servicio depende de cada yonke participante y puede cancelarse o modificarse en cualquier momento.</p>
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