export const metadata = {
  title: 'Aviso de Privacidad',
  description: 'Cómo Mecanix Yonke Virtual recopila, usa y protege tus datos personales al buscar refacciones o registrar tu yonke.',
  alternates: { canonical: '/privacidad' },
  robots: { index: true, follow: true },
};

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
          Aviso de Privacidad
        </h1>
        <p style={{ color: '#888', fontSize: '13px', marginBottom: '32px' }}>
          Última actualización: 26 de septiembre de 2026
        </p>

        <Seccion titulo="1. Responsable del tratamiento de tus datos">
          <p style={parrafoStyle}>Mecanix Yonke Virtual (“la Plataforma”, “nosotros”) es un servicio con sede en Tijuana, Baja California, México, que conecta a clientes que buscan autopartes usadas con yonkes (deshuesaderos) registrados en varios estados de México. El responsable del tratamiento de tus datos personales es una persona física:</p>
          <p style={parrafoStyle}><strong>Nombre:</strong> David Hernández Martínez</p>
          <p style={parrafoStyle}><strong>Domicilio:</strong> Casiopea #1-C, Colonia Sánchez Taboada, C.P. 22185, Tijuana, Baja California, México</p>
          <p style={parrafoStyle}><strong>Correo para ejercer derechos ARCO:</strong> contacto@mecanixyonkevirtual.com</p>
          <p style={parrafoStyle}>Este aviso aplica a todo el sitio, incluidos los subdominios que muestran la marca de un yonke: aunque se vean con el nombre y los colores del yonke, la Plataforma sigue siendo la responsable del tratamiento de los datos que se recaben ahí (por ejemplo, las reservaciones).</p>
        </Seccion>

        <Seccion titulo="2. Datos personales que recabamos">
          <p style={parrafoStyle}><strong>Clientes que reservan una pieza:</strong> nombre, número de teléfono, la pieza y el vehículo que solicitas, y si te interesaría un servicio de entrega a domicilio. No necesitas crear una cuenta para buscar ni reservar.</p>
          <p style={parrafoStyle}><strong>Búsquedas:</strong> cada búsqueda del buscador de texto libre guarda el texto que escribes, la pieza, marca, modelo y año que logramos identificar, el resultado (si hubo inventario o no), qué yonkes aparecieron en los resultados y tu ubicación aproximada (país, estado y ciudad), que se estima a partir de tu dirección IP. <strong>La dirección IP no se guarda en el registro de la búsqueda.</strong> Se usa de forma técnica para estimar la ubicación y para limitar cuántas búsquedas puede hacer un mismo usuario por minuto.</p>
          <p style={parrafoStyle}><strong>Contacto opcional por WhatsApp:</strong> si una búsqueda no encuentra resultados y decides dejarnos tu número de WhatsApp, lo guardamos junto con lo que buscabas. Es completamente voluntario.</p>
          <p style={parrafoStyle}><strong>Reseñas y calificaciones:</strong> las estrellas y comentarios que decidas enviar sobre la Plataforma o sobre un pedido. No te pedimos tu nombre para enviarlas.</p>
          <p style={parrafoStyle}><strong>Yonkes registrados:</strong> nombre del negocio, estado, ciudad y dirección (escrita manualmente, no por GPS), teléfono, WhatsApp, correo electrónico, horario, métodos de pago, logotipo, inventario y precios, registro de ventas y reciclaje, calificaciones recibidas, datos de su subdominio y marca, y un indicador de su actividad reciente en el panel. Además, correo y contraseña de acceso (la contraseña la almacena de forma cifrada Firebase Authentication de Google) para los usuarios con acceso al panel.</p>
          <p style={parrafoStyle}><strong>Datos técnicos:</strong> uso del sitio mediante Google Analytics 4 y cookies (ver sección 8).</p>
          <p style={parrafoStyle}>No recabamos datos personales sensibles. La Plataforma no accede a la ubicación GPS de tu dispositivo.</p>
        </Seccion>

        <Seccion titulo="3. Datos que los yonkes registran sobre terceros">
          <p style={parrafoStyle}>Algunas herramientas del panel permiten al yonke registrar datos personales de otras personas que no tienen cuenta en la Plataforma:</p>
          <p style={parrafoStyle}><strong>Reciclaje:</strong> cuando el yonke compra material al público, puede registrar el <strong>nombre</strong> (obligatorio), el <strong>domicilio</strong>, el <strong>RFC</strong> y la <strong>CURP</strong> (estos tres, opcionales) de quien le vende, junto con el material, los kilos y los montos.</p>
          <p style={parrafoStyle}><strong>Notas de garantía:</strong> el nombre y, si lo desea, el teléfono del cliente que recibe la pieza.</p>
          <p style={parrafoStyle}>Respecto de esos datos, <strong>el yonke es el responsable</strong>: decide si los recaba, para qué y por cuánto tiempo, y es quien debe entregar su propio aviso de privacidad y atender las solicitudes ARCO de esas personas. <strong>Mecanix actúa como encargado</strong>: los almacena por cuenta del yonke, sin usarlos para fines propios ni compartirlos con terceros. La única excepción es el acceso técnico del administrador de la Plataforma, por motivos de soporte y seguridad. A solicitud del yonke, facilitamos la eliminación o la entrega de una copia de esos datos.</p>
          <p style={parrafoStyle}>Si eres una de esas personas y quieres ejercer tus derechos, dirígete primero al yonke con quien tuviste el trato.</p>
        </Seccion>

        <Seccion titulo="4. Para qué usamos tus datos (finalidades)">
          <p style={parrafoStyle}><strong>Finalidades primarias</strong> (necesarias para el servicio):</p>
          <p style={parrafoStyle}>• Mostrarte qué yonkes tienen el vehículo o la pieza que buscas.</p>
          <p style={parrafoStyle}>• Generar tu reservación con un número de pedido y compartir tu contacto con el yonke para atenderla.</p>
          <p style={parrafoStyle}>• Si nos dejas tu WhatsApp, darte seguimiento o avisarte cuando la pieza esté disponible.</p>
          <p style={parrafoStyle}>• Registrar a los yonkes, administrar sus cuentas, inventario, ventas y demás herramientas del panel, y mostrar su perfil en la Plataforma.</p>
          <p style={parrafoStyle}>• Enviar avisos operativos por WhatsApp o correo (registros, reservaciones, servicios solicitados).</p>
          <p style={parrafoStyle}>• Seguridad de la Plataforma y prevención de abusos (por ejemplo, limitar la frecuencia de búsquedas), y cumplimiento de obligaciones legales.</p>
          <p style={parrafoStyle}><strong>Finalidades secundarias</strong> (no necesarias para el servicio):</p>
          <p style={parrafoStyle}>• Analizar las búsquedas para mejorar el servicio y ampliar nuestro catálogo de vehículos y piezas.</p>
          <p style={parrafoStyle}>• Generar información de demanda para los yonkes (qué se busca y dónde), <strong>solo de forma agregada y sin identificar al comprador</strong>.</p>
          <p style={parrafoStyle}>• Medir el uso del sitio con Google Analytics 4.</p>
          <p style={parrafoStyle}>Si no quieres que tus datos se usen para las finalidades secundarias, escríbenos al correo indicado en la sección 1. Tu negativa no afecta el uso de la Plataforma.</p>
        </Seccion>

        <Seccion titulo="5. Con quién compartimos tus datos">
          <p style={parrafoStyle}>No vendemos ni rentamos tus datos personales.</p>
          <p style={parrafoStyle}><strong>El yonke que atiende tu reservación</strong> recibe tu nombre, teléfono, la pieza y el vehículo, para coordinar la entrega. Es una comunicación necesaria para el servicio que solicitaste. Desde ese momento, el yonke trata esos datos como responsable por su cuenta.</p>
          <p style={parrafoStyle}><strong>Proveedores tecnológicos</strong> que procesan datos por nuestra cuenta para operar la Plataforma, algunos con servidores fuera de México:</p>
          <p style={parrafoStyle}>• <strong>Firebase (Google):</strong> autenticación de usuarios del panel, base de datos y almacenamiento de archivos (por ejemplo, logotipos).</p>
          <p style={parrafoStyle}>• <strong>Vercel:</strong> hospedaje del sitio; sus servidores reciben tu IP al visitarlo y, a partir de ella, nos indican tu ubicación aproximada (país, estado y ciudad).</p>
          <p style={parrafoStyle}>• <strong>Google Analytics 4:</strong> medición del uso del sitio, que se carga en todas las páginas, incluidos los subdominios de los yonkes, el panel y el área de administración.</p>
          <p style={parrafoStyle}>• <strong>Google Fonts:</strong> tu navegador descarga las tipografías desde servidores de Google, que reciben tu IP.</p>
          <p style={parrafoStyle}>• <strong>Google Maps:</strong> algunos sitios muestran un enlace a Google Maps con la dirección del yonke; solo se comunica con Google si haces clic.</p>
          <p style={parrafoStyle}>• <strong>CallMeBot:</strong> servicio con el que enviamos avisos internos al WhatsApp del administrador (por ejemplo, un nuevo registro de yonke o una búsqueda sin resultados en la que dejaste tu WhatsApp, que puede incluir ese número, lo que buscabas y datos de contacto del yonke registrado).</p>
          <p style={parrafoStyle}>Estos proveedores tratan los datos bajo sus propias políticas de seguridad y privacidad. Personal autorizado de la Plataforma también puede acceder a los datos para soporte, seguridad y mejora del servicio, incluido el registro individual de búsquedas.</p>
          <p style={parrafoStyle}>Podemos compartir información si una autoridad competente la requiere conforme a la ley.</p>
        </Seccion>

        <Seccion titulo="6. Tus derechos ARCO">
          <p style={parrafoStyle}>Tienes derecho a <strong>acceder</strong> a tus datos personales y conocer cómo los tratamos, a <strong>rectificarlos</strong> si son inexactos, a solicitar su <strong>cancelación</strong> (eliminación) y a <strong>oponerte</strong> a su uso para fines específicos. También puedes revocar el consentimiento que nos hayas dado, o limitar el uso o divulgación de tus datos.</p>
          <p style={parrafoStyle}><strong>Cómo ejercerlos:</strong> envía tu solicitud al correo contacto@mecanixyonkevirtual.com indicando tu nombre, un medio para responderte, la descripción clara de los datos y del derecho que quieres ejercer, y algún dato que nos permita ubicarlos (por ejemplo, tu teléfono o número de pedido). Podemos pedirte que acredites tu identidad.</p>
          <p style={parrafoStyle}><strong>Plazo de respuesta:</strong> Responderemos tu solicitud en un plazo máximo de 15 días hábiles contados a partir de que la recibamos completa.</p>
          <p style={parrafoStyle}>Si dejaste tu WhatsApp en una búsqueda y quieres que lo eliminemos, escríbenos al mismo correo. Las cuentas de acceso de yonkes que se den de baja se eliminan también a solicitud por ese medio.</p>
        </Seccion>

        <Seccion titulo="7. Conservación y eliminación">
          <p style={parrafoStyle}>Conservamos tus datos mientras sean necesarios para las finalidades descritas, mientras mantengas una cuenta activa o hasta que solicites su eliminación. La eliminación se atiende a solicitud, en el plazo indicado en la sección 6. Algunos registros, como los de búsquedas (que no incluyen tu nombre), pueden conservarse para fines estadísticos, y podemos conservar información cuando una ley nos obligue a ello. Los datos que un yonke registra sobre terceros los conserva el yonke bajo su responsabilidad (sección 3).</p>
        </Seccion>

        <Seccion titulo="8. Cookies y almacenamiento local">
          <p style={parrafoStyle}>Usamos Google Analytics 4, que puede colocar cookies u otras tecnologías similares para reconocer tu navegador y medir el uso del sitio de forma agregada. Se carga en todo el sitio, incluidos los subdominios de los yonkes, el panel y la administración. Puedes bloquear las cookies desde la configuración de tu navegador o con las herramientas de exclusión de Google; el sitio sigue funcionando.</p>
          <p style={parrafoStyle}>También guardamos, en el almacenamiento local de tu navegador, un dato que recuerda si ya enviaste una reseña de la Plataforma para no volver a pedírtela. Los usuarios del panel conservan además una sesión de acceso (Firebase Authentication) en su navegador mientras no cierren sesión.</p>
        </Seccion>

        <Seccion titulo="9. Seguridad">
          <p style={parrafoStyle}>Aplicamos medidas de seguridad administrativas, técnicas y físicas razonables para proteger tus datos personales, incluido el uso de proveedores con controles de acceso y cifrado de contraseñas. Ninguna medida es infalible: no podemos garantizar una seguridad absoluta.</p>
        </Seccion>

        <Seccion titulo="10. Menores de edad">
          <p style={parrafoStyle}>La Plataforma no está dirigida a menores de 18 años y no recopilamos intencionalmente sus datos.</p>
        </Seccion>

        <Seccion titulo="11. Cambios a este aviso">
          <p style={parrafoStyle}>Podemos actualizar este Aviso de Privacidad para reflejar cambios en la Plataforma, en nuestros proveedores o en la ley. Publicaremos la versión vigente en esta misma página con su fecha de actualización; si el cambio es importante, además lo avisaremos dentro de la Plataforma. El uso continuado de la Plataforma después de un cambio implica que lo conoces.</p>
        </Seccion>

        <Seccion titulo="12. Contacto">
          <p style={parrafoStyle}>Para dudas sobre este aviso y para ejercer tus derechos ARCO puedes escribirnos a:</p>
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

const parrafoStyle = {
  marginBottom: '10px',
};
