export const metadata = {
  title: 'Términos y Condiciones',
  description: 'Términos y condiciones de uso de Mecanix Yonke Virtual — la plataforma que conecta clientes con yonkes afiliados en México.',
  alternates: { canonical: '/terminos' },
  robots: { index: true, follow: true },
};

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
          Última actualización: 26 de septiembre de 2026
        </p>

        <Seccion titulo="1. Aceptación de los términos">
          <p style={parrafoStyle}>Al acceder o utilizar la plataforma Mecanix Yonke Virtual (“la Plataforma”), ya sea como cliente que busca autopartes o como yonke registrado, aceptas quedar vinculado por estos Términos y Condiciones y por nuestro Aviso de Privacidad. Si no estás de acuerdo con alguna parte, no debes utilizar la Plataforma.</p>
          <p style={parrafoStyle}>La Plataforma es operada por una persona física: <Pendiente>PENDIENTE: nombre completo del responsable</Pendiente>, con domicilio en <Pendiente>PENDIENTE: domicilio</Pendiente>.</p>
        </Seccion>

        <Seccion titulo="2. Descripción del servicio y alcance geográfico">
          <p style={parrafoStyle}>Mecanix Yonke Virtual es una plataforma digital, con sede en Tijuana, Baja California, México, que actúa como intermediario entre clientes que buscan autopartes usadas y yonkes (deshuesaderos) registrados. La Plataforma opera en varios estados de México: cada yonke elige su estado al registrarse, y la cobertura puede crecer o cambiar con el tiempo. La cobertura vigente puede consultarse en la propia Plataforma.</p>
          <p style={parrafoStyle}>Mecanix Yonke Virtual <strong>no es vendedor</strong> de autopartes. No compramos, almacenamos ni enviamos piezas. Solo conectamos a compradores con yonkes; las transacciones se realizan directamente entre el cliente y el yonke, y Mecanix no es parte de la compraventa ni de ningún acuerdo entre ellos.</p>
        </Seccion>

        <Seccion titulo="3. Registro de yonkes">
          <p style={parrafoStyle}>Para registrar un yonke, el solicitante debe proporcionar información veraz, completa y actualizada sobre su negocio, y elegir el estado donde opera. Está prohibido registrar información falsa, engañosa o negocios inexistentes.</p>
          <p style={parrafoStyle}>Mecanix Yonke Virtual puede verificar, aprobar o rechazar cualquier registro, así como suspender o eliminar cuentas que incumplan estos términos (ver sección 18).</p>
        </Seccion>

        <Seccion titulo="4. Servicio sin costo y posibles planes de pago">
          <p style={parrafoStyle}>Actualmente el uso de la Plataforma es <strong>gratuito para los yonkes</strong>: incluye publicar y administrar inventario, aparecer en los resultados de búsqueda, recibir contacto por WhatsApp, recibir reservaciones y usar las herramientas de su panel. No hay mensualidad ni suscripción vigente.</p>
          <p style={parrafoStyle}>Mecanix puede modificar las funciones del servicio gratuito e introducir en el futuro planes o funciones de pago. En ese caso lo notificaremos a los yonkes registrados con al menos 30 días naturales de anticipación, y no se cobrará ningún monto sin que el yonke lo acepte expresamente.</p>
          <p style={parrafoStyle}>Las funciones anunciadas como “próximamente” son mejoras planeadas sin fecha comprometida; su disponibilidad puede cambiar sin que esto genere obligación alguna para Mecanix.</p>
        </Seccion>

        <Seccion titulo="5. Captura de inventario a domicilio">
          <p style={parrafoStyle}>Servicio <strong>opcional</strong>, disponible <strong>únicamente en Baja California</strong> y <strong>solo a solicitud del yonke</strong>: personal de Mecanix visita el negocio para ayudar a capturar su inventario. Tiene un costo de <strong>$300 MXN por visita</strong>. No es una suscripción ni un cobro periódico: se contrata y se paga cada vez que el yonke lo solicita, y el pago se acuerda directamente entre el yonke y Mecanix.</p>
          <p style={parrafoStyle}>Mecanix puede ofrecer promociones (por ejemplo, una primera visita sin costo para yonkes nuevos), cuyas condiciones vigentes se publican en la Plataforma. Si el yonke necesita cancelar o reagendar una visita acordada, debe avisar con anticipación razonable; no se cobran visitas que no se realicen. La tarifa y la disponibilidad por estado pueden cambiar con aviso previo.</p>
          <p style={parrafoStyle}>Aun cuando el personal de Mecanix capture el inventario, el yonke sigue siendo el único responsable de que la información sea correcta y de mantenerla actualizada.</p>
        </Seccion>

        <Seccion titulo="6. Responsabilidades del yonke">
          <p style={parrafoStyle}>El yonke es responsable de la <strong>exactitud, veracidad y actualización de su inventario, precios, fotografías, logotipo, datos de contacto y disponibilidad</strong>. Debe publicar únicamente piezas que realmente tenga, retirar o marcar como no disponible lo que ya no tenga, y no publicar piezas de procedencia ilícita.</p>
          <p style={parrafoStyle}>El yonke debe atender y confirmar o cancelar en un tiempo razonable las reservaciones que reciba. El incumplimiento reiterado o la información incorrecta pueden resultar en la suspensión de la cuenta.</p>
          <p style={parrafoStyle}>El yonke es el único responsable del precio, la calidad, la condición, la entrega, la factura y la garantía de las piezas que vende, y del cumplimiento de las leyes que le apliquen (fiscales, ambientales, de protección al consumidor, entre otras). Mecanix no interviene en negociaciones de precio ni en disputas entre el yonke y el cliente.</p>
        </Seccion>

        <Seccion titulo="7. Datos de terceros que el yonke registra (clientes y vendedores de material)">
          <p style={parrafoStyle}>Algunas herramientas del panel permiten al yonke registrar datos personales de otras personas: por ejemplo, el nombre y teléfono del cliente en una nota de garantía, o el nombre, domicilio, RFC y CURP de quien le vende material en el módulo de reciclaje. Respecto de esos datos, <strong>el yonke es el responsable</strong> y Mecanix actúa como <strong>encargado</strong> que los almacena por cuenta del yonke, según se explica en el Aviso de Privacidad.</p>
          <p style={parrafoStyle}>Al usar esas herramientas el yonke se obliga a:</p>
          <p style={parrafoStyle}>(a) tener y entregar su propio aviso de privacidad a las personas cuyos datos recabe;</p>
          <p style={parrafoStyle}>(b) recabar únicamente los datos que necesite y que la ley le permita solicitar;</p>
          <p style={parrafoStyle}>(c) responder por sus propias obligaciones de conservación de registros (fiscales, contables, administrativas o de cualquier otra índole que le apliquen); y</p>
          <p style={parrafoStyle}>(d) atender él mismo las solicitudes de acceso, rectificación, cancelación u oposición (ARCO) de esas personas.</p>
          <p style={parrafoStyle}>Mecanix colabora facilitando, a solicitud del yonke, la eliminación o la entrega de una copia de los datos que este haya registrado en la Plataforma.</p>
        </Seccion>

        <Seccion titulo="8. Responsabilidades del cliente">
          <p style={parrafoStyle}>El cliente que realiza una reservación se compromete a presentarse en el yonke en el tiempo acordado o a cancelar con anticipación si no puede asistir.</p>
          <p style={parrafoStyle}>El cliente es responsable de verificar la compatibilidad de la pieza con su vehículo antes de comprarla. Mecanix no garantiza la compatibilidad de las piezas mostradas.</p>
          <p style={parrafoStyle}>El cliente acepta que el nombre y teléfono que proporcione al reservar serán compartidos con el yonke correspondiente para atender su reservación, según el Aviso de Privacidad.</p>
        </Seccion>

        <Seccion titulo="9. Insignias y distintivos">
          <p style={parrafoStyle}>La Plataforma puede mostrar insignias o distintivos en los yonkes, como <strong>Verificado</strong>, <strong>Entrega Inmediata</strong>, <strong>Envíos nacionales</strong> o <strong>Premium</strong>, y puede crear otros en el futuro. Se otorgan con base en criterios que Mecanix define y puede modificar, y pueden retirarse cuando dejen de cumplirse. <Pendiente>PENDIENTE: criterios de cada insignia, si se desea publicarlos aquí</Pendiente></p>
          <p style={parrafoStyle}>Las insignias <strong>no constituyen garantía de calidad, de disponibilidad de piezas ni de precio</strong>, ni una recomendación de Mecanix sobre el yonke. Por ejemplo, “Verificado” significa que Mecanix confirmó que se trata de un negocio real; no significa que todas sus piezas estén disponibles ni que cumplan determinada calidad.</p>
        </Seccion>

        <Seccion titulo="10. Subdominios personalizados">
          <p style={parrafoStyle}>Algunos yonkes cuentan con un subdominio propio de la Plataforma que muestra su marca (nombre, logotipo y colores). Aun así, ese sitio forma parte de la Plataforma: se rige por estos Términos y por el Aviso de Privacidad, y Mecanix sigue siendo responsable del tratamiento de los datos que se recaben ahí (por ejemplo, las reservaciones). Mecanix puede desactivar un subdominio en cualquier momento.</p>
        </Seccion>

        <Seccion titulo="11. Entrega Inmediata">
          <p style={parrafoStyle}>Algunos yonkes participan en el servicio de Entrega Inmediata, identificado con el distintivo correspondiente. En estos casos el cliente puede solicitar que Mecanix coordine el traslado de una pieza desde el yonke hasta su taller, con un costo adicional que se acuerda por separado.</p>
          <p style={parrafoStyle}>Aun cuando Mecanix participe físicamente en la entrega, esto no lo convierte en vendedor de la pieza: el yonke sigue siendo el único responsable de la calidad, condición, legalidad y garantía de la pieza. El cobro de la pieza y de la tarifa de entrega se coordina directamente, según se acuerde, y no se procesa mediante una pasarela de pagos dentro de la Plataforma. La disponibilidad de este servicio depende de cada yonke y puede cambiar en cualquier momento.</p>
        </Seccion>

        <Seccion titulo="12. Notas de garantía">
          <p style={parrafoStyle}>Mecanix pone a disposición de los yonkes una herramienta, dentro de su panel, para generar e imprimir notas de garantía por las piezas que venden.</p>
          <p style={parrafoStyle}>La garantía descrita en esa nota es ofrecida única y exclusivamente por el yonke, que define libremente sus condiciones (días de cobertura, qué cubre y qué no) y es el único responsable de cumplirlas. Mecanix no es parte de la garantía, no la respalda y no responde por su cumplimiento; cualquier reclamo debe resolverse directamente entre el cliente y el yonke.</p>
          <p style={parrafoStyle}>Los datos del cliente que el yonke capture en una nota de garantía se tratan conforme a la sección 7 y al Aviso de Privacidad.</p>
        </Seccion>

        <Seccion titulo="13. Buscador Inteligente y análisis de búsquedas">
          <p style={parrafoStyle}>El buscador de texto libre es opcional y complementario al buscador por menús. Al usarlo aceptas que el texto que ingreses y el resultado de la búsqueda se almacenen para mejorar el servicio y nuestro catálogo de vehículos.</p>
          <p style={parrafoStyle}>Mecanix analiza las búsquedas para generar información de demanda (qué piezas y vehículos se buscan y en qué zonas) que puede compartir con los yonkes <strong>únicamente de forma agregada y sin identificar al comprador</strong>.</p>
          <p style={parrafoStyle}>Podemos limitar el número de búsquedas por usuario en un periodo determinado para garantizar el buen funcionamiento de la Plataforma.</p>
        </Seccion>

        <Seccion titulo="14. Calificaciones y reseñas">
          <p style={parrafoStyle}>Las calificaciones y reseñas deben corresponder a experiencias reales. Mecanix puede eliminar las que sean falsas, malintencionadas o que violen estos términos.</p>
        </Seccion>

        <Seccion titulo="15. Contenido prohibido">
          <p style={parrafoStyle}>Está prohibido usar la Plataforma para publicar información falsa o engañosa; registrar negocios inexistentes o que no sean yonkes; realizar actividades ilegales; intentar acceder sin autorización a cuentas o datos de otros usuarios; extraer información de la Plataforma de forma automatizada o masiva sin autorización; o publicar piezas de procedencia ilícita o robada.</p>
        </Seccion>

        <Seccion titulo="16. Propiedad del contenido">
          <p style={parrafoStyle}>El nombre, logotipo y marca Mecanix Yonke Virtual, así como el software y el diseño de la Plataforma, son propiedad de sus creadores; queda prohibida su reproducción o uso sin autorización expresa por escrito.</p>
          <p style={parrafoStyle}>El contenido que el yonke publica (inventario, precios, fotografías, logotipo y su marca) sigue siendo suyo, y garantiza que tiene derecho a usarlo. Al publicarlo, el yonke otorga a Mecanix una licencia limitada, no exclusiva y gratuita para mostrarlo, almacenarlo y procesarlo dentro de la Plataforma (incluido su subdominio) con el fin de prestar el servicio.</p>
        </Seccion>

        <Seccion titulo="17. Limitación de responsabilidad">
          <p style={parrafoStyle}>Mecanix no se hace responsable por la calidad, condición, legalidad, precio ni disponibilidad real de las piezas publicadas por los yonkes, ni por los acuerdos, pagos, entregas o garantías entre yonkes y clientes, en los que no es parte.</p>
          <p style={parrafoStyle}>Mecanix no garantiza que la Plataforma esté disponible de forma ininterrumpida ni libre de errores; podemos suspender o interrumpir el servicio temporalmente por mantenimiento o causas técnicas sin responsabilidad alguna.</p>
          <p style={parrafoStyle}>En la medida permitida por la ley, Mecanix no será responsable por pérdidas económicas ni por daños directos o indirectos derivados del uso o de la imposibilidad de uso de la Plataforma.</p>
        </Seccion>

        <Seccion titulo="18. Suspensión, baja y eliminación de cuentas">
          <p style={parrafoStyle}>Mecanix puede suspender o eliminar cuentas o perfiles que incumplan estos términos, sin previo aviso cuando exista riesgo para otros usuarios o para la Plataforma, y sin responsabilidad alguna.</p>
          <p style={parrafoStyle}>El yonke puede solicitar su baja voluntaria en cualquier momento contactando a Mecanix por WhatsApp o por los medios de contacto publicados. Mecanix procesará la solicitud en un plazo máximo de 5 días hábiles: el perfil y el inventario dejan de mostrarse públicamente. La eliminación de los datos se atiende conforme al Aviso de Privacidad, a solicitud y en el plazo ahí indicado.</p>
        </Seccion>

        <Seccion titulo="19. Modificaciones a los términos">
          <p style={parrafoStyle}>Mecanix puede modificar estos Términos y Condiciones en cualquier momento. Los cambios se publican en esta página con su fecha de actualización, y el uso continuado de la Plataforma implica la aceptación de los nuevos términos. Los cambios que introduzcan planes de pago o modifiquen la tarifa de un servicio de pago se notificarán con al menos 30 días naturales de anticipación, conforme a las secciones 4 y 5.</p>
        </Seccion>

        <Seccion titulo="20. Ley aplicable y jurisdicción">
          <p style={parrafoStyle}>Estos Términos y Condiciones se rigen por las leyes de los Estados Unidos Mexicanos. Aunque la Plataforma opera en varios estados, para la interpretación y cumplimiento de estos términos las partes se someten expresamente a la jurisdicción de los tribunales competentes de <strong>Tijuana, Baja California</strong>, renunciando a cualquier otro fuero que pudiera corresponderles por su domicilio presente o futuro.</p>
        </Seccion>

        <Seccion titulo="21. Contacto">
          Para cualquier pregunta relacionada con estos Términos y Condiciones puedes contactarnos en:
          <p style={{ ...parrafoStyle, fontWeight: 'bold', color: '#1A3C5E', marginTop: '8px' }}>
            contacto@mecanixyonkevirtual.com
          </p>
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

// Marcador visible de un dato que falta por llenar antes de publicar.
function Pendiente({ children }) {
  return <span style={pendienteStyle}>[{children}]</span>;
}

const parrafoStyle = {
  marginBottom: '10px',
};

const pendienteStyle = {
  backgroundColor: '#FFF3CD', color: '#7A5A00', fontWeight: 'bold', padding: '1px 5px', borderRadius: '4px',
};
