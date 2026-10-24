// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import Privacidad from './privacidad/page.js';
import Terminos from './terminos/page.js';
import { TEXTO_CASILLA_OTROS_ESTADOS } from '../lib/pedidosClientes';
import { VERSION_LEGAL } from '../lib/versionesLegales';

// Texto de "Avisar a los yonkes" aprobado por el abogado tal cual (legal-pedido-clientes-para-abogado.md):
// la sección 2 va al Aviso de Privacidad y la 3 a los Términos. Las frases con [POR CONFIRMAR]
// quedan fuera hasta que el abogado las resuelva; todo lo demás debe aparecer sin cambios.
const md = readFileSync(join(process.cwd(), 'legal-pedido-clientes-para-abogado.md'), 'utf8');

function seccion(numero) {
  const inicio = md.indexOf(`## ${numero}. `);
  const fin = md.indexOf('\n## ', inicio + 1);
  return md.slice(inicio, fin === -1 ? undefined : fin).split('\n').slice(1);
}

// Líneas que deben publicarse: sin encabezados de ubicación ("### Para los ..."), sin notas en
// cursiva, sin separadores, y sin las frases que llevan [POR CONFIRMAR].
function lineasPublicables(lineas) {
  return lineas
    .filter((l) => l.trim() && l.trim() !== '---' && !/^\*[^*]/.test(l.trim()) && !/^### Para los /.test(l))
    .map((l) => l.replace(/^### /, '').replace(/^- /, ''))
    .map((l) => l.split(/(?<=\.)\s+(?=\*\*|[A-ZÁÉÍÓÚÑ])/).filter((frase) => !frase.includes('POR CONFIRMAR')).join(' '))
    .map((l) => l.replace(/\*\*/g, '').trim())
    // Ajuste de forma aprobado: "cliente" en minúscula en el texto publicado (salvo al inicio de un título).
    .map((l) => l.replace(/Cliente/g, (m, i) => (i === 0 ? m : 'cliente')))
    // Cambios aprobados por el abogado después de ese documento (ver CAMBIOS_2026_10_10).
    .map((l) => CAMBIOS_2026_10_10[l] ?? l)
    .filter(Boolean);
}

// Alertas a yonkes de otros estados (aprobado por el abogado el 10 de octubre de 2026): la línea
// de los Términos que decía que el cliente avisa "únicamente" a los yonkes de su estado.
// El inciso (a) cita la primera frase del texto de la casilla del formulario (TEXTO_CASILLA_OTROS_ESTADOS).
const CASILLA = 'Mostrar mi alerta a yonkes de otros estados que hacen envíos';
const PRIVACIDAD_CASILLA_MARCADA = 'La casilla para mostrar tu alerta a yonkes de otros estados aparece marcada por defecto. Si no deseas que tu alerta se muestre a yonkes fuera de tu estado, debes desmarcarla antes de enviarla.';
const TERMINOS_CASILLA_MARCADA = 'Esa casilla aparece marcada por defecto: si el cliente no desea que su alerta se muestre a yonkes fuera de su estado, debe desmarcarla antes de enviarla.';
const TERMINOS_OTROS_ESTADOS = 'Mecanix permite que el cliente avise a los yonkes de su estado que busca una pieza, y que vea sus respuestas. Si el cliente activa la casilla correspondiente, acepta que su alerta de pedido también pueda mostrarse a los yonkes Verificados que tengan activada la opción de Envíos nacionales, en los demás estados, identificados con su insignia.';
const CAMBIOS_2026_10_10 = {
  'Mecanix únicamente permite que el cliente avise a los yonkes de su estado que busca una pieza, y que vea sus respuestas.': TERMINOS_OTROS_ESTADOS,
};
const PRIVACIDAD_A = `(a) Mostrar tu pedido, sin tus datos de contacto, a los yonkes de tu estado para que te respondan. Si marcas la casilla "${CASILLA}", estarás aprobando que tu alerta se muestre también a yonkes de otros estados del país, pero únicamente a los yonkes Verificados que tengan activada la opción de Envíos nacionales (lo verás indicado con su insignia). Solo se muestra la alerta (el vehículo, la pieza, el estado y la fecha); tus datos de contacto siguen protegidos y no se comparten con los yonkes hasta que la alerta se elimine.`;
const PRIVACIDAD_B = 'Asimismo, cuando el usuario utiliza la función de Alerta de Búsqueda, la información de la autoparte o refacción solicitada en dicha alerta es compartida con los yonkes y yonkeros afiliados para atender la disponibilidad del pedido dentro de la alerta autorizada por el cliente.';

const textoDe = (Pagina) => render(<Pagina />).container.textContent.replace(/\s+/g, ' ');

afterEach(() => cleanup());

describe('textos legales de "Avisar a los yonkes"', () => {
  it('el Aviso de Privacidad trae la sección 14 completa, tal cual se aprobó, y Contacto pasa a 15', () => {
    const texto = textoDe(Privacidad);
    const lineas = lineasPublicables(seccion(2));
    expect(lineas.length).toBeGreaterThan(15);
    for (const linea of lineas) expect(texto).toContain(linea);
    expect(texto).toContain('14. Clientes que piden una pieza a los yonkes ("Avisar a los yonkes")');
    expect(texto).toContain('15. Contacto');
    expect(texto).toContain('13. Talleres, cotizaciones y órdenes de servicio');
  });
  it('los Términos traen lo de clientes en la sección 8 y lo de yonkes en la 6, tal cual se aprobó', () => {
    const texto = textoDe(Terminos);
    const lineas = lineasPublicables(seccion(3));
    expect(lineas.length).toBeGreaterThan(10);
    for (const linea of lineas) expect(texto).toContain(linea);
    const s6 = texto.indexOf('6. Responsabilidades del yonke');
    const s7 = texto.indexOf('7. Datos de terceros');
    const s8 = texto.indexOf('8. Responsabilidades del cliente');
    const s9 = texto.indexOf('9. Insignias y distintivos');
    expect(texto.indexOf('Respuestas a pedidos de clientes.')).toBeGreaterThan(s6);
    expect(texto.indexOf('Respuestas a pedidos de clientes.')).toBeLessThan(s7);
    expect(texto.indexOf('Pedidos de piezas a los yonkes.')).toBeGreaterThan(s8);
    expect(texto.indexOf('Pedidos de piezas a los yonkes.')).toBeLessThan(s9);
    expect(texto).toContain('23. Contacto');
  });
  it('el texto nuevo escribe "cliente" en minúscula; el texto de talleres ("Cliente del Taller") no cambia', () => {
    const terminos = textoDe(Terminos);
    for (const frase of [
      'Respuestas a pedidos de clientes.', 'aclarar al cliente cualquier diferencia', 'los datos que el cliente le proporcione',
      'permite que el cliente avise', 'El cliente debe confirmar directamente', 'El cliente se obliga a proporcionar',
    ]) {
      expect(terminos).toContain(frase);
      expect(terminos).not.toContain(frase.replace('clientes', 'Clientes').replace('cliente', 'Cliente'));
    }
    expect(terminos).toContain('Cliente del Taller');
    cleanup();
    expect(textoDe(Privacidad)).toContain('14. Clientes que piden una pieza a los yonkes');
  });
  it('la sección 7 de Privacidad remite a la 14 para los pedidos de "Avisar a los yonkes"', () => {
    const texto = textoDe(Privacidad);
    const s7 = texto.indexOf('7. Conservación y eliminación');
    const s8 = texto.indexOf('8. Cookies');
    const referencia = texto.indexOf('Para los pedidos de "Avisar a los yonkes", consulta también la sección 14.');
    expect(referencia).toBeGreaterThan(s7);
    expect(referencia).toBeLessThan(s8);
  });
  it('ninguna página publica un [POR CONFIRMAR] ni las frases que dependen de él', () => {
    for (const Pagina of [Privacidad, Terminos]) {
      const texto = textoDe(Pagina);
      expect(texto).not.toContain('POR CONFIRMAR');
      expect(texto).not.toContain('El sistema de borrado automático puede tardar');
      cleanup();
    }
  });
  it('fecha de última actualización y VERSION_LEGAL de hoy', () => {
    expect(VERSION_LEGAL).toBe('2026-10-22');
    expect(textoDe(Privacidad)).toContain('Última actualización: 22 de octubre de 2026');
    cleanup();
    expect(textoDe(Terminos)).toContain('Última actualización: 22 de octubre de 2026');
  });
});

describe('alertas a yonkes de otros estados (aprobado el 10 de octubre de 2026)', () => {
  it('Privacidad, sección 14: el inciso (a) nombra la casilla con su texto exacto del formulario', () => {
    const texto = textoDe(Privacidad);
    expect(texto).toContain(PRIVACIDAD_A);
    const a = texto.indexOf(PRIVACIDAD_A);
    expect(a).toBeGreaterThan(texto.indexOf('Para qué los usamos.'));
    expect(a).toBeLessThan(texto.indexOf('(b) Mostrarte, en tu enlace privado'));
  });
  it('la cita del inciso (a) es la primera frase del texto real de la casilla', () => {
    expect(TEXTO_CASILLA_OTROS_ESTADOS.startsWith(`${CASILLA}. `)).toBe(true);
  });
  it('Privacidad, sección 14: la casilla marcada por defecto, justo después del inciso (a)', () => {
    const texto = textoDe(Privacidad);
    expect(texto.indexOf(PRIVACIDAD_CASILLA_MARCADA)).toBe(texto.indexOf(PRIVACIDAD_A) + PRIVACIDAD_A.length);
    expect(texto.indexOf(PRIVACIDAD_CASILLA_MARCADA)).toBeLessThan(texto.indexOf('(b) Mostrarte, en tu enlace privado'));
  });
  it('Términos, sección 8: la casilla marcada por defecto, junto a la línea de otros estados', () => {
    const texto = textoDe(Terminos);
    expect(texto).toContain(`${TERMINOS_OTROS_ESTADOS} ${TERMINOS_CASILLA_MARCADA}`);
  });
  it('Privacidad, sección 14: la frase B va justo después del renglón de "Yonkes"', () => {
    const texto = textoDe(Privacidad);
    const yonkes = 'Yonkes: solo ven el vehículo, la pieza, el estado y la fecha del pedido. Nunca ven tu número de WhatsApp.';
    const y = texto.indexOf(yonkes);
    expect(y).toBeGreaterThan(-1);
    // Párrafo propio, inmediatamente después del renglón de Yonkes y antes de "Proveedores".
    expect(texto.indexOf(PRIVACIDAD_B)).toBe(y + yonkes.length);
    expect(texto.indexOf('• Proveedores de infraestructura')).toBe(y + yonkes.length + PRIVACIDAD_B.length);
  });
  it('Términos, sección 8: la línea nueva reemplaza a la de "únicamente ... de su estado"', () => {
    const texto = textoDe(Terminos);
    expect(texto).toContain(TERMINOS_OTROS_ESTADOS);
    expect(texto).not.toContain('Mecanix únicamente permite que el cliente avise');
  });
  it('la sección 13 de talleres trae su título y versión vigentes', () => {
    expect(textoDe(Privacidad)).toContain('13. Talleres, cotizaciones y órdenes de servicio');
    expect(textoDe(Privacidad)).toContain('Versión: talleres-2026-10-5 · 22 de octubre de 2026');
  });
});

// Textos finales aprobados por el abogado el 11 de octubre de 2026 (planes, captura a domicilio,
// insignia Premium, solicitudes de piezas y avisos internos por CallMeBot).
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
// versión vigente (VERSION_LEGAL y la fecha no cambian).
describe('avisos en el dispositivo', () => {
  const PRIVACIDAD = 'Notificaciones en el dispositivo. Si el yonke activa los avisos, guardamos un identificador técnico (token) del navegador o dispositivo que utiliza, ligado a su cuenta, con el único fin de enviarle avisos de pedidos y alertas de búsqueda de su interés aunque la aplicación esté cerrada. Estos avisos no contienen datos personales del cliente. Para entregarlos utilizamos el servicio Firebase Cloud Messaging de Google, que recibe el identificador y el texto del aviso. El yonke puede desactivar los avisos en cualquier momento desde la aplicación o desde los permisos de su navegador; al hacerlo, o al eliminar su cuenta, eliminamos el identificador.';
  const PROVEEDOR = '• Firebase Cloud Messaging (Google): entrega de los avisos en el dispositivo a los yonkes que los activan (ver sección 2).';
  const TERMINOS = 'Los avisos de pedidos y alertas en el dispositivo forman parte de la sección de pedidos del plan Básico. Su entrega depende de la conexión, de los permisos y de la configuración del dispositivo del usuario, por lo que Mecanix no garantiza que cada aviso llegue ni que llegue de inmediato; el yonke puede consultar siempre sus pedidos y alertas dentro del panel.';
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
  it('sin cambiar la versión ni la fecha', () => {
    expect(VERSION_LEGAL).toBe('2026-10-22');
    expect(textoDe(Privacidad)).toContain('Última actualización: 22 de octubre de 2026');
  });
});
