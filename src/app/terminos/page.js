import textosTalleres from '../../lib/textosLegalesTalleres.json';
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
          src="/logo-mecanix-solo.webp"
          alt="Mecanix"
          style={{ width: '200px', display: 'block', marginBottom: '24px' }}
        />

        <h1 style={{ color: '#1A3C5E', fontSize: '26px', marginBottom: '8px' }}>
          Términos y Condiciones de Uso
        </h1>
        <p style={{ color: '#888', fontSize: '13px', marginBottom: '32px' }}>
          Última actualización: 26 de octubre de 2026
        </p>

        <Seccion titulo="1. Aceptación de los términos">
          <p style={parrafoStyle}>Al acceder o utilizar la plataforma Mecanix Yonke Virtual (“la Plataforma”), ya sea como cliente que busca autopartes o como yonke registrado, aceptas quedar vinculado por estos Términos y Condiciones y por nuestro Aviso de Privacidad. Si no estás de acuerdo con alguna parte, no debes utilizar la Plataforma.</p>
          <p style={parrafoStyle}>La Plataforma es operada por una persona física: David Hernández Martínez, con domicilio en Casiopea #1-C, Colonia Sánchez Taboada, C.P. 22185, Tijuana, Baja California, México.</p>
        </Seccion>

        <Seccion titulo="2. Descripción del servicio y alcance geográfico">
          <p style={parrafoStyle}>Mecanix Yonke Virtual es una plataforma digital, con sede en Tijuana, Baja California, México, que actúa como intermediario entre clientes que buscan autopartes usadas y yonkes (deshuesaderos) registrados, y que además permite a talleres registrados solicitar piezas a esos yonkes (ver sección 21). La Plataforma opera en varios estados de México: cada yonke elige su estado al registrarse, y la cobertura puede crecer o cambiar con el tiempo. La cobertura vigente puede consultarse en la propia Plataforma.</p>
          <p style={parrafoStyle}>Mecanix Yonke Virtual <strong>no es vendedor</strong> de autopartes. No compramos, almacenamos ni enviamos piezas. Solo conectamos a compradores con yonkes; las transacciones se realizan directamente entre el cliente y el yonke, y Mecanix no es parte de la compraventa ni de ningún acuerdo entre ellos.</p>
        </Seccion>

        <Seccion titulo="3. Registro de yonkes">
          <p style={parrafoStyle}>Para registrar un yonke mediante el registro comercial completo, el solicitante debe proporcionar información veraz, completa y actualizada sobre su negocio, elegir el estado donde opera y aceptar por separado estos Términos y Condiciones y el Aviso de Privacidad mediante las casillas correspondientes. Está prohibido registrar información falsa, engañosa o negocios inexistentes.</p>
          <p style={parrafoStyle}><strong>Registro ligero para responder búsquedas activas.</strong> La Plataforma puede permitir que un yonke cree una cuenta ligera desde el enlace de una búsqueda activa, con el único propósito de responder solicitudes de piezas. Para crearla, el solicitante debe proporcionar el nombre del yonke, un número de WhatsApp de 10 dígitos y una contraseña de al menos 8 caracteres. Antes de crear la cuenta deberá marcar por separado las casillas de aceptación de estos Términos y Condiciones y del Aviso de Privacidad, y declarar que está autorizado para registrar el negocio y utilizar el número de WhatsApp proporcionado. El estado de la cuenta se asigna conforme al estado de la búsqueda desde cuyo enlace se inicia el registro; no se elige libremente en este flujo.</p>
          <p style={parrafoStyle}>El número de WhatsApp se utiliza como identificador de acceso junto con la contraseña. Mecanix no realiza una verificación mediante código SMS o WhatsApp al momento del registro, por lo que la creación de la cuenta no significa que Mecanix haya comprobado que el solicitante controla ese número ni que haya verificado la identidad o existencia del negocio. El solicitante declara que está autorizado para registrar el negocio y que tiene autorización para utilizar el número proporcionado. Es responsable de la exactitud de esos datos y de las consecuencias de registrar un número incorrecto o perteneciente a un tercero.</p>
          <p style={parrafoStyle}>El nombre del yonke no puede incluir las palabras “Mecanix” o “verificado”, ni expresiones que puedan hacer creer que la cuenta fue validada por Mecanix. Estas cuentas pueden identificarse como “Yonke nuevo, sin verificar”. La cuenta ligera no aparece en la portada ni en los resultados generales de búsqueda, no publica inventario ni perfil comercial, no incluye funciones de ventas ni pedidos de talleres, y no recibe insignias o distintivos por el solo hecho de registrarse.</p>
          <p style={parrafoStyle}>La cuenta ligera permite registrar hasta 15 respuestas a búsquedas activas por día natural, conforme al horario de Tijuana, Baja California. La Plataforma puede limitar el registro a un máximo de 5 cuentas por día desde una misma dirección IP y 30 cuentas en total por día. Estos límites son medidas técnicas de prevención de abuso y pueden ajustarse por razones de seguridad o funcionamiento. La cuenta ligera solo puede responder búsquedas activas disponibles para el estado asignado.</p>
          <p style={parrafoStyle}>El titular puede solicitar posteriormente completar el registro comercial para acceder a las funciones del plan que corresponda. En ese caso, podrá conservar el acceso mediante el número de WhatsApp registrado, sujeto a la validación y condiciones del registro completo. El registro completo permite responder hasta 50 búsquedas activas al día o sin límite con Premium, conforme a las condiciones vigentes del plan, y puede habilitar inventario, perfil, ventas, pedidos de talleres, presencia en la portada y buscador, e insignias sujetas a sus criterios específicos. Las funciones disponibles dependen del plan contratado y de la verificación que corresponda; no se otorgan automáticamente por convertir una cuenta ligera. La conversión a registro comercial no interrumpe ni reinicia estos mecanismos: la cuenta conserva el número de WhatsApp como identificador de acceso, la huella técnica asociada y el procedimiento de restablecimiento mediante contraseña temporal, conforme al Aviso de Privacidad.</p>
          <p style={parrafoStyle}><strong>Recuperación de contraseña.</strong> El procedimiento para recuperar la contraseña dependerá del medio que el usuario utilice para iniciar sesión.</p>
          <p style={parrafoStyle}>Si la cuenta utiliza un número de WhatsApp como medio de acceso, el titular deberá comunicarse con Mecanix por WhatsApp desde el número registrado y solicitar el restablecimiento de su contraseña. Por seguridad, Mecanix podrá solicitar información adicional para comprobar que la persona que realiza la solicitud está autorizada para administrar el negocio.</p>
          <p style={parrafoStyle}>Una vez realizada la revisión, el sistema generará una contraseña temporal de un solo uso, que tendrá una vigencia limitada. Esta contraseña dejará de ser válida cuando se utilice o cuando venza el plazo establecido por el sistema, lo que ocurra primero. El administrador podrá visualizarla una sola vez y deberá enviarla al número de WhatsApp registrado. Mecanix no conservará la contraseña temporal para consultarla o reutilizarla posteriormente.</p>
          <p style={parrafoStyle}>Si la cuenta utiliza un correo electrónico como medio de acceso, la recuperación de contraseña se realizará mediante un enlace enviado al correo electrónico asociado a la cuenta.</p>
          <p style={parrafoStyle}><strong>Activación y revisión de registros completos.</strong> Los registros comerciales completos quedan activos una vez que el usuario termina el proceso de registro, sin necesidad de una aprobación previa por parte de Mecanix.</p>
          <p style={parrafoStyle}>Sin embargo, Mecanix podrá revisar posteriormente la información y actividad de las cuentas. Si detecta información falsa, datos engañosos, incumplimiento de estos términos, uso indebido de la plataforma o cualquier situación que represente un riesgo para otros usuarios, podrá suspender o eliminar la cuenta, de acuerdo con las disposiciones de estos Términos y Condiciones.</p>
          <p style={parrafoStyle}>El hecho de que una cuenta quede activa al registrarse no significa que Mecanix haya verificado previamente la identidad, existencia o legitimidad del negocio.</p>
        </Seccion>

        <Seccion titulo="4. Planes del servicio">
          <p style={parrafoStyle}>La Plataforma ofrece dos planes. Plan Básico: sin costo; incluye la administración y publicación del inventario del yonke, la sección de pedidos y la configuración de los datos de su negocio. Plan Premium: $398.00 MXN al mes más IVA; incluye las demás funciones de la Plataforma, incluidas las que se incorporen en el futuro.</p>
          <p style={parrafoStyle}>Los avisos de pedidos y búsquedas activas en el dispositivo forman parte de la sección de pedidos del plan Básico. Su entrega depende de la conexión, de los permisos y de la configuración del dispositivo del usuario, por lo que Mecanix no garantiza que cada aviso llegue ni que llegue de inmediato; el yonke puede consultar siempre sus pedidos y búsquedas activas dentro del panel.</p>
          <p style={parrafoStyle}>Los yonkes registrados en la Plataforma antes del 12 de octubre de 2026 reciben un año del plan Premium sin costo, del 1 de noviembre de 2026 al 1 de noviembre de 2027. Al terminar ese año, el yonke decide si contrata el plan Premium o continúa en el plan Básico, y Mecanix se lo avisará con al menos 30 días naturales de anticipación. No se cobra ningún monto sin que el yonke lo acepte expresamente.</p>
          <p style={parrafoStyle}>Mecanix puede modificar las funciones de cada plan e introducir nuevos planes o funciones de pago, avisando a los yonkes registrados con al menos 30 días naturales de anticipación.</p>
        </Seccion>

        <Seccion titulo="5. Captura de inventario a domicilio">
          <p style={parrafoStyle}>Servicio <strong>opcional</strong>, disponible en los estados donde Mecanix lo ofrezca, que se indican en la Plataforma, y <strong>solo a solicitud del yonke</strong>: personal de Mecanix visita el negocio para ayudar a capturar su inventario. Tiene un costo de <strong>$300 MXN por visita</strong>. No es una suscripción ni un cobro periódico: se contrata y se paga cada vez que el yonke lo solicita, y el pago se acuerda directamente entre el yonke y Mecanix.</p>
          <p style={parrafoStyle}>Mecanix puede ofrecer promociones (por ejemplo, una primera visita sin costo para yonkes nuevos), cuyas condiciones vigentes se publican en la Plataforma. Si el yonke necesita cancelar o reagendar una visita acordada, debe avisar con anticipación razonable; no se cobran visitas que no se realicen. La tarifa y la disponibilidad por estado pueden cambiar con aviso previo.</p>
          <p style={parrafoStyle}>Aun cuando el personal de Mecanix capture el inventario, el yonke sigue siendo el único responsable de que la información sea correcta y de mantenerla actualizada.</p>
        </Seccion>

        <Seccion titulo="6. Responsabilidades del yonke">
          <p style={parrafoStyle}>El yonke es responsable de la <strong>exactitud, veracidad y actualización de su inventario, precios, fotografías, logotipo, datos de contacto y disponibilidad</strong>. Debe publicar únicamente piezas que realmente tenga, retirar o marcar como no disponible lo que ya no tenga, y no publicar piezas de procedencia ilícita.</p>
          <p style={parrafoStyle}>El yonke debe atender y confirmar o cancelar en un tiempo razonable las reservaciones que reciba. El incumplimiento reiterado o la información incorrecta pueden resultar en la suspensión de la cuenta.</p>
          <p style={parrafoStyle}>El yonke es el único responsable del precio, la calidad, la condición, la entrega, la factura y la garantía de las piezas que vende, y del cumplimiento de las leyes que le apliquen (fiscales, ambientales, de protección al consumidor, entre otras). Mecanix no interviene en negociaciones de precio ni en disputas entre el yonke y el cliente.</p>
          <p style={parrafoStyle}><strong>Respuestas a búsquedas activas de clientes.</strong> El yonke que responde una búsqueda activa, ya sea mediante una cuenta ligera o una cuenta comercial completa, se obliga a:</p>
          <p style={parrafoStyle}><strong>(a)</strong> responder con información veraz sobre la existencia, el estado y, cuando se solicite o capture, el precio de la pieza;</p>
          <p style={parrafoStyle}><strong>(b)</strong> respetar el precio informado o aclarar al cliente cualquier diferencia antes de la venta;</p>
          <p style={parrafoStyle}><strong>(c)</strong> tratar los datos que el cliente le proporcione directamente como responsable independiente y conforme a la ley aplicable.</p>
          <p style={parrafoStyle}><strong>Respuestas mediante «Sugerir yonke».</strong> Cuando se utilice la función «Sugerir yonke», el administrador de Mecanix podrá registrar en la Plataforma la respuesta que el yonke le haya confirmado previamente por un medio externo. En ese flujo, la respuesta no es capturada directamente por el yonke desde su cuenta: el administrador la incorpora con base en la confirmación recibida del negocio.</p>
          <p style={parrafoStyle}>Antes de registrar una respuesta mediante la función «Sugerir yonke», Mecanix solicitará autorización al yonke para registrar la información que este haya proporcionado y mostrarla al cliente a través del enlace privado de la búsqueda.</p>
          <p style={parrafoStyle}>El administrador de Mecanix únicamente registrará la respuesta después de recibir dicha autorización.</p>
          <p style={parrafoStyle}>Para mantener constancia de este procedimiento, Mecanix conservará los siguientes datos:</p>
          <p style={parrafoStyle}>• Identificación del yonke que autorizó la respuesta.</p>
          <p style={parrafoStyle}>• Identificación de la búsqueda relacionada.</p>
          <p style={parrafoStyle}>• Mensaje recibido del yonke mediante el cual confirma y autoriza la respuesta.</p>
          <p style={parrafoStyle}>• Fecha y hora en que se recibió el mensaje.</p>
          <p style={parrafoStyle}>• Medio por el cual se recibió la autorización.</p>
          <p style={parrafoStyle}>• Nombre o identificación del administrador de Mecanix que registró la respuesta.</p>
          <p style={parrafoStyle}>Esta información se conservará durante 30 días naturales contados a partir del registro de la respuesta, salvo que exista una reclamación o una obligación legal que justifique conservarla por más tiempo.</p>
          <p style={parrafoStyle}>La leyenda «Confirmación del yonke registrada por Mecanix» significa que Mecanix recibió y registró la confirmación comunicada y autorizada por el yonke. No significa que Mecanix haya inspeccionado físicamente la pieza ni que garantice su disponibilidad posterior, condición o compatibilidad.</p>
          <p style={parrafoStyle}>Tanto las respuestas registradas por el administrador mediante «Sugerir yonke» como las enviadas directamente por un yonke desde su cuenta se muestran al cliente a través del enlace privado asignado a la búsqueda, no en la página pública de solicitudes. El enlace puede ser compartido por el cliente y cualquier persona que tenga acceso a él podrá consultar las respuestas asociadas. La respuesta refleja lo reportado por el yonke al momento de confirmarla; no constituye garantía de disponibilidad posterior, condición, compatibilidad ni precio definitivo. Si el yonke no proporciona un precio, se mostrará la leyenda «Precio no informado»; Mecanix no captura ni edita el precio en este flujo. El cliente debe confirmar directamente con el yonke esos aspectos antes de pagar o concretar la operación. Cada yonke puede registrar una respuesta por búsqueda activa; una vez registrada, no puede editarla. Si necesita retirarla, deberá solicitarlo a Mecanix. Las respuestas falsas o engañosas pueden causar la suspensión de la cuenta o la exclusión del servicio.</p>
          <p style={parrafoStyle}>Cuando la respuesta se registre mediante «Sugerir yonke», Mecanix podrá mostrar el nombre del yonke y la información comercial que este haya confirmado para esa búsqueda. El número de WhatsApp del yonke podrá ponerse a disposición del cliente mediante el enlace para que pueda contactarlo directamente. En el caso de una cuenta ligera, el número proporcionado para el registro también funciona como medio de contacto comercial para atender la búsqueda; el titular declara que está autorizado para utilizarlo con ese fin.</p>
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
          <p style={parrafoStyle}><strong>Búsquedas activas.</strong> Al generar una búsqueda activa en nuestra plataforma, autorizas que se muestren las características del vehículo, la pieza solicitada y tu estado a los yonkes de tu misma entidad y en la portada pública del sitio a los visitantes ubicados en tu estado. Si dejas seleccionada la casilla &quot;Quiero buscar también en otros estados&quot; (activa por defecto), autorizas que dicha información sea visible también para visitantes de otros estados y para la red de Yonkes Verificados con Envíos Nacionales. Mecanix protege tu identidad: en ningún caso mostraremos tu nombre o datos de contacto en la página pública de solicitudes. Si desmarcas la casilla, la publicación de tu solicitud se limitará a tu estado.</p>
          <p style={parrafoStyle}><strong>Las respuestas no se muestran en la página pública de solicitudes</strong>; se consultan mediante el enlace privado asociado a tu búsqueda. Pueden incorporarse de dos maneras: (1) el yonke responde directamente desde su cuenta; o (2) mediante «Sugerir yonke», cuando el administrador de Mecanix registra la disponibilidad que el propio yonke le confirmó previamente por un medio externo. En este segundo caso verás la leyenda «Confirmación del yonke registrada por Mecanix»: significa que Mecanix recibió y registró lo que informó el yonke, no que haya inspeccionado la pieza ni que garantice su disponibilidad posterior, condición o compatibilidad. Si no se informó un precio, verás «Precio no informado». El enlace no requiere que quien lo abra inicie sesión: cualquier persona a quien se lo compartas, o que llegue a tenerlo, podrá ver las respuestas. Las respuestas no incluyen tu número de WhatsApp. Mecanix facilita el contacto; confirma directamente con el yonke la disponibilidad, estado, compatibilidad, precio y condiciones de envío antes de realizar cualquier pago.</p>
          <p style={parrafoStyle}>• Mecanix <strong>no vende piezas, no fija precios, no garantiza que algún yonke tenga la pieza, ni su estado, precio o disponibilidad</strong>, y no participa en el pago ni en la entrega.</p>
          <p style={parrafoStyle}>• La marca &quot;Verificado&quot; significa únicamente que Mecanix revisó la identidad del yonke conforme a sus criterios internos. No garantiza la pieza ni la operación.</p>
          <p style={parrafoStyle}>• El cliente debe confirmar directamente con el yonke antes de pagar o acudir. Se le recomienda no hacer pagos anticipados a yonkes sin verificar.</p>
          <p style={parrafoStyle}>• El cliente se obliga a proporcionar un número de WhatsApp propio y datos veraces.</p>
          <p style={parrafoStyle}>• Mecanix puede dar de baja búsquedas activas que parezcan falsas, ofensivas o abusivas, y limitar el número de búsquedas activas por persona.</p>
        </Seccion>

        <Seccion titulo="9. Insignias y distintivos">
          <p style={parrafoStyle}>La Plataforma puede mostrar insignias o distintivos en los yonkes, como <strong>Verificado</strong>, <strong>Entrega Inmediata</strong>, <strong>Envíos nacionales</strong> o <strong>Premium</strong>, y puede crear otros en el futuro. Todas las asigna y las retira Mecanix de forma manual, y sus criterios pueden ajustarse con el tiempo. Los criterios actuales son:</p>
          <p style={parrafoStyle}>• <strong>Verificado:</strong> Mecanix confirmó personalmente que el yonke es un negocio real.</p>
          <p style={parrafoStyle}>• <strong>Entrega Inmediata:</strong> el yonke participa en el servicio de entrega descrito en la sección 11.</p>
          <p style={parrafoStyle}>• <strong>Envíos nacionales:</strong> el yonke envía piezas a otros estados.</p>
          <p style={parrafoStyle}>• <strong>Premium:</strong> la cuenta tiene el plan Premium vigente.</p>
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
          <p style={parrafoStyle}>Está prohibido usar la Plataforma para publicar información falsa o engañosa; registrar negocios inexistentes o que no sean yonkes o talleres; realizar actividades ilegales; intentar acceder sin autorización a cuentas o datos de otros usuarios; extraer información de la Plataforma de forma automatizada o masiva sin autorización; publicar piezas de procedencia ilícita o robada; o enviar solicitudes de piezas falsas o sin intención real de contratar.</p>
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
          <p style={parrafoStyle}>Mecanix podrá modificar estos Términos y Condiciones cuando lo considere necesario. Las modificaciones se publicarán en la plataforma indicando la fecha de actualización.</p>
          <p style={parrafoStyle}>Cuando la naturaleza de los cambios lo requiera, Mecanix solicitará a los yonkes que acepten expresamente la nueva versión de los Términos y Condiciones mediante el mecanismo habilitado en la plataforma.</p>
          <p style={parrafoStyle}>En esos casos, los yonkes que no hayan aceptado la nueva versión no podrán responder búsquedas activas hasta completar dicha aceptación. Mecanix conservará la constancia de la versión aceptada, así como la fecha y hora en que se realizó la aceptación.</p>
          <p style={parrafoStyle}>Los cambios que impliquen nuevas tarifas o modificaciones en los servicios de pago se comunicarán con la anticipación correspondiente, conforme a las condiciones de los planes contratados.</p>
        </Seccion>

        <Seccion titulo="20. Ley aplicable y jurisdicción">
          <p style={parrafoStyle}>Estos Términos y Condiciones se rigen por las leyes de los Estados Unidos Mexicanos. Aunque la Plataforma opera en varios estados, para la interpretación y cumplimiento de estos términos las partes se someten expresamente a la jurisdicción de los tribunales competentes de <strong>Tijuana, Baja California</strong>, renunciando a cualquier otro fuero que pudiera corresponderles por su domicilio presente o futuro.</p>
        </Seccion>

        <Seccion titulo="21. Solicitudes de piezas de talleres">
          <p style={parrafoStyle}>Los talleres registrados en la Plataforma pueden solicitar una pieza indicando los datos de un vehículo. La solicitud aparece en el panel de los yonkes registrados en el estado correspondiente, con el nombre del taller, los datos del vehículo, la pieza y la nota del taller. Los yonkes que tienen la pieza responden con su precio, y el taller decide con cuál acuerda la compra, considerando los costos, las garantías y la compatibilidad. Solo al yonke elegido se le muestra el WhatsApp del taller.</p>
          <p style={parrafoStyle}>El yonke solo puede usar los datos de una solicitud para atender esa solicitud, y es el único responsable de la veracidad de su respuesta. La entrega, el pago y cualquier garantía de la pieza se acuerdan directamente entre el taller y el yonke elegido; Mecanix no es parte de ese acuerdo ni garantiza la disponibilidad, el estado o el precio de la pieza.</p>
          <p style={parrafoStyle}>Esta sección aplica a los yonkes. Los talleres se rigen, además, por la sección 22.</p>
        </Seccion>

        <Seccion titulo="22. Términos para Talleres (solo aplican a Talleres)" id="talleres">
          <p style={{ ...parrafoStyle, fontSize: '13px', color: '#888' }}>Versión: {textosTalleres.version} · {textosTalleres.fecha}</p>
          <BloquesTalleres items={textosTalleres.terminos} />
        </Seccion>

        <Seccion titulo="23. Contacto">
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
