// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

// /bienvenida: interruptor config/portada.bienvenida (404 apagado), noindex, y la pantalla con el
// selector yonke/taller/cliente, los planes de la portada con sus mismos interruptores y los
// eventos de Analytics. Firestore simulado.
let docs = {};
let falla = false;
let estados = [];
vi.mock('../lib/firebase-server', () => ({ dbServer: {} }));
vi.mock('firebase/firestore', () => ({
  doc: (...a) => a.slice(1).join('/'),
  getDoc: vi.fn(async (ruta) => {
    if (falla) throw new Error('sin red');
    return docs[ruta] ? { exists: () => true, data: () => docs[ruta] } : { exists: () => false, data: () => ({}) };
  }),
}));
vi.mock('../lib/busqueda/estadosServer', () => ({ obtenerEstadosCombinado: async () => estados }));
let buscador = false;
vi.mock('../lib/refaccionariaPublica', () => ({ buscadorRefaccionesEncendido: async () => buscador }));
let talleres = true;
vi.mock('../../lib/talleresHabilitados', () => ({ talleresHabilitados: () => talleres }));
vi.mock('next/navigation', () => ({ notFound: () => { throw new Error('NOT_FOUND'); } }));

const { default: Bienvenida, metadata } = await import('./page.js');
const { REGISTRO_TALLER, REGISTRO_YONKE, listaConY } = await import('./BienvenidaClient');
const {
  AVISO_PAGO_APROBADO, AVISO_PROVISIONAL, CITA_DATOS_CLIENTES_TALLER, HERO, PRIMEROS_PASOS, pasosVisibles, preguntasVisibles,
} = await import('../../lib/textosBienvenida');
const {
  FUNCIONES_PLAN_BASICO, FUNCIONES_TALLER_BASICO, FUNCIONES_TALLER_PREMIUM, PRECIO_PREMIUM_TEXTO, URL_QUIERO_PREMIUM,
} = await import('../../lib/planes');
const { TEXTO_AVISO_PAGO } = await import('../mi-pedido/[id]/MiPedidoCliente');
const textosTalleres = (await import('../../lib/textosLegalesTalleres.json')).default;

const gtag = vi.fn();
beforeEach(() => {
  docs = { 'config/portada': { bienvenida: true } };
  falla = false;
  estados = [{ id: 'baja-california', nombre: 'Baja California', tieneVisitas: true }, { id: 'sonora', nombre: 'Sonora' }];
  buscador = false;
  talleres = true;
  gtag.mockClear();
  window.gtag = gtag;
});
afterEach(() => { cleanup(); delete window.gtag; });

const pintar = async () => render(await Bienvenida());
const selector = () => screen.getByRole('group', { name: '¿Quién eres?' });
// El hero es lo primero; la llamada final repite los mismos botones al final.
const hero = (nombre) => screen.getAllByRole('link', { name: nombre })[0];
const final = () => screen.getByRole('region', { name: /Empieza a recibir búsquedas hoy|¿Buscas una pieza\?/ });
const preguntas = () => within(screen.getByRole('region', { name: 'Preguntas frecuentes' })).queryAllByRole('group').map((d) => d.querySelector('summary').textContent);
const respuesta = (pregunta) => within(screen.getByRole('region', { name: 'Preguntas frecuentes' })).getByText(pregunta).closest('details').textContent.slice(pregunta.length);
const eventos = (nombre) => gtag.mock.calls.filter(([, n]) => n === nombre).map(([, , p]) => p);

describe('interruptor y SEO', () => {
  it('apagada, con otro valor, sin documento o si falla la lectura: 404', async () => {
    for (const config of [{ bienvenida: false }, { bienvenida: 'true' }, null]) {
      docs = config ? { 'config/portada': config } : {};
      await expect(Bienvenida()).rejects.toThrow('NOT_FOUND');
    }
    falla = true;
    await expect(Bienvenida()).rejects.toThrow('NOT_FOUND');
  });
  it('noindex, canonical propio y vista previa propia con la imagen de la portada', () => {
    expect(metadata.robots).toEqual({ index: false, follow: false, googleBot: { index: false, follow: false } });
    expect(metadata.alternates.canonical).toBe('/bienvenida');
    expect(metadata.openGraph.url).toBe('https://www.mecanixyonkevirtual.com/bienvenida');
    expect(metadata.openGraph.images[0].alt).toBe('Mecanix: motor de búsqueda de autopartes');
  });
});

describe('pantalla', () => {
  it('encabezado, hero con los dos registros y aviso de textos provisionales', async () => {
    await pintar();
    expect(screen.getByText(AVISO_PROVISIONAL)).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: HERO.titulo })).toBeInTheDocument();
    expect(screen.getByText('Para yonkes, talleres y clientes')).toBeInTheDocument();
    const whatsapp = screen.getByRole('link', { name: 'WhatsApp 661 103 4260' });
    expect(whatsapp).toHaveAttribute('href', `https://wa.me/526611034260?text=${encodeURIComponent('Hola, quiero información de Mecanix')}`);
    fireEvent.click(whatsapp);
    expect(eventos('contacto_mecanix')).toEqual([{ medio: 'whatsapp', ubicacion: 'bienvenida_encabezado' }]);

    fireEvent.click(hero('🏪 Registrar mi yonke'));
    fireEvent.click(hero('🔧 Registrar mi taller'));
    expect(hero('🏪 Registrar mi yonke')).toHaveAttribute('href', REGISTRO_YONKE);
    expect(hero('🔧 Registrar mi taller')).toHaveAttribute('href', REGISTRO_TALLER);
    expect(eventos('clic_registro')).toEqual([{ tipo: 'yonke', ubicacion: 'bienvenida_hero' }, { tipo: 'taller', ubicacion: 'bienvenida_hero' }]);
    expect(REGISTRO_YONKE).toBe('/panel/registro?desde=bienvenida');
    expect(REGISTRO_TALLER).toBe('/panel/taller/registro?desde=bienvenida');

    expect(screen.getByRole('link', { name: 'Términos y Condiciones' })).toHaveAttribute('href', '/terminos');
    expect(screen.getByRole('link', { name: 'Aviso de Privacidad' })).toHaveAttribute('href', '/privacidad');
    expect(screen.getByText('Con tecnología Mecanix')).toBeInTheDocument();
    // Sin espacios vacíos de la etapa 1: preguntas y llamada final siempre están.
    expect(screen.getByRole('region', { name: 'Preguntas frecuentes' })).toBeInTheDocument();
    expect(final()).toBeInTheDocument();
  });

  it('sin talleres (variable): ni botón ni "Soy taller"', async () => {
    talleres = false;
    docs['config/planes'] = { tarjetasTalleres: true };
    await pintar();
    expect(screen.queryByRole('link', { name: /Registrar mi taller/ })).not.toBeInTheDocument();
    expect(within(selector()).queryByRole('button', { name: /Soy taller/ })).not.toBeInTheDocument();
    expect(within(selector()).getAllByRole('button')).toHaveLength(2);
  });

  it('yonke: pasos y planes con los interruptores de la portada; captura donde hay visitas', async () => {
    docs['config/planes'] = { limitesActivos: true };
    docs['config/pedidosClientes'] = { habilitado: true, inventarioVehiculos: true };
    await pintar();
    expect(within(selector()).getByRole('button', { name: /Soy yonke/ })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('heading', { name: 'Tus primeros pasos' })).toBeInTheDocument();
    expect(screen.getByText('Activa los avisos (solo Android)')).toBeInTheDocument();
    expect(screen.getByText(/queda disponible 30 días sin capturarlo\.$/)).toBeInTheDocument();
    expect(screen.getByText('Plan Básico')).toBeInTheDocument();
    for (const f of FUNCIONES_PLAN_BASICO) expect(screen.getAllByText(f).length).toBeGreaterThan(0);
    expect(screen.getByText(PRECIO_PREMIUM_TEXTO)).toBeInTheDocument();
    expect(screen.getByText('Disponible en Baja California.')).toBeInTheDocument();
    expect(screen.getByText('Crea la cuenta de tu yonke. Actualmente sin costo.')).toBeInTheDocument();

    const premium = screen.getByRole('link', { name: 'Quiero Premium' });
    expect(premium).toHaveAttribute('href', URL_QUIERO_PREMIUM);
    fireEvent.click(premium);
    fireEvent.click(screen.getByRole('link', { name: 'Registrar mi yonke' }));
    fireEvent.click(screen.getByRole('link', { name: 'Quiero agendar una visita' }));
    expect(screen.getByRole('link', { name: 'Registrar mi yonke' })).toHaveAttribute('href', REGISTRO_YONKE);
    expect(eventos('clic_premium')).toEqual([{ ubicacion: 'bienvenida', plan_actual: 'visitante' }]);
    expect(eventos('clic_registro')).toEqual([{ tipo: 'yonke', ubicacion: 'bienvenida_planes' }]);
    expect(eventos('clic_servicio_visitas')).toEqual([{ ubicacion: 'bienvenida', plan_actual: 'visitante' }]);
  });

  it('yonke sin límites, sin búsquedas activas y sin estados con visitas: lo de antes, sin Premium ni captura', async () => {
    estados = [{ id: 'sonora', nombre: 'Sonora' }];
    await pintar();
    expect(screen.getByText('Plan Gratuito')).toBeInTheDocument();
    expect(screen.queryByText(PRECIO_PREMIUM_TEXTO)).not.toBeInTheDocument();
    expect(screen.queryByText('Captura a domicilio')).not.toBeInTheDocument();
    expect(screen.queryByText('Contesta con "La tengo"')).not.toBeInTheDocument();
  });

  it('taller: sus pasos y sus planes solo con tarjetasTalleres', async () => {
    docs['config/planes'] = { tarjetasTalleres: true };
    await pintar();
    fireEvent.click(within(selector()).getByRole('button', { name: /Soy taller/ }));
    expect(eventos('bienvenida_selector')).toEqual([{ tipo: 'taller', origen: 'selector' }]);
    expect(screen.getByText('Haz cotizaciones con PDF')).toBeInTheDocument();
    expect(screen.getByText('Planes para tu taller')).toBeInTheDocument();
    // Cada función sale en la tarjeta y en la respuesta "¿Cuánto cuesta?".
    for (const f of FUNCIONES_TALLER_BASICO) expect(screen.getAllByText(f)).toHaveLength(2);
    expect(screen.getByText('Crea la cuenta de tu taller. Actualmente sin costo.')).toBeInTheDocument();
    expect(screen.queryByText('Planes para tu yonke')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('link', { name: 'Registrar mi taller' }));
    expect(screen.getByRole('link', { name: 'Registrar mi taller' })).toHaveAttribute('href', REGISTRO_TALLER);
    expect(eventos('clic_registro')).toEqual([{ tipo: 'taller', ubicacion: 'bienvenida_planes' }]);
    cleanup();

    docs['config/planes'] = {};
    await pintar();
    fireEvent.click(within(selector()).getByRole('button', { name: /Soy taller/ }));
    expect(screen.queryByText('Planes para tu taller')).not.toBeInTheDocument();
  });

  it('cliente: el enlace del hero la elige, cambia el título, sin planes y con la tarjeta azul', async () => {
    docs['config/pedidosClientes'] = { habilitado: true, otrosEstados: true };
    await pintar();
    const enlace = screen.getByRole('link', { name: HERO.enlaceCliente });
    expect(enlace).toHaveAttribute('href', '#primeros-pasos');
    fireEvent.click(enlace);
    expect(eventos('bienvenida_selector')).toEqual([{ tipo: 'cliente', origen: 'hero' }]);
    expect(within(selector()).getByRole('button', { name: /Soy cliente/ })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('heading', { name: 'Cómo buscar tu pieza' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Tus primeros pasos' })).not.toBeInTheDocument();
    expect(screen.getByText(/durante 5 días\. Si dejas marcada la casilla "Quiero buscar también en otros estados"/)).toBeInTheDocument();
    expect(screen.getByText('Revisa las respuestas en tu enlace')).toBeInTheDocument();
    expect(screen.getByText('Buscar no tiene costo para ti')).toBeInTheDocument();
    expect(screen.getByText('No necesitas crear una cuenta para consultar con los yonkes.')).toBeInTheDocument();
    // En la tarjeta azul y en la llamada final.
    for (const l of screen.getAllByRole('link', { name: /Buscar una pieza/ })) expect(l).toHaveAttribute('href', '/');
    expect(screen.queryByText('Plan Básico')).not.toBeInTheDocument();
    expect(screen.queryByText('Planes para tu yonke')).not.toBeInTheDocument();
  });

  it('"Mecanix no manda mensajes automáticos" solo con formularioAbierto', async () => {
    docs['config/pedidosClientes'] = { habilitado: true };
    await pintar();
    fireEvent.click(within(selector()).getByRole('button', { name: /Soy cliente/ }));
    expect(screen.getByText('Antes de pagar, confirma la pieza directamente con el yonke.')).toBeInTheDocument();
    expect(screen.queryByText(/mensajes automáticos/)).not.toBeInTheDocument();
    cleanup();
    docs['config/pedidosClientes'] = { habilitado: true, formularioAbierto: true };
    await pintar();
    fireEvent.click(within(selector()).getByRole('button', { name: /Soy cliente/ }));
    expect(screen.getByText('Mecanix no manda mensajes automáticos. Antes de pagar, confirma la pieza directamente con el yonke.')).toBeInTheDocument();
    cleanup();
    // formularioAbierto sin habilitado no cuenta (como en la portada).
    docs['config/pedidosClientes'] = { formularioAbierto: true };
    await pintar();
    fireEvent.click(within(selector()).getByRole('button', { name: /Soy cliente/ }));
    expect(screen.queryByText(/mensajes automáticos/)).not.toBeInTheDocument();
  });

  it('ningún "gratis" en la página, con cualquier pestaña y todo encendido (salvo la promoción de talleres)', async () => {
    docs['config/planes'] = { limitesActivos: true, tarjetasTalleres: true };
    docs['config/pedidosClientes'] = { habilitado: true, otrosEstados: true, inventarioVehiculos: true, formularioAbierto: true };
    docs['config/notificaciones'] = { habilitado: true };
    docs['config/ordenes'] = { seguimientoHabilitado: true };
    docs['config/talleres'] = { premiumGratisHabilitado: true, mesesPremiumGratis: 3 };
    await pintar();
    for (const o of [/Soy yonke/, /Soy taller/, /Soy cliente/]) {
      fireEvent.click(within(selector()).getByRole('button', { name: o }));
      // La única excepción, pedida a propósito: "N meses de Premium gratis al registrarte".
      expect(document.body.textContent.replaceAll('3 meses de Premium gratis al registrarte', '')).not.toMatch(/gratis/i);
    }
  });

  it('promoción de talleres (config/talleres): solo en la pestaña de talleres, en los pasos y en la tarjeta Premium', async () => {
    docs['config/planes'] = { tarjetasTalleres: true };
    docs['config/talleres'] = { premiumGratisHabilitado: true, mesesPremiumGratis: 3 };
    await pintar();
    expect(screen.queryByText(/Premium gratis/)).not.toBeInTheDocument();
    fireEvent.click(within(selector()).getByRole('button', { name: /Soy taller/ }));
    expect(screen.getAllByText(/3 meses de Premium gratis al registrarte/)).toHaveLength(2);
    fireEvent.click(within(selector()).getByRole('button', { name: /Soy cliente/ }));
    expect(screen.queryByText(/Premium gratis/)).not.toBeInTheDocument();
  });

  it('promoción apagada, meses inválidos o error al leer: no se anuncia', async () => {
    docs['config/planes'] = { tarjetasTalleres: true };
    for (const config of [undefined, { premiumGratisHabilitado: false }, { premiumGratisHabilitado: 'true' }, { premiumGratisHabilitado: true, mesesPremiumGratis: 99 }]) {
      if (config) docs['config/talleres'] = config; else delete docs['config/talleres'];
      await pintar();
      fireEvent.click(within(selector()).getByRole('button', { name: /Soy taller/ }));
      expect(screen.queryByText(/Premium gratis/)).not.toBeInTheDocument();
      cleanup();
    }
  });

  it('sin talleres habilitados no se anuncia aunque la promoción esté encendida', async () => {
    talleres = false;
    docs['config/talleres'] = { premiumGratisHabilitado: true };
    await pintar();
    expect(screen.queryByText(/Premium gratis/)).not.toBeInTheDocument();
  });

  it('cliente sin búsquedas activas: sin los pasos de consulta ni la frase de la cuenta', async () => {
    await pintar();
    fireEvent.click(within(selector()).getByRole('button', { name: /Soy cliente/ }));
    expect(screen.queryByText('Si no aparece, consulta con los yonkes')).not.toBeInTheDocument();
    expect(screen.queryByText('Revisa las respuestas en tu enlace')).not.toBeInTheDocument();
    expect(screen.queryByText('No necesitas crear una cuenta para consultar con los yonkes.')).not.toBeInTheDocument();
    expect(screen.getByText('Escríbele tú al yonke que prefieras')).toBeInTheDocument();
  });

  it('Próximamente: sin botones; "Refacciones nuevas" se oculta con el buscador de piezas nuevas', async () => {
    await pintar();
    const seccion = screen.getByRole('region', { name: 'Próximamente en Mecanix' });
    for (const t of ['Refacciones nuevas', 'Especialistas', 'Servicios futuros']) expect(within(seccion).getByText(t)).toBeInTheDocument();
    expect(within(seccion).queryByRole('link')).not.toBeInTheDocument();
    expect(within(seccion).queryByRole('button')).not.toBeInTheDocument();
    cleanup();
    buscador = true;
    await pintar();
    expect(within(screen.getByRole('region', { name: 'Próximamente en Mecanix' })).queryByText('Refacciones nuevas')).not.toBeInTheDocument();
  });
});

describe('preguntas frecuentes y llamada final', () => {
  const todo = () => {
    docs['config/planes'] = { limitesActivos: true, tarjetasTalleres: true };
    docs['config/pedidosClientes'] = { habilitado: true, otrosEstados: true, inventarioVehiculos: true, formularioAbierto: true };
    docs['config/notificaciones'] = { habilitado: true };
    docs['config/ordenes'] = { seguimientoHabilitado: true };
  };
  const elegir = (o) => fireEvent.click(within(selector()).getByRole('button', { name: o }));

  it('yonke con todo encendido: sus 6 preguntas (sin comisión) y respuestas completas', async () => {
    todo();
    await pintar();
    expect(preguntas()).toEqual([
      '¿Cuánto cuesta?', '¿Tengo que subir todo mi inventario?', '¿Quién cierra la venta?', '¿Qué es la insignia Verificado?',
      '¿Funciona en iPhone?', '¿Los yonkes de otros estados también pueden responder?',
    ]);
    expect(respuesta('¿Cuánto cuesta?')).toBe(`Actualmente el plan Básico no tiene costo. El plan Premium cuesta ${PRECIO_PREMIUM_TEXTO} y es opcional.`);
    expect(respuesta('¿Tengo que subir todo mi inventario?')).toMatch(/30 días en tu inventario\.$/);
    expect(respuesta('¿Funciona en iPhone?')).toMatch(/solo para Android\.$/);
    expect(document.body.textContent).not.toMatch(/comisi/i);
  });

  it('yonke con todo apagado: sin las preguntas ni las frases de funciones apagadas', async () => {
    await pintar();
    expect(preguntas()).toEqual(['¿Cuánto cuesta?', '¿Qué es la insignia Verificado?', '¿Funciona en iPhone?']);
    expect(respuesta('¿Cuánto cuesta?')).toBe('Actualmente el plan Básico no tiene costo.');
    expect(respuesta('¿Funciona en iPhone?')).toBe('Se usa desde el navegador de cualquier celular y se puede agregar a la pantalla de inicio.');
  });

  it('taller: planes desde lib/planes.js, cita de los Términos y liga de seguimiento solo encendida', async () => {
    todo();
    await pintar();
    elegir(/Soy taller/);
    expect(preguntas()).toEqual(['¿Cuánto cuesta?', '¿Mis clientes aparecen en Mecanix?', '¿Cómo pido una pieza a los yonkes?', '¿Qué es la liga de seguimiento?']);
    const costo = respuesta('¿Cuánto cuesta?');
    expect(costo).toContain(`Plan Premium, ${PRECIO_PREMIUM_TEXTO}:`);
    for (const f of [...FUNCIONES_TALLER_BASICO, ...FUNCIONES_TALLER_PREMIUM]) expect(costo).toContain(f);
    cleanup();
    docs = { 'config/portada': { bienvenida: true } };
    await pintar();
    elegir(/Soy taller/);
    expect(preguntas()).not.toContain('¿Qué es la liga de seguimiento?');
    expect(respuesta('¿Cuánto cuesta?')).not.toContain('Premium');
  });

  it('cliente: costo según búsquedas activas, mensajes solo con formularioAbierto y la advertencia aprobada', async () => {
    todo();
    await pintar();
    elegir(/Soy cliente/);
    expect(preguntas()).toEqual(['¿Buscar tiene costo?', '¿Cuánto dura mi búsqueda activa?', '¿Me van a mandar mensajes?', '¿Puedo pagar directo en Mecanix?']);
    expect(respuesta('¿Buscar tiene costo?')).toBe('No. Buscar y consultar con los yonkes no tiene costo para ti y no necesitas crear una cuenta.');
    expect(respuesta('¿Cuánto dura mi búsqueda activa?')).toBe('5 días.');
    expect(respuesta('¿Puedo pagar directo en Mecanix?')).toBe(`No. ${AVISO_PAGO_APROBADO}`);
    cleanup();
    docs['config/pedidosClientes'] = { habilitado: true };
    await pintar();
    elegir(/Soy cliente/);
    expect(preguntas()).not.toContain('¿Me van a mandar mensajes?');
    cleanup();
    docs['config/pedidosClientes'] = {};
    await pintar();
    elegir(/Soy cliente/);
    expect(preguntas()).toEqual(['¿Buscar tiene costo?', '¿Puedo pagar directo en Mecanix?']);
    expect(respuesta('¿Buscar tiene costo?')).toBe('No. Buscar no tiene costo para ti.');
  });

  it('textos citados: la advertencia de pago y la cláusula de talleres siguen siendo las aprobadas', () => {
    expect(TEXTO_AVISO_PAGO).toBe(`🛡️ ${AVISO_PAGO_APROBADO}`);
    const clausula = textosTalleres.terminos.map((t) => t.texto).find((t) => t?.startsWith(CITA_DATOS_CLIENTES_TALLER[0]));
    for (const frase of CITA_DATOS_CLIENTES_TALLER) expect(clausula).toContain(frase);
  });

  it('llamada final por pestaña, con WhatsApp y eventos en bienvenida_final', async () => {
    await pintar();
    let f = final();
    expect(within(f).getByRole('heading', { name: 'Empieza a recibir búsquedas hoy' })).toBeInTheDocument();
    fireEvent.click(within(f).getByRole('link', { name: /Registrar mi yonke/ }));
    expect(within(f).getByRole('link', { name: /Registrar mi yonke/ })).toHaveAttribute('href', REGISTRO_YONKE);
    const whatsapp = within(f).getByRole('link', { name: 'Escríbenos por WhatsApp' });
    expect(whatsapp).toHaveAttribute('href', `https://wa.me/526611034260?text=${encodeURIComponent('Hola, quiero información de Mecanix')}`);
    fireEvent.click(whatsapp);

    elegir(/Soy taller/);
    f = final();
    fireEvent.click(within(f).getByRole('link', { name: /Registrar mi taller/ }));
    expect(within(f).getByRole('link', { name: /Registrar mi taller/ })).toHaveAttribute('href', REGISTRO_TALLER);

    elegir(/Soy cliente/);
    f = final();
    expect(within(f).getByRole('heading', { name: '¿Buscas una pieza?' })).toBeInTheDocument();
    expect(within(f).getByRole('link', { name: /Buscar una pieza/ })).toHaveAttribute('href', '/');
    expect(within(f).queryByRole('link', { name: /Registrar/ })).not.toBeInTheDocument();

    expect(eventos('clic_registro')).toEqual([{ tipo: 'yonke', ubicacion: 'bienvenida_final' }, { tipo: 'taller', ubicacion: 'bienvenida_final' }]);
    expect(eventos('contacto_mecanix')).toEqual([{ medio: 'whatsapp', ubicacion: 'bienvenida_final' }]);
  });

  it('preguntasVisibles: "sino" con la función apagada y listas en su propio bloque', () => {
    const lista = [{ pregunta: 'P', respuesta: [{ texto: 'A', si: 'x', sino: 'B' }, { texto: 'C' }, { texto: 'D', lista: ['1'] }, { texto: 'E' }] }];
    expect(preguntasVisibles(lista, {})[0].bloques).toEqual([{ texto: 'B C D', lista: ['1'] }, { texto: 'E' }]);
    expect(preguntasVisibles(lista, { x: true })[0].bloques[0].texto).toBe('A C D');
  });
});

describe('textos', () => {
  it('pasosVisibles: quita los pasos y frases de funciones apagadas', () => {
    const todos = pasosVisibles(PRIMEROS_PASOS.cliente, { consultas: true, otrosEstados: true });
    expect(todos).toHaveLength(4);
    expect(pasosVisibles(PRIMEROS_PASOS.cliente, { consultas: true })[1].desc).not.toMatch(/otros estados/);
    expect(pasosVisibles(PRIMEROS_PASOS.cliente, {})).toHaveLength(2);
  });
  it('reglas de redacción: sin "nuestros yonkes", "nuestra red" ni "gratis"', async () => {
    const textos = JSON.stringify(await import('../../lib/textosBienvenida'));
    expect(textos).not.toMatch(/nuestros yonkes|nuestra red|gratis/i);
  });
  it('listaConY', () => {
    expect(listaConY(['Baja California'])).toBe('Baja California');
    expect(listaConY(['Baja California', 'Sonora'])).toBe('Baja California y Sonora');
    expect(listaConY(['A', 'B', 'C'])).toBe('A, B y C');
  });
});
