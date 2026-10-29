// Textos de /bienvenida (página para mandar por WhatsApp a yonkes y talleres), todos juntos para que
// el abogado los revise de una vez. Los textos de planes NO van aquí: salen de lib/planes.js (los
// mismos de la portada). Reglas de redacción: "red de yonkes" sí, "nuestros yonkes" o "nuestra red"
// no; Mecanix es un "motor de búsqueda de autopartes"; nada de cifras ni promesas nuevas.
//
import { FUNCIONES_TALLER_BASICO, FUNCIONES_TALLER_PREMIUM, PRECIO_PREMIUM_TEXTO } from './planes';

// ⚠️ [PROVISIONAL] Todo lo de este archivo está pendiente de aprobación legal. Mientras
// TEXTOS_APROBADOS sea false, la página muestra arriba AVISO_PROVISIONAL. Cuando el abogado los
// apruebe, se reemplazan por los finales y TEXTOS_APROBADOS pasa a true (el aviso desaparece).

export const TEXTOS_APROBADOS = false;
export const AVISO_PROVISIONAL = '[PROVISIONAL] Textos en revisión legal. No compartas esta página hasta que estén aprobados.';

// Vista previa (WhatsApp, Facebook) y pestaña del navegador.
export const META_BIENVENIDA = {
  titulo: 'Mecanix: motor de búsqueda de autopartes para yonkes y talleres',
  descripcion: 'Los clientes ya buscan piezas. Que te encuentren a ti. Mecanix es un motor de búsqueda de autopartes para yonkes, talleres y clientes.',
};

export const WHATSAPP_MECANIX = {
  texto: '💬 WhatsApp',
  numero: '661 103 4260',
  url: `https://wa.me/526611034260?text=${encodeURIComponent('Hola, quiero información de Mecanix')}`,
};

export const HERO = {
  etiqueta: 'Para yonkes, talleres y clientes',
  titulo: 'Los clientes ya buscan piezas. Que te encuentren a ti.',
  entrada: 'Mecanix es un motor de búsqueda de autopartes: conecta a quien busca una pieza con la red de yonkes.',
  botonYonke: 'Registrar mi yonke',
  botonTaller: 'Registrar mi taller',
  enlaceCliente: '¿Buscas una pieza? Mira cómo funciona para clientes',
};

export const ASI_FUNCIONA = {
  titulo: 'Así funciona',
  pasos: [
    { emoji: '🔍', titulo: 'Alguien busca una pieza', desc: 'Un cliente o un taller busca en Mecanix la pieza que necesita para su vehículo.' },
    { emoji: '🔔', titulo: 'El yonke se entera en tiempo real', desc: 'La búsqueda le aparece al yonke en su panel. Con la app en Android, también le llega un aviso al celular.' },
    { emoji: '🤝', titulo: 'Contesta y cierra la venta directo con el cliente', desc: 'El yonke contesta con su precio y el cliente le escribe directo por WhatsApp. Mecanix no participa en la venta ni en el pago.' },
  ],
};

// "Tus primeros pasos": el selector cambia los pasos y los planes. Los pasos marcados con una
// condición solo se muestran si la función está encendida (page.js lee las mismas banderas que la
// portada): así la página nunca anuncia algo que hoy no existe.
//   consultas: config/pedidosClientes.habilitado (búsquedas activas, "Consultar con los yonkes").
//   otrosEstados: config/pedidosClientes.otrosEstados (casilla de otros estados).
//   vehiculosCompletos: config/pedidosClientes.inventarioVehiculos (vehículo completo 30 días).
//   formularioAbierto: config/pedidosClientes.formularioAbierto. Sin ella la portada todavía muestra
//   el campo viejo "Tu WhatsApp (opcional, para avisarte cuando llegue)", así que "Mecanix no manda
//   mensajes automáticos" no sale.
export const PRIMEROS_PASOS = {
  titulo: 'Tus primeros pasos',
  tituloCliente: 'Cómo buscar tu pieza',
  opciones: { yonke: '🏪 Soy yonke', taller: '🔧 Soy taller', cliente: '🚗 Soy cliente' },
  yonke: [
    { titulo: 'Regístrate', desc: 'Crea la cuenta de tu yonke. Actualmente sin costo.' },
    { titulo: 'Instala la app', desc: 'Desde tu panel, agrega Mecanix a la pantalla de inicio de tu celular.' },
    { titulo: 'Activa los avisos (solo Android)', desc: 'Te avisamos en tu celular cuando llega una búsqueda activa o un pedido.' },
    {
      titulo: 'Contesta con "La tengo"', desc: 'Cuando alguien busca una pieza que tienes, toca "La tengo" y pon tu precio.', si: 'consultas',
      extra: { si: 'vehiculosCompletos', texto: 'Si tienes el vehículo completo, queda disponible 30 días sin capturarlo.' },
    },
    { titulo: 'Sube tu inventario (opcional)', desc: 'Vehículos, motores y piezas sueltas con fotos, para que también te encuentren en el buscador.' },
  ],
  taller: [
    { titulo: 'Registra tu taller', desc: 'Crea la cuenta de tu taller. Actualmente sin costo.' },
    { titulo: 'Haz cotizaciones con PDF', desc: 'Cotiza a tus clientes y compárteles el PDF.' },
    { titulo: 'Pide piezas a los yonkes', desc: 'Pide la pieza a los yonkes y compara sus respuestas.' },
    { titulo: 'Con Premium', desc: 'Órdenes de servicio, historial de servicios, recordatorios de mantenimiento y seguimiento de la orden para tu cliente con enlace o código QR.' },
  ],
  cliente: [
    { titulo: 'Busca tu vehículo y la pieza', desc: 'Escribe la pieza y tu vehículo (por ejemplo, "alternador civic 2016") o elige marca, modelo y año en la búsqueda avanzada. Si algún yonke de la red la tiene en su inventario, la ves al momento.' },
    {
      titulo: 'Si no aparece, consulta con los yonkes', desc: 'Toca "Consultar con los yonkes". Tu búsqueda activa se muestra a los yonkes de tu estado durante 5 días.', si: 'consultas',
      extra: { si: 'otrosEstados', texto: 'Si dejas marcada la casilla "Quiero buscar también en otros estados", también pueden responderte yonkes Verificados con Envíos Nacionales de otros estados.' },
    },
    { titulo: 'Revisa las respuestas en tu enlace', desc: 'Cada yonke que la tenga responde con su precio. Las ves en tu enlace "Mi búsqueda activa", con la insignia Verificado o la marca "Yonke nuevo, sin verificar".', si: 'consultas' },
    {
      titulo: 'Escríbele tú al yonke que prefieras', desc: 'Antes de pagar, confirma la pieza directamente con el yonke.',
      antes: { si: 'formularioAbierto', texto: 'Mecanix no manda mensajes automáticos.' },
    },
  ],
  tarjetaCliente: {
    titulo: 'Buscar no tiene costo para ti',
    texto: 'No necesitas crear una cuenta para consultar con los yonkes.',
    boton: 'Buscar una pieza',
  },
};

export const TITULO_PLANES_YONKE = 'Planes para tu yonke';
// Botón de registro de las tarjetas de planes en esta página (en la portada dicen "Registra tu …
// gratis"; aquí, igual que el hero, sin "gratis").
export const BOTON_REGISTRO_PLANES = { yonke: 'Registrar mi yonke', taller: 'Registrar mi taller' };
export const TITULO_PROXIMAMENTE = 'Próximamente en Mecanix';

// Preguntas frecuentes por pestaña (etapa 2). Mismas banderas que los pasos, más:
//   avisos: config/notificaciones.habilitado (avisos en el celular).
//   seguimiento: config/ordenes.seguimientoHabilitado (liga de seguimiento de órdenes).
//   limitesActivos y tarjetasTalleres: config/planes, igual que las tarjetas de planes.
// Una pregunta con "si" no sale con su función apagada. La respuesta son partes: cada una con su
// propio "si" (y "sino": el texto cuando está apagada); "lista" la cierra con una lista.
// Precios y funciones de planes salen de lib/planes.js, nunca escritos a mano.
export const TITULO_PREGUNTAS = 'Preguntas frecuentes';

// Cláusula 1.2 de los Términos para Talleres, citada literal (sin las excepciones del final de la
// frase, que no cambian lo que se responde aquí). La prueba comprueba que siga apareciendo tal cual
// en lib/textosLegalesTalleres.json.
export const CITA_DATOS_CLIENTES_TALLER = [
  'El Taller es el responsable del tratamiento de los datos personales de sus Clientes que capture en la Plataforma, y decide para qué y cómo se usan.',
  'Mecanix actúa únicamente como proveedor del servicio de almacenamiento de esos datos, por petición e instrucción del Taller.',
  'Mecanix no usa esos datos para fines propios',
];

// Advertencia de pago aprobada (TEXTO_AVISO_PAGO de mi-pedido/[id]/MiPedidoCliente.js), sin el
// emoji. La prueba comprueba que sea idéntica.
export const AVISO_PAGO_APROBADO = 'Antes de pagar, confirma la pieza directamente con el yonke. Con yonkes sin verificar, evita pagos por adelantado. Mecanix no participa en la venta ni en el pago.';

export const PREGUNTAS_FRECUENTES = {
  yonke: [
    {
      pregunta: '¿Cuánto cuesta?',
      respuesta: [
        { texto: 'Actualmente el plan Básico no tiene costo.' },
        { si: 'limitesActivos', texto: `El plan Premium cuesta ${PRECIO_PREMIUM_TEXTO} y es opcional.` },
      ],
    },
    {
      pregunta: '¿Tengo que subir todo mi inventario?', si: 'consultas',
      respuesta: [
        { texto: 'No. Puedes empezar solo contestando búsquedas.' },
        { si: 'vehiculosCompletos', texto: 'Los vehículos completos que confirmes se guardan 30 días en tu inventario.' },
      ],
    },
    {
      pregunta: '¿Quién cierra la venta?', si: 'consultas',
      respuesta: [{ texto: 'Tú. El cliente ve tu respuesta con tu precio y te escribe por su cuenta. El pago y la entrega los acuerdas directamente con él.' }],
    },
    {
      pregunta: '¿Qué es la insignia Verificado?',
      respuesta: [{ texto: 'Es la marca que ven los clientes cuando Mecanix confirmó personalmente que tu yonke es un negocio real. Escríbenos por WhatsApp para solicitarla.' }],
    },
    {
      pregunta: '¿Funciona en iPhone?',
      respuesta: [
        { texto: 'Se usa desde el navegador de cualquier celular y se puede agregar a la pantalla de inicio.' },
        { si: 'avisos', texto: 'Los avisos en tiempo real, por ahora, son solo para Android.' },
      ],
    },
    {
      pregunta: '¿Los yonkes de otros estados también pueden responder?', si: 'otrosEstados',
      respuesta: [{ texto: 'Solo los yonkes Verificados con Envíos Nacionales, y únicamente cuando el cliente deja marcada la casilla para buscar también en otros estados.' }],
    },
  ],
  taller: [
    {
      pregunta: '¿Cuánto cuesta?',
      respuesta: [
        { texto: 'Plan Básico, actualmente sin costo:', lista: FUNCIONES_TALLER_BASICO },
        { si: 'tarjetasTalleres', texto: `Plan Premium, ${PRECIO_PREMIUM_TEXTO}:`, lista: FUNCIONES_TALLER_PREMIUM },
      ],
    },
    {
      pregunta: '¿Mis clientes aparecen en Mecanix?',
      respuesta: [{ texto: `${CITA_DATOS_CLIENTES_TALLER.join(' ')}.` }],
    },
    {
      pregunta: '¿Cómo pido una pieza a los yonkes?',
      respuesta: [{ texto: 'Publicas el pedido con los datos del vehículo. Los yonkes responden con su precio y tú eliges a quién comprarle.' }],
    },
    {
      pregunta: '¿Qué es la liga de seguimiento?', si: 'seguimiento',
      respuesta: [{ texto: 'Es un enlace para que tu cliente vea el estado de su unidad en línea. Es una función Premium.' }],
    },
  ],
  cliente: [
    {
      pregunta: '¿Buscar tiene costo?',
      respuesta: [{
        si: 'consultas',
        texto: 'No. Buscar y consultar con los yonkes no tiene costo para ti y no necesitas crear una cuenta.',
        sino: 'No. Buscar no tiene costo para ti.',
      }],
    },
    { pregunta: '¿Cuánto dura mi búsqueda activa?', si: 'consultas', respuesta: [{ texto: '5 días.' }] },
    {
      pregunta: '¿Me van a mandar mensajes?', si: 'formularioAbierto',
      respuesta: [{ texto: 'Mecanix no manda mensajes automáticos. Las respuestas de los yonkes las ves en tu enlace y tú decides con quién hablar.' }],
    },
    { pregunta: '¿Puedo pagar directo en Mecanix?', respuesta: [{ texto: `No. ${AVISO_PAGO_APROBADO}` }] },
  ],
};

// Llamada final según la pestaña. WhatsApp con el mismo mensaje del encabezado.
export const LLAMADA_FINAL = {
  yonke: { titulo: 'Empieza a recibir búsquedas hoy', boton: 'Registrar mi yonke' },
  taller: { titulo: 'Empieza a recibir búsquedas hoy', boton: 'Registrar mi taller' },
  cliente: { titulo: '¿Buscas una pieza?', boton: 'Buscar una pieza' },
  whatsapp: 'Escríbenos por WhatsApp',
};

export const PIE = { tecnologia: 'Con tecnología Mecanix', terminos: 'Términos y Condiciones', privacidad: 'Aviso de Privacidad' };

// Pasos visibles según las banderas ({ consultas, otrosEstados, vehiculosCompletos,
// formularioAbierto }): quita los que dependen de una función apagada y agrega sus frases de antes
// (antes) o de después (extra) solo si la suya está encendida.
// Preguntas visibles: [{ pregunta, bloques: [{ texto, lista? }] }]. Las partes seguidas sin lista se
// juntan en un solo párrafo.
export function preguntasVisibles(preguntas, banderas) {
  return preguntas
    .filter((p) => !p.si || banderas[p.si] === true)
    .map(({ pregunta, respuesta }) => {
      const bloques = [];
      let abierto = null;
      for (const parte of respuesta) {
        const encendida = !parte.si || banderas[parte.si] === true;
        const texto = encendida ? parte.texto : parte.sino;
        if (!texto) continue;
        if (abierto && !abierto.lista) abierto.texto = `${abierto.texto} ${texto}`;
        else bloques.push(abierto = { texto });
        if (encendida && parte.lista) abierto.lista = parte.lista;
      }
      return { pregunta, bloques };
    });
}

export function pasosVisibles(pasos, banderas) {
  return pasos
    .filter((p) => !p.si || banderas[p.si] === true)
    .map(({ titulo, desc, antes, extra }) => ({
      titulo,
      desc: [antes, { texto: desc }, extra].filter((f) => f && (!f.si || banderas[f.si] === true)).map((f) => f.texto).join(' '),
    }));
}
