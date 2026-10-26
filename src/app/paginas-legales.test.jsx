// @vitest-environment jsdom
import { describe, expect, it, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import Privacidad from './privacidad/page.js';
import Terminos from './terminos/page.js';
import { TEXTO_CASILLA_OTROS_ESTADOS, TEXTO_CONSENTIMIENTO_OTROS_ESTADOS } from '../lib/pedidosClientes';
import { VERSION_LEGAL } from '../lib/versionesLegales';

// "Búsqueda activa" como nombre único (aprobado por el abogado el 26 de octubre de 2026): casilla
// (TEXTO 1), Aviso de Privacidad sección 14 (TEXTO 2, con sus dos ajustes) y Términos sección 8
// (TEXTO 3). Reemplazan los textos de "Avisar a los yonkes" / "alerta" (legal-pedido-clientes-para-abogado.md
// y los cambios del 10 de octubre), que ya no se publican.
const CASILLA = 'Quiero buscar también en otros estados.';
const CONSENTIMIENTO = 'Si la dejas marcada, mostraremos los datos de tu vehículo, la pieza que buscas y tu estado en nuestra portada y a la red de yonkes Verificados con Envíos Nacionales de todo el país. Así aumentas tus posibilidades de encontrarla. Jamás mostraremos tu nombre, teléfono ni datos de contacto. Si la desmarcas, tu búsqueda solo será visible dentro de tu propio estado.';
const TEXTO_2 = 'Búsquedas activas y cobertura por estado. Al registrar una búsqueda activa, mostramos los datos técnicos de tu vehículo (año, marca, modelo), la refacción que necesitas y el estado donde actualmente buscas la pieza a los yonkes locales y a los visitantes de nuestra portada que se encuentren en tu mismo estado. La casilla "Quiero buscar también en otros estados" viene marcada de origen para darte mayor alcance; si la mantienes activa, estos mismos datos se mostrarán en la portada pública a visitantes de todo el país y a la red de Yonkes Verificados con Envíos Nacionales. Si decides desmarcarla, la información se limitará exclusivamente a tu estado. Te garantizamos que estos datos no incluyen tu nombre, teléfono, correo electrónico ni ubicaciones específicas. Tus datos de contacto nunca se publican y tú mantienes el control total de con quién comunicarte.';
const TEXTO_3 = 'Búsquedas activas. Al generar una búsqueda activa en nuestra plataforma, autorizas que se muestren las características del vehículo, la pieza solicitada y tu estado a los yonkes de tu misma entidad y en la portada del sitio a los visitantes ubicados en tu estado. Si dejas seleccionada la casilla "Quiero buscar también en otros estados" (activa por defecto), autorizas que dicha información sea visible también para visitantes de otros estados y para la red de Yonkes Verificados con Envíos Nacionales. Mecanix protege tu identidad: en ningún caso mostraremos tu nombre o datos de contacto en áreas públicas o comerciales. Si desmarcas la casilla, tu búsqueda se mantendrá estrictamente local. Mecanix funciona como un puente de contacto; no garantizamos que algún yonke cuente con la pieza y es responsabilidad del usuario confirmar el estado de la refacción y las condiciones de envío directamente con el vendedor antes de realizar cualquier pago.';
// Sección 14 completa, en orden (el resto del contenido se conserva, solo con el nombre nuevo).
const SECCION_14 = [
  '14. Búsquedas activas',
  'Datos que recabamos. Cuando registras una búsqueda activa te pedimos:',
  '• marca, modelo y año de tu vehículo;', '• la pieza que buscas;', '• el estado de la República donde la buscas;', '• tu número de WhatsApp.',
  'No necesitas crear una cuenta. No te pedimos tu nombre ni ningún dato sensible.',
  'Para proteger el servicio contra abusos, también registramos de forma técnica tu dirección IP y tu número de WhatsApp convertidos en un código irreversible. Solo sirven para limitar cuántas búsquedas activas se pueden registrar en cierto tiempo y se eliminan automáticamente en un plazo aproximado de dos días.',
  'Para qué los usamos.',
  '(a) Mostrar tu búsqueda activa, sin tus datos de contacto, para que los yonkes te respondan, como se explica a continuación.',
  TEXTO_2,
  '(b) Mostrarte, en tu enlace privado, las respuestas de los yonkes.',
  '(c) Avisar internamente a Mecanix de que hay una búsqueda activa nueva.',
  '(d) Contactarte, solo si es necesario, para darle seguimiento a tu búsqueda activa.',
  '(e) Prevenir abusos y uso indebido de la Plataforma.',
  'No usamos tu WhatsApp para publicidad.',
  'Con quién compartimos tus datos.',
  '• Yonkes: solo ven el vehículo, la pieza, el estado y la fecha de la búsqueda activa. Nunca ven tu número de WhatsApp.',
  'Asimismo, cuando el usuario utiliza la función de Búsqueda Activa, la información de la autoparte o refacción solicitada en dicha búsqueda activa es compartida con los yonkes y yonkeros afiliados para atender la disponibilidad de la pieza dentro de la búsqueda activa autorizada por el cliente.',
  '• Proveedores de infraestructura que almacenan y procesan la información por cuenta de Mecanix, sin usarla para fines propios: Google LLC (Firebase / Google Cloud) y Vercel Inc.',
  '• El aviso interno a Mecanix sobre una búsqueda activa nueva se envía por WhatsApp mediante el servicio CallMeBot. Ese aviso no incluye tu número.',
  'Cuando tú contactas a un yonke. Si decides escribirle a un yonke desde tu enlace, la conversación ocurre directamente entre tú y el yonke, fuera de la Plataforma. A partir de ese momento el yonke conoce tu número porque tú se lo diste, y lo trata por su cuenta, como responsable independiente.',
  'Tu enlace privado. Cualquier persona que tenga tu enlace puede ver las respuestas de tu búsqueda activa. Esas respuestas no incluyen tus datos de contacto. Te recomendamos no compartirlo.',
  'Cuánto tiempo los conservamos. Tu búsqueda activa, tu número de WhatsApp y las respuestas de los yonkes se eliminan automáticamente a los 5 días de haber registrado la búsqueda activa.',
  'Tus derechos. Puedes solicitar el acceso, la rectificación o la cancelación de tus datos, u oponerte a su uso, escribiendo a contacto@mecanixyonkevirtual.com o al WhatsApp 661 103 4260. Para ubicar tu búsqueda activa nos puedes compartir tu enlace o tu número de WhatsApp. Si pides la cancelación antes de los 5 días, eliminamos tu búsqueda activa y tus datos.',
];

const textoDe = (Pagina) => render(<Pagina />).container.textContent.replace(/\s+/g, ' ');

afterEach(() => cleanup());

describe('búsqueda activa (aprobado el 26 de octubre de 2026)', () => {
  it('la casilla y su explicación, tal cual el TEXTO 1', () => {
    expect(TEXTO_CASILLA_OTROS_ESTADOS).toBe(CASILLA);
    expect(TEXTO_CONSENTIMIENTO_OTROS_ESTADOS).toBe(CONSENTIMIENTO);
  });
  it('Privacidad, sección 14: completa y en orden, con el TEXTO 2 justo después del inciso (a); Contacto sigue en la 15', () => {
    const texto = textoDe(Privacidad);
    let desde = texto.indexOf('14. Búsquedas activas');
    expect(desde).toBeGreaterThan(-1);
    for (const parrafo of SECCION_14) {
      const en = texto.indexOf(parrafo, desde);
      expect(en, parrafo).toBeGreaterThanOrEqual(desde);
      desde = en + parrafo.length;
    }
    expect(texto.indexOf('15. Contacto')).toBe(desde);
    expect(texto).toContain('13. Talleres, cotizaciones y órdenes de servicio');
  });
  it('Privacidad, sección 14: sin las frases que contradicen el TEXTO 2', () => {
    const texto = textoDe(Privacidad);
    expect(texto).not.toContain('únicamente a los yonkes Verificados');
    expect(texto).not.toContain('hasta que la alerta se elimine');
    expect(texto).not.toContain('Mostrar mi alerta a yonkes de otros estados');
  });
  it('Privacidad, sección 7: remite a la 14 para las búsquedas activas', () => {
    const texto = textoDe(Privacidad);
    const referencia = texto.indexOf('Para las búsquedas activas, consulta también la sección 14.');
    expect(referencia).toBeGreaterThan(texto.indexOf('7. Conservación y eliminación'));
    expect(referencia).toBeLessThan(texto.indexOf('8. Cookies'));
  });
  it('Términos, sección 8: el TEXTO 3 en lugar de "Pedidos de piezas a los yonkes", con los demás puntos', () => {
    const texto = textoDe(Terminos);
    const s8 = texto.indexOf('8. Responsabilidades del cliente');
    const s9 = texto.indexOf('9. Insignias y distintivos');
    const t3 = texto.indexOf(TEXTO_3);
    expect(t3).toBeGreaterThan(s8);
    expect(t3).toBeLessThan(s9);
    for (const punto of [
      '• Mecanix no vende piezas, no fija precios, no garantiza que algún yonke tenga la pieza, ni su estado, precio o disponibilidad, y no participa en el pago ni en la entrega.',
      '• El cliente debe confirmar directamente con el yonke antes de pagar o acudir.',
      '• El cliente se obliga a proporcionar un número de WhatsApp propio y datos veraces.',
      '• Mecanix puede dar de baja búsquedas activas que parezcan falsas, ofensivas o abusivas, y limitar el número de búsquedas activas por persona.',
    ]) {
      expect(texto.indexOf(punto, t3)).toBeGreaterThan(t3);
      expect(texto.indexOf(punto, t3)).toBeLessThan(s9);
    }
    expect(texto).not.toContain('Pedidos de piezas a los yonkes.');
    expect(texto).not.toContain('Mecanix permite que el cliente avise a los yonkes');
  });
  it('Términos, sección 6: respuestas a búsquedas activas (solo cambia el nombre)', () => {
    const texto = textoDe(Terminos);
    const s6 = texto.indexOf('6. Responsabilidades del yonke');
    const s7 = texto.indexOf('7. Datos de terceros');
    for (const frase of ['Respuestas a búsquedas activas de clientes. El yonke que responde una búsqueda activa se obliga a:',
      'Cada yonke puede responder una sola vez a cada búsqueda activa, y su respuesta no se puede modificar.']) {
      expect(texto.indexOf(frase)).toBeGreaterThan(s6);
      expect(texto.indexOf(frase)).toBeLessThan(s7);
    }
    expect(texto).toContain('23. Contacto');
  });
  it('ninguna de las dos páginas dice "alerta" ni "Avisar a los yonkes"', () => {
    for (const Pagina of [Privacidad, Terminos]) {
      const texto = textoDe(Pagina);
      expect(texto).not.toMatch(/alerta/i);
      expect(texto).not.toContain('Avisar a los yonkes');
      cleanup();
    }
  });
  it('ninguna página publica un [POR CONFIRMAR] ni las frases que dependen de él', () => {
    for (const Pagina of [Privacidad, Terminos]) {
      const texto = textoDe(Pagina);
      expect(texto).not.toContain('POR CONFIRMAR');
      expect(texto).not.toContain('El sistema de borrado automático puede tardar');
      cleanup();
    }
  });
  it('fecha de última actualización y VERSION_LEGAL: 26 de octubre de 2026', () => {
    expect(VERSION_LEGAL).toBe('2026-10-26');
    expect(textoDe(Privacidad)).toContain('Última actualización: 26 de octubre de 2026');
    cleanup();
    expect(textoDe(Terminos)).toContain('Última actualización: 26 de octubre de 2026');
  });
});

describe('textos finales del 12 de octubre de 2026', () => {
  it('Términos, sección 4 «Planes del servicio»: los tres párrafos, sin el texto anterior', () => {
    const texto = textoDe(Terminos);
    expect(texto).toContain('4. Planes del servicio');
    for (const p of ['La Plataforma ofrece dos planes. Plan Básico: sin costo; incluye la administración y publicación del inventario del yonke, la sección de pedidos y la configuración de los datos de su negocio. Plan Premium: $398.00 MXN al mes más IVA; incluye las demás funciones de la Plataforma, incluidas las que se incorporen en el futuro.', 'Los yonkes registrados en la Plataforma antes del 12 de octubre de 2026 reciben un año del plan Premium sin costo, del 1 de noviembre de 2026 al 1 de noviembre de 2027. Al terminar ese año, el yonke decide si contrata el plan Premium o continúa en el plan Básico, y Mecanix se lo avisará con al menos 30 días naturales de anticipación. No se cobra ningún monto sin que el yonke lo acepte expresamente.', 'Mecanix puede modificar las funciones de cada plan e introducir nuevos planes o funciones de pago, avisando a los yonkes registrados con al menos 30 días naturales de anticipación.']) expect(texto).toContain(p);
    expect(texto).not.toContain('Servicio sin costo y posibles planes de pago');
    expect(texto).not.toContain('gratuito para los yonkes');
  });
  it('Términos, sección 5: la captura a domicilio en los estados donde se ofrece (el resto igual)', () => {
    const texto = textoDe(Terminos);
    expect(texto).toContain('Servicio opcional, disponible en los estados donde Mecanix lo ofrezca, que se indican en la Plataforma, y solo a solicitud del yonke: personal de Mecanix visita el negocio para ayudar a capturar su inventario. Tiene un costo de $300 MXN por visita.');
    expect(texto).not.toContain('únicamente en Baja California');
    expect(texto).toContain('No es una suscripción ni un cobro periódico');
  });
  it('Términos: la insignia Premium es "plan Premium vigente"', () => {
    const texto = textoDe(Terminos);
    expect(texto).toContain('• Premium: la cuenta tiene el plan Premium vigente.');
    expect(texto).not.toContain('designación asignada por Mecanix');
  });
  it('Términos, sección 21: los yonkes responden con su precio y el taller elige', () => {
    const texto = textoDe(Terminos);
    for (const p of ['Los talleres registrados en la Plataforma pueden solicitar una pieza indicando los datos de un vehículo. La solicitud aparece en el panel de los yonkes registrados en el estado correspondiente, con el nombre del taller, los datos del vehículo, la pieza y la nota del taller. Los yonkes que tienen la pieza responden con su precio, y el taller decide con cuál acuerda la compra, considerando los costos, las garantías y la compatibilidad. Solo al yonke elegido se le muestra el WhatsApp del taller.', 'El yonke solo puede usar los datos de una solicitud para atender esa solicitud, y es el único responsable de la veracidad de su respuesta. La entrega, el pago y cualquier garantía de la pieza se acuerdan directamente entre el taller y el yonke elegido; Mecanix no es parte de ese acuerdo ni garantiza la disponibilidad, el estado o el precio de la pieza.', 'Esta sección aplica a los yonkes. Los talleres se rigen, además, por la sección 22.']) expect(texto).toContain(p);
    expect(texto).not.toContain('El primer yonke que confirme a Mecanix');
  });
  it('Privacidad, sección 12 (primer párrafo) y frase nueva de CallMeBot en la sección 5', () => {
    const texto = textoDe(Privacidad);
    expect(texto).toContain('Cuando un taller registrado solicita una pieza, Mecanix muestra la solicitud en el panel de los yonkes registrados en el estado correspondiente, con el nombre del taller, los datos del vehículo, la pieza y la nota del taller, con la única finalidad de que puedan confirmar si la tienen y atender la solicitud. El WhatsApp del taller solo se muestra al yonke que el taller elige. No se comparten datos personales del cliente final del taller.');
    expect(texto).toContain('datos de contacto del yonke registrado). También enviamos por ese medio avisos internos al administrador cuando un taller solicita una pieza (nombre del taller, pieza, vehículo y estado) o cuando se solicita una entrega inmediata (pieza, vehículo y nombre del yonke).');
    expect(texto).toContain('es responsable, bajo su propia cuenta, de la veracidad de su respuesta al confirmar que tiene la pieza.');
  });
});

// Avisos en el dispositivo (notificaciones push): textos aprobados por el abogado, dentro de la
// versión vigente (26 de octubre de 2026: solo "alertas" pasa a "búsquedas activas").
describe('avisos en el dispositivo', () => {
  const PRIVACIDAD = 'Notificaciones en el dispositivo. Si el yonke activa los avisos, guardamos un identificador técnico (token) del navegador o dispositivo que utiliza, ligado a su cuenta, con el único fin de enviarle avisos de pedidos y búsquedas activas de su interés aunque la aplicación esté cerrada. Estos avisos no contienen datos personales del cliente. Para entregarlos utilizamos el servicio Firebase Cloud Messaging de Google, que recibe el identificador y el texto del aviso. El yonke puede desactivar los avisos en cualquier momento desde la aplicación o desde los permisos de su navegador; al hacerlo, o al eliminar su cuenta, eliminamos el identificador.';
  const PROVEEDOR = '• Firebase Cloud Messaging (Google): entrega de los avisos en el dispositivo a los yonkes que los activan (ver sección 2).';
  const TERMINOS = 'Los avisos de pedidos y búsquedas activas en el dispositivo forman parte de la sección de pedidos del plan Básico. Su entrega depende de la conexión, de los permisos y de la configuración del dispositivo del usuario, por lo que Mecanix no garantiza que cada aviso llegue ni que llegue de inmediato; el yonke puede consultar siempre sus pedidos y búsquedas activas dentro del panel.';
  it('Privacidad, sección 2: el párrafo va justo después de "Yonkes registrados"', () => {
    const texto = textoDe(Privacidad);
    expect(texto).toContain(PRIVACIDAD);
    const yonkes = texto.indexOf('Yonkes registrados:');
    const avisos = texto.indexOf(PRIVACIDAD);
    expect(avisos).toBeGreaterThan(yonkes);
    expect(avisos).toBeLessThan(texto.indexOf('Datos técnicos:'));
    expect(avisos).toBeLessThan(texto.indexOf('3. Datos que los yonkes registran sobre terceros'));
  });
  it('Privacidad, sección 5: Firebase Cloud Messaging (Google) junto a CallMeBot', () => {
    const texto = textoDe(Privacidad);
    expect(texto).toContain(PROVEEDOR);
    const callmebot = texto.indexOf('• CallMeBot:');
    expect(texto.indexOf(PROVEEDOR)).toBeGreaterThan(callmebot);
    expect(texto.indexOf(PROVEEDOR)).toBeLessThan(texto.indexOf('Estos proveedores tratan los datos'));
  });
  it('Términos, sección 4: el párrafo va después del de los dos planes', () => {
    const texto = textoDe(Terminos);
    expect(texto).toContain(TERMINOS);
    expect(texto.indexOf(TERMINOS)).toBeGreaterThan(texto.indexOf('La Plataforma ofrece dos planes.'));
    expect(texto.indexOf(TERMINOS)).toBeLessThan(texto.indexOf('Los yonkes registrados en la Plataforma antes del 12 de octubre de 2026'));
  });
  it('con la versión y la fecha vigentes', () => {
    expect(VERSION_LEGAL).toBe('2026-10-26');
    expect(textoDe(Privacidad)).toContain('Última actualización: 26 de octubre de 2026');
  });
});
