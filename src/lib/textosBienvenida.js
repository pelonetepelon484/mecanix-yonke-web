// Textos de /bienvenida (página para mandar por WhatsApp a yonkes y talleres), todos juntos para que
// el abogado los revise de una vez. Los textos de planes NO van aquí: salen de lib/planes.js (los
// mismos de la portada). Reglas de redacción: "red de yonkes" sí, "nuestros yonkes" o "nuestra red"
// no; Mecanix es un "motor de búsqueda de autopartes"; nada de cifras ni promesas nuevas.
//
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

// Etapa 2 (todavía no): preguntas frecuentes [{ pregunta, respuesta }] y llamada final
// { titulo, texto }. Vacías, la página no muestra esas secciones.
export const PREGUNTAS_FRECUENTES = [];
export const LLAMADA_FINAL = null;

export const PIE = { tecnologia: 'Con tecnología Mecanix', terminos: 'Términos y Condiciones', privacidad: 'Aviso de Privacidad' };

// Pasos visibles según las banderas ({ consultas, otrosEstados, vehiculosCompletos,
// formularioAbierto }): quita los que dependen de una función apagada y agrega sus frases de antes
// (antes) o de después (extra) solo si la suya está encendida.
export function pasosVisibles(pasos, banderas) {
  return pasos
    .filter((p) => !p.si || banderas[p.si] === true)
    .map(({ titulo, desc, antes, extra }) => ({
      titulo,
      desc: [antes, { texto: desc }, extra].filter((f) => f && (!f.si || banderas[f.si] === true)).map((f) => f.texto).join(' '),
    }));
}
