import textosTalleres from '../../lib/textosLegalesTalleres.json';
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
          src="/logo-mecanix-solo.webp"
          alt="Mecanix"
          style={{ width: '200px', display: 'block', marginBottom: '24px' }}
        />

        <h1 style={{ color: '#1A3C5E', fontSize: '26px', marginBottom: '8px' }}>
          Aviso de Privacidad
        </h1>
        <p style={{ color: '#888', fontSize: '13px', marginBottom: '32px' }}>
          Última actualización: 26 de octubre de 2026
        </p>

        <Seccion titulo="1. Responsable del tratamiento de tus datos">
          <p style={parrafoStyle}>Mecanix Yonke Virtual (“la Plataforma”, “nosotros”) es un servicio con sede en Tijuana, Baja California, México, que conecta a clientes que buscan autopartes usadas con yonkes (deshuesaderos) registrados en varios estados de México, y que además permite a talleres registrados solicitar piezas a esos yonkes (ver sección 12). El responsable del tratamiento de tus datos personales es una persona física:</p>
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
          <p style={parrafoStyle}><strong>Yonkes registrados:</strong> nombre del negocio, estado, ciudad y dirección (escrita manualmente, no por GPS), teléfono, WhatsApp, correo electrónico, horario, métodos de pago, logotipo, inventario y precios, registro de ventas y reciclaje, calificaciones recibidas, datos de su subdominio y marca, indicador de su actividad reciente en el panel, y constancia separada de la versión, fecha y hora de aceptación de los Términos y Condiciones de Uso y del Aviso de Privacidad. Además, correo y contraseña de acceso (la contraseña la almacena de forma cifrada Firebase Authentication de Google) para los usuarios con acceso al panel.</p>
          <p style={parrafoStyle}><strong>Yonkes con cuenta ligera para responder búsquedas activas:</strong> nombre del yonke, número de WhatsApp de 10 dígitos, estado asignado a partir de la búsqueda desde cuyo enlace se registró, contraseña y constancia separada de la versión, fecha y hora de aceptación de los Términos y Condiciones de Uso y del Aviso de Privacidad. El número de WhatsApp se utiliza como identificador de acceso y para la gestión de la cuenta; además, puede mostrarse o utilizarse como medio para que el cliente contacte directamente al yonke desde el enlace de su búsqueda. No se verifica mediante código SMS o WhatsApp al crear la cuenta, por lo que Mecanix no confirma que el solicitante controle ese número ni que corresponda al negocio indicado. Si la cuenta completa posteriormente su registro comercial, estos mecanismos de acceso y seguridad continúan aplicándose a la cuenta convertida; no se limitan a la modalidad ligera.</p>
          <p style={parrafoStyle}>Durante el registro, la contraseña que proporciona el solicitante pasa temporalmente por el servidor de Mecanix para procesar la creación de la cuenta y enviarse al servicio de autenticación de Firebase. Mecanix no la guarda en sus bases de datos ni conserva una copia legible; Firebase Authentication gestiona la autenticación y conserva la credencial conforme a sus mecanismos de seguridad. Para prevenir registros duplicados y abuso, generamos un código técnico derivado del número de WhatsApp (huella o fingerprint) mediante un proceso de hash. Se utiliza para detectar registros repetidos y aplicar controles de seguridad; no se muestra públicamente ni se utiliza para contactar al usuario. Se conserva hasta por 3 años y se elimina al darse de baja o eliminarse la cuenta, salvo una excepción concreta, justificada y documentada por una obligación legal o para atender un incidente o controversia. También se utiliza la dirección IP para aplicar límites diarios de registro; el sistema la procesa dentro de un contador diario cifrado o protegido, sin conservarla vinculada al perfil de la cuenta, y el contador es temporal y se elimina automáticamente en un plazo aproximado de dos días.</p>
          <p style={parrafoStyle}>La cuenta ligera permite responder búsquedas activas, pero no incluye inventario, ventas, perfil público ni pedidos de talleres. El nombre del yonke y la información comercial de la respuesta pueden mostrarse mediante el enlace privado de la búsqueda. El número de WhatsApp registrado puede estar disponible para que el cliente contacte directamente al yonke desde ese enlace. El administrador recibe un aviso interno de registro que contiene el nombre del yonke y el estado asignado; no incluye el número de WhatsApp ni la contraseña.</p>
          <p style={parrafoStyle}><strong>Constancia de autorización para registrar un negocio.</strong> Cuando una persona registra un yonke en Mecanix, se conservará una constancia independiente de su declaración de que está autorizada para realizar el registro del negocio y utilizar los números de contacto proporcionados.</p>
          <p style={parrafoStyle}>Esta constancia incluirá la declaración realizada, la fecha y hora en que fue aceptada y su relación con el registro correspondiente.</p>
          <p style={parrafoStyle}>La aceptación de esta declaración será independiente de la aceptación de los Términos y Condiciones y del Aviso de Privacidad.</p>
          <p style={parrafoStyle}><strong>Notificaciones en el dispositivo.</strong> Si el yonke activa los avisos, guardamos un identificador técnico (token) del navegador o dispositivo que utiliza, ligado a su cuenta, con el único fin de enviarle avisos de pedidos y búsquedas activas de su interés aunque la aplicación esté cerrada. Estos avisos no contienen datos personales del cliente. Para entregarlos utilizamos el servicio Firebase Cloud Messaging de Google, que recibe el identificador y el texto del aviso. El yonke puede desactivar los avisos en cualquier momento desde la aplicación o desde los permisos de su navegador; al hacerlo, o al eliminar su cuenta, eliminamos el identificador.</p>
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
          <p style={parrafoStyle}>• Crear y administrar cuentas ligeras de yonkes, permitirles responder búsquedas activas, identificar registros duplicados, aplicar límites diarios y conservar evidencia de la aceptación de los documentos legales.</p>
          <p style={parrafoStyle}>• Mecanix podrá solicitar, registrar y conservar temporalmente las autorizaciones proporcionadas por los yonkes cuando se utilice la función «Sugerir yonke». Esto tiene como finalidad dejar constancia de que el yonke autorizó previamente el registro de su respuesta, mantener un historial de la operación y contar con evidencia para atender aclaraciones o reclamaciones relacionadas con dicha respuesta.</p>
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
          <p style={parrafoStyle}>• <strong>Firebase (Google):</strong> autenticación de usuarios del panel, base de datos y almacenamiento de archivos (por ejemplo, logotipos). En las cuentas de yonkes que utilizan WhatsApp como identificador de acceso, incluidas las que comenzaron como ligeras y después completaron el registro comercial, la contraseña proporcionada durante el registro pasa temporalmente por el servidor de Mecanix para procesar la solicitud y se transmite a Firebase Authentication, que gestiona la autenticación y la credencial. Mecanix no conserva la contraseña en sus bases de datos ni guarda una copia legible. Cuando se solicita un restablecimiento, el sistema genera una contraseña temporal de un solo uso y con vigencia limitada; el administrador puede verla una sola vez y la envía por WhatsApp al número registrado del yonke. La contraseña temporal expira al utilizarse o al vencer el plazo configurado, lo que ocurra primero, y no se conserva como dato de consulta del administrador.</p>
          <p style={parrafoStyle}>• <strong>Vercel:</strong> hospedaje del sitio; sus servidores reciben tu IP al visitarlo y, a partir de ella, nos indican tu ubicación aproximada (país, estado y ciudad).</p>
          <p style={parrafoStyle}>• <strong>Google Analytics 4:</strong> medición del uso del sitio, que se carga en todas las páginas, incluidos los subdominios de los yonkes, el panel y el área de administración.</p>
          <p style={parrafoStyle}>• <strong>Google Fonts:</strong> tu navegador descarga las tipografías desde servidores de Google, que reciben tu IP.</p>
          <p style={parrafoStyle}>• <strong>Google Maps:</strong> algunos sitios muestran un enlace a Google Maps con la dirección del yonke; solo se comunica con Google si haces clic.</p>
          <p style={parrafoStyle}>• <strong>CallMeBot:</strong> servicio con el que enviamos avisos internos al WhatsApp del administrador (por ejemplo, un nuevo registro de yonke o una búsqueda sin resultados en la que dejaste tu WhatsApp, que puede incluir ese número, lo que buscabas y datos de contacto del yonke registrado). También enviamos por ese medio avisos internos al administrador cuando un taller solicita una pieza (nombre del taller, pieza, vehículo y estado) o cuando se solicita una entrega inmediata (pieza, vehículo y nombre del yonke).</p>
          <p style={parrafoStyle}>• <strong>Firebase Cloud Messaging (Google):</strong> entrega de los avisos en el dispositivo a los yonkes que los activan (ver sección 2).</p>
          <p style={parrafoStyle}>Estos proveedores tratan los datos bajo sus propias políticas de seguridad y privacidad. Personal autorizado de la Plataforma también puede acceder a los datos para soporte, seguridad y mejora del servicio, incluido el registro individual de búsquedas.</p>
          <p style={parrafoStyle}>Podemos compartir información si una autoridad competente la requiere conforme a la ley.</p>
          <p style={parrafoStyle}>Cuando un taller solicita una pieza a los yonkes, compartimos los datos de esa solicitud conforme a la sección 12.</p>
        </Seccion>

        <Seccion titulo="6. Tus derechos ARCO">
          <p style={parrafoStyle}>Tienes derecho a <strong>acceder</strong> a tus datos personales y conocer cómo los tratamos, a <strong>rectificarlos</strong> si son inexactos, a solicitar su <strong>cancelación</strong> (eliminación) y a <strong>oponerte</strong> a su uso para fines específicos. También puedes revocar el consentimiento que nos hayas dado, o limitar el uso o divulgación de tus datos.</p>
          <p style={parrafoStyle}><strong>Cómo ejercerlos:</strong> envía tu solicitud al correo contacto@mecanixyonkevirtual.com indicando tu nombre, un medio para responderte, la descripción clara de los datos y del derecho que quieres ejercer, y algún dato que nos permita ubicarlos (por ejemplo, tu teléfono o número de pedido). Podemos pedirte que acredites tu identidad.</p>
          <p style={parrafoStyle}><strong>Plazo de respuesta:</strong> Responderemos tu solicitud en un plazo máximo de 15 días hábiles contados a partir de que la recibamos completa.</p>
          <p style={parrafoStyle}>Si dejaste tu WhatsApp en una búsqueda y quieres que lo eliminemos, escríbenos al mismo correo. Las cuentas de acceso de yonkes que se den de baja se eliminan también a solicitud por ese medio.</p>
        </Seccion>

        <Seccion titulo="7. Conservación y eliminación">
          <p style={parrafoStyle}>Conservamos tus datos mientras sean necesarios para las finalidades descritas, mientras mantengas una cuenta activa o hasta que solicites su eliminación. La eliminación se atiende a solicitud, en el plazo indicado en la sección 6. Algunos registros, como los de búsquedas (que no incluyen tu nombre), pueden conservarse para fines estadísticos, y podemos conservar información cuando una ley nos obligue a ello. Los datos que un yonke registra sobre terceros los conserva el yonke bajo su responsabilidad (sección 3).</p>
          <p style={parrafoStyle}>Para las búsquedas activas, consulta también la sección 14.</p>
          <p style={parrafoStyle}><strong>Cuentas de yonkes con acceso por WhatsApp, incluidas las cuentas ligeras y las que posteriormente completan el registro comercial.</strong> El nombre del yonke, el número de WhatsApp utilizado como identificador de acceso y medio de contacto, el estado asignado y las constancias separadas de aceptación de los Términos y Condiciones de Uso y del Aviso de Privacidad se conservan mientras la cuenta permanezca activa y hasta que se procese su eliminación, salvo los registros que deban conservarse por obligación legal o para atender controversias. La contraseña proporcionada durante el registro pasa temporalmente por el servidor de Mecanix para procesar la solicitud, pero no se guarda en sus bases de datos ni se conserva una copia legible; Firebase Authentication gestiona la credencial. Las contraseñas temporales generadas para restablecer el acceso son de un solo uso y tienen vigencia limitada; se muestran al administrador una sola vez y se envían por WhatsApp al número registrado. Expiran al utilizarse o al vencer el plazo configurado, lo que ocurra primero, y no se conservan para consulta posterior. La huella técnica derivada del número de WhatsApp se conserva hasta por 3 años y se elimina al darse de baja o eliminarse la cuenta, salvo una excepción concreta, justificada y documentada por una obligación legal o para atender un incidente o controversia. Los contadores diarios de IP utilizados para límites de registro son temporales, no se guardan vinculados al perfil y se eliminan automáticamente en un plazo aproximado de dos días.</p>
          <p style={parrafoStyle}><strong>Evidencia de autorizaciones de «Sugerir yonke».</strong> Cuando Mecanix solicite autorización a un yonke para registrar una respuesta mediante la función «Sugerir yonke», conservará como evidencia la identificación del yonke, la búsqueda relacionada, el mensaje recibido, la fecha y hora de recepción, el medio utilizado para recibir la autorización y la identificación del administrador que registró la respuesta.</p>
          <p style={parrafoStyle}>Esta información se conservará durante un plazo de 30 días naturales contados a partir de la fecha en que se registre la respuesta.</p>
          <p style={parrafoStyle}>La finalidad de conservar estos datos es acreditar que Mecanix solicitó y recibió autorización del yonke antes de registrar la respuesta, así como mantener trazabilidad y atender posibles aclaraciones o reclamaciones.</p>
          <p style={parrafoStyle}>Una vez transcurrido dicho plazo, la evidencia será eliminada, salvo que exista una reclamación iniciada dentro de ese periodo o una obligación legal que justifique conservarla durante más tiempo. En esos casos, se conservará únicamente durante el tiempo necesario para atender la situación correspondiente.</p>
        </Seccion>

        <Seccion titulo="8. Cookies y almacenamiento local">
          <p style={parrafoStyle}>Usamos Google Analytics 4, que puede colocar cookies u otras tecnologías similares para reconocer tu navegador y medir el uso del sitio de forma agregada. Se carga en todo el sitio, incluidos los subdominios de los yonkes, el panel y la administración. Puedes bloquear las cookies desde la configuración de tu navegador o con las herramientas de exclusión de Google; el sitio sigue funcionando.</p>
          <p style={parrafoStyle}>También guardamos, en el almacenamiento local de tu navegador, un dato que recuerda si ya enviaste una reseña de la Plataforma para no volver a pedírtela. Los usuarios del panel conservan además una sesión de acceso (Firebase Authentication) en su navegador mientras no cierren sesión.</p>
        </Seccion>

        <Seccion titulo="9. Seguridad">
          <p style={parrafoStyle}>Aplicamos medidas de seguridad administrativas, técnicas y físicas razonables para proteger tus datos personales, incluido el uso de proveedores con controles de acceso y gestión segura de credenciales. En las cuentas de yonkes que utilizan WhatsApp como identificador de acceso, incluidas las que comenzaron como ligeras y después completaron el registro comercial, la contraseña proporcionada al registrarse pasa temporalmente por el servidor de Mecanix para procesar la solicitud y transmitirse a Firebase Authentication; Mecanix no la conserva en sus bases de datos ni guarda una copia legible. Para restablecer el acceso, el sistema genera una contraseña temporal de un solo uso y con vigencia limitada, que el administrador puede ver una sola vez y enviar por WhatsApp al número registrado; expira al utilizarse o al vencer el plazo configurado, lo que ocurra primero. Antes del restablecimiento, Mecanix podrá solicitar información adicional razonable para comprobar que la persona está autorizada para administrar el negocio. La huella derivada del WhatsApp se utiliza como identificador técnico de prevención de duplicados y no equivale a una verificación del número. Ninguna medida es infalible: no podemos garantizar una seguridad absoluta.</p>
        </Seccion>

        <Seccion titulo="10. Menores de edad">
          <p style={parrafoStyle}>La Plataforma no está dirigida a menores de 18 años y no recopilamos intencionalmente sus datos.</p>
        </Seccion>

        <Seccion titulo="11. Cambios a este aviso">
          <p style={parrafoStyle}>Podemos actualizar este Aviso de Privacidad para reflejar cambios en la Plataforma, en nuestros proveedores o en la ley. Publicaremos la versión vigente en esta misma página con su fecha de actualización; si el cambio es importante, además lo avisaremos dentro de la Plataforma. El uso continuado de la Plataforma después de un cambio implica que lo conoces.</p>
        </Seccion>

        <Seccion titulo="12. Solicitudes de piezas de talleres">
          <p style={parrafoStyle}>Cuando un taller registrado solicita una pieza, Mecanix muestra la solicitud en el panel de los yonkes registrados en el estado correspondiente, con el nombre del taller, los datos del vehículo, la pieza y la nota del taller, con la única finalidad de que puedan confirmar si la tienen y atender la solicitud. El WhatsApp del taller solo se muestra al yonke que el taller elige. No se comparten datos personales del cliente final del taller.</p>
          <p style={parrafoStyle}>El yonke que recibe una solicitud solo puede usar esos datos para atender esa solicitud, y es responsable, bajo su propia cuenta, de la veracidad de su respuesta al confirmar que tiene la pieza.</p>
          <p style={parrafoStyle}>Esta sección aplica a los yonkes. Los talleres se rigen, además, por la sección 13.</p>
        </Seccion>

        <Seccion titulo="13. Talleres, cotizaciones y órdenes de servicio" id="talleres">
          <p style={{ ...parrafoStyle, fontSize: '13px', color: '#888' }}>Versión: {textosTalleres.version} · {textosTalleres.fecha}</p>
          <BloquesTalleres items={textosTalleres.privacidad} />
        </Seccion>

        <Seccion titulo="14. Búsquedas activas" id="pedidos-clientes">
          <p style={parrafoStyle}><strong>Datos que recabamos.</strong> Cuando registras una búsqueda activa te pedimos:</p>
          <p style={parrafoStyle}>• marca, modelo y año de tu vehículo;</p>
          <p style={parrafoStyle}>• la pieza que buscas;</p>
          <p style={parrafoStyle}>• el estado de la República donde la buscas;</p>
          <p style={parrafoStyle}>• tu número de WhatsApp.</p>
          <p style={parrafoStyle}>No necesitas crear una cuenta. No te pedimos tu nombre ni ningún dato sensible.</p>
          <p style={parrafoStyle}>Para proteger el servicio contra abusos, también registramos de forma técnica tu dirección IP y tu número de WhatsApp <strong>convertidos en un código irreversible</strong>. Solo sirven para limitar cuántas búsquedas activas se pueden registrar en cierto tiempo y se eliminan automáticamente en un plazo aproximado de dos días.</p>
          <p style={parrafoStyle}><strong>Para qué los usamos.</strong></p>
          <p style={parrafoStyle}><strong>(a)</strong> Mostrar tu búsqueda activa, sin tus datos de contacto, para que los yonkes te respondan, como se explica a continuación.</p>
          <p style={parrafoStyle}><strong>Búsquedas activas y cobertura por estado.</strong> Al registrar una búsqueda activa, mostramos los datos técnicos de tu vehículo (año, marca, modelo), la refacción que necesitas y el estado donde actualmente buscas la pieza a los yonkes locales y a los visitantes de nuestra portada que se encuentren en tu mismo estado. La casilla &quot;Quiero buscar también en otros estados&quot; viene marcada de origen para darte mayor alcance; si la mantienes activa, estos mismos datos se mostrarán en la portada pública a visitantes de todo el país y a la red de Yonkes Verificados con Envíos Nacionales. Si decides desmarcarla, la información se limitará exclusivamente a tu estado. Te garantizamos que estos datos no incluyen tu nombre, teléfono, correo electrónico ni ubicaciones específicas. Tus datos de contacto nunca se publican y tú mantienes el control total de con quién comunicarte.</p>
          <p style={parrafoStyle}><strong>(b)</strong> Mostrarte, en tu enlace privado, las respuestas de los yonkes. Las solicitudes de búsqueda activa pueden aparecer en la página pública conforme a la cobertura y a la opción de alcance que selecciones. Sin embargo, las respuestas que envían los yonkes no se publican en esa página: se muestran únicamente a través del enlace asociado a tu búsqueda.</p>
          <p style={parrafoStyle}><strong>Cómo se generan las respuestas.</strong> Mecanix cuenta con dos formas de incorporar respuestas a una búsqueda activa. (1) Mediante una cuenta ligera o comercial: el yonke que tenga la pieza ingresa a la Plataforma y envía directamente su respuesta; al hacerlo, declara que reporta tener disponible la pieza y autoriza que su respuesta y los datos comerciales que proporcione se muestren mediante el enlace de la búsqueda. (2) Mediante la función «Sugerir yonke»: el administrador de Mecanix registra en la Plataforma la respuesta que el yonke le confirmó previamente por un medio externo. En este segundo flujo, la respuesta es capturada por el administrador con base en la confirmación comunicada por el propio yonke, no por el yonke desde su cuenta. En ambos casos, la respuesta refleja lo informado por el yonke al momento de confirmarla y el cliente debe verificar directamente con él cualquier detalle antes de realizar un pago.</p>
          <p style={parrafoStyle}><strong>Respuestas registradas mediante «Sugerir yonke».</strong> Mecanix cuenta con una función denominada «Sugerir yonke», mediante la cual puede registrar una respuesta cuando un yonke informa que cuenta con una pieza solicitada por un cliente.</p>
          <p style={parrafoStyle}>Antes de registrar la respuesta, Mecanix solicitará autorización al yonke para incorporar la información proporcionada y mostrarla al cliente mediante el enlace privado de la búsqueda.</p>
          <p style={parrafoStyle}>El administrador registrará la respuesta únicamente después de recibir dicha autorización.</p>
          <p style={parrafoStyle}>Para dejar constancia del procedimiento, Mecanix conservará la identificación del yonke, la búsqueda relacionada, el mensaje recibido, la fecha y hora de recepción, el medio utilizado y la identificación del administrador que registró la respuesta. Esta evidencia se conservará durante 30 días naturales a partir del registro de la respuesta, conforme a lo establecido en la sección 7 de este Aviso de Privacidad.</p>
          <p style={parrafoStyle}>Cuando el cliente consulte la búsqueda, podrá visualizar la respuesta con la leyenda «Confirmación del yonke registrada por Mecanix». Esta leyenda indica que Mecanix recibió y registró la confirmación comunicada y autorizada por el yonke. No significa que Mecanix haya inspeccionado físicamente la pieza ni que garantice su disponibilidad, condición o compatibilidad.</p>
          <p style={parrafoStyle}>Si el yonke no proporcionó un precio, se mostrará la leyenda «Precio no informado». Mecanix no captura ni modifica el precio en este procedimiento.</p>
          <p style={parrafoStyle}><strong>Acceso al enlace.</strong> El enlace es privado en el sentido de que las respuestas no se publican en la página pública de solicitudes, pero no exige iniciar sesión ni comprobar la identidad de quien lo abre. Cualquier persona a quien compartas el enlace, o que llegue a tenerlo, podrá consultar las respuestas. Las respuestas no muestran tu número de WhatsApp ni otros datos de contacto tuyos. Comparte el enlace únicamente con personas con quienes quieras compartir la información de tu búsqueda.</p>
          <p style={parrafoStyle}><strong>(c)</strong> Avisar internamente a Mecanix de que hay una búsqueda activa nueva.</p>
          <p style={parrafoStyle}><strong>(d)</strong> Contactarte, solo si es necesario, para darle seguimiento a tu búsqueda activa.</p>
          <p style={parrafoStyle}><strong>(e)</strong> Prevenir abusos y uso indebido de la Plataforma.</p>
          <p style={parrafoStyle}>No usamos tu WhatsApp para publicidad.</p>
          <p style={parrafoStyle}><strong>Con quién compartimos tus datos.</strong></p>
          <p style={parrafoStyle}>• <strong>Yonkes:</strong> solo ven el vehículo, la pieza, el estado y la fecha de la búsqueda activa. <strong>Nunca ven tu número de WhatsApp.</strong></p>
          <p style={parrafoStyle}>Asimismo, cuando el usuario utiliza la función de Búsqueda Activa, la información de la autoparte o refacción solicitada en dicha búsqueda activa es compartida con los yonkes y yonkeros afiliados para atender la disponibilidad de la pieza dentro de la búsqueda activa autorizada por el cliente.</p>
          <p style={parrafoStyle}>• <strong>Proveedores de infraestructura</strong> que almacenan y procesan la información por cuenta de Mecanix, sin usarla para fines propios: Google LLC (Firebase / Google Cloud) y Vercel Inc.</p>
          <p style={parrafoStyle}>• El aviso interno a Mecanix sobre una búsqueda activa nueva se envía por WhatsApp mediante el servicio CallMeBot. Ese aviso <strong>no incluye tu número</strong>.</p>
          <p style={parrafoStyle}><strong>Cuando tú contactas a un yonke.</strong> Si decides contactar a un yonke desde el enlace de tu búsqueda, podrás utilizar el medio de contacto que se muestre en la respuesta, que puede incluir el número de WhatsApp del negocio. La conversación ocurre directamente entre tú y el yonke, fuera de la Plataforma. A partir de ese momento, el yonke conoce el número o los datos de contacto que tú decidas compartir y los trata por su cuenta, como responsable independiente. En el caso de una cuenta ligera, el número de WhatsApp registrado por el yonke puede utilizarse también como medio para recibir ese contacto.</p>
          <p style={parrafoStyle}><strong>Tu enlace privado.</strong> Cualquier persona que tenga tu enlace puede ver las respuestas de tu búsqueda activa y los datos comerciales que los yonkes hayan proporcionado para atenderla, incluidos los medios de contacto que se muestren en cada respuesta. Esas respuestas no incluyen tus datos de contacto. Te recomendamos compartir el enlace únicamente con personas de confianza y no publicarlo abiertamente.</p>
          <p style={parrafoStyle}><strong>Cuánto tiempo los conservamos.</strong> Tu búsqueda activa, tu número de WhatsApp y las respuestas de los yonkes se eliminan automáticamente a los <strong>5 días</strong> de haber registrado la búsqueda activa.</p>
          <p style={parrafoStyle}><strong>Tus derechos.</strong> Puedes solicitar el acceso, la rectificación o la cancelación de tus datos, u oponerte a su uso, escribiendo a contacto@mecanixyonkevirtual.com o al WhatsApp 661 103 4260. Para ubicar tu búsqueda activa nos puedes compartir tu enlace o tu número de WhatsApp. Si pides la cancelación antes de los 5 días, eliminamos tu búsqueda activa y tus datos.</p>
        </Seccion>

        <Seccion titulo="15. Contacto">
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

function Seccion({ titulo, id, children }) {
  return (
    <div id={id} style={{ marginBottom: '28px' }}>
      <h2 style={{ color: '#1A3C5E', fontSize: '17px', marginBottom: '10px' }}>{titulo}</h2>
      <div style={{ color: '#555', fontSize: '15px', lineHeight: '1.6' }}>{children}</div>
    </div>
  );
}

const parrafoStyle = {
  marginBottom: '10px',
};

function BloquesTalleres({ items }) {
  return items.map((it, i) => (it.tipo === 'subtitulo'
    ? <p key={i} style={{ ...parrafoStyle, fontWeight: 'bold', color: '#1A3C5E', marginTop: '14px' }}>{it.texto}</p>
    : <p key={i} style={parrafoStyle}>{it.texto}</p>));
}
