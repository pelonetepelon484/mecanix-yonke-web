// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

// Textos de "consulta" en lugar de "alerta" detrás de config/pedidosClientes.formularioAbierto. Con
// la bandera apagada (o sin el campo) todo dice lo de siempre. Firestore simulado; el módulo real de
// banderas (una sola lectura del documento), recargado en cada prueba porque guarda la lectura.
let config = {};
vi.mock('firebase/firestore', () => ({
  doc: (...a) => a.slice(1).join('/'),
  getDoc: vi.fn(async () => ({ exists: () => true, data: () => config })),
}));
vi.mock('./lib/firebase', () => ({ db: 'db' }));
vi.mock('./lib/estados', () => ({ ESTADO_DEFAULT: 'baja-california', cargarEstados: vi.fn(async () => [{ id: 'baja-california', nombre: 'Baja California' }, { id: 'sonora', nombre: 'Sonora' }]) }));
vi.mock('./lib/SelectorMarcaModelo', () => ({ default: () => null }));

const ENCENDIDA = { habilitado: true, alertaUnPaso: true, formularioAbierto: true };
const APAGADA = { habilitado: true, alertaUnPaso: true };
const ENLACE = 'https://mecanixyonkevirtual.com/mi-pedido/Pedido00000000000001?c=abc';
const completo = { marca: 'Nissan', modelo: 'Sentra', anio: '2005', pieza: 'Alternador', estado: 'sonora', estados: [{ id: 'sonora', nombre: 'Sonora' }] };

async function cargar(conf) {
  config = conf;
  vi.resetModules();
  return {
    AlertaUnPaso: await import('./AlertaUnPaso.js'),
    AvisarYonkes: await import('./AvisarYonkes.js'),
    ComoFunciona: (await import('./ComoFuncionaBuscador.js')).default,
    AvisarSinAnioExacto: (await import('./AvisarSinAnioExacto.js')).default,
    pedidos: await import('../lib/pedidosClientes'),
  };
}
const listo = () => act(async () => {});

afterEach(() => { cleanup(); delete global.fetch; });

describe('bandera encendida: "consulta"', () => {
  it('AlertaUnPaso con resultados: compacta y discreta', async () => {
    const { AlertaUnPaso: m } = await cargar(ENCENDIDA);
    render(<m.default variante="compacta" {...completo} />);
    await listo();
    expect(screen.getByRole('button', { name: '🔔 ¿No era lo que buscabas? Consulta con los yonkes aquí' })).toBeInTheDocument();
    cleanup();
    render(<m.default variante="discreta" {...completo} />);
    await listo();
    expect(screen.getByRole('button', { name: '🔔 ¿No encontraste la pieza exacta? Consulta con los yonkes' })).toBeInTheDocument();
  });

  it('AlertaUnPaso sin resultados: texto, botón y título "📲 Consultar con los yonkes", envío y confirmación', async () => {
    const { AlertaUnPaso: m, AvisarYonkes: a } = await cargar(ENCENDIDA);
    const { container } = render(<m.default variante="protagonista" {...completo} />);
    await listo();
    expect(screen.getByText('Consulta con los yonkes de Sonora: verán tu búsqueda activa y te responderán con su precio.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '📲 Consultar con los yonkes' }));
    expect(screen.getByText('📲 Consultar con los yonkes', { selector: 'p' })).toBeInTheDocument();
    global.fetch = vi.fn(async () => ({ ok: true, json: async () => ({ ok: true, enlace: ENLACE }) }));
    fireEvent.change(screen.getByLabelText('Tu WhatsApp'), { target: { value: '6641234567' } });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: '📲 Consultar con los yonkes' })); });
    expect(screen.getByText(a.TEXTO_CONFIRMACION)).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/alerta/i);
  });

  it('errores con "consultas" (el servidor manda los de siempre y el navegador los cambia)', async () => {
    const { AlertaUnPaso: m, pedidos } = await cargar(ENCENDIDA);
    expect(pedidos.MENSAJES_CONSULTA).toEqual({
      limiteWhatsapp: `Ya tienes ${pedidos.MAX_PEDIDOS_POR_WHATSAPP_DIA} búsquedas activas hoy con este WhatsApp. Intenta mañana.`,
      limiteIp: 'Llevas muchas búsquedas activas seguidas. Espera un rato y vuelve a intentar.',
      guardarFallo: 'No pudimos enviar tu búsqueda activa. Revisa tu conexión e intenta de nuevo.',
    });
    render(<m.default variante="protagonista" {...completo} abiertoDeEntrada />);
    await listo();
    global.fetch = vi.fn(async () => ({ ok: false, json: async () => ({ ok: false, mensaje: pedidos.MENSAJES_PEDIDO.limiteWhatsapp }) }));
    fireEvent.change(screen.getByLabelText('Tu WhatsApp'), { target: { value: '6641234567' } });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: '📲 Consultar con los yonkes' })); });
    expect(screen.getByRole('alert')).toHaveTextContent(pedidos.MENSAJES_CONSULTA.limiteWhatsapp);
  });

  it('AvisarYonkes: texto por defecto, botón, título, envío y confirmación', async () => {
    const { AvisarYonkes: a } = await cargar(ENCENDIDA);
    const { container } = render(<a.default marcaInicial="Nissan" modeloInicial="Sentra" anioInicial="2005" piezaInicial="Alternador" estadoInicial="sonora" />);
    await listo();
    expect(screen.getByText('¿No la encontraste? Consulta con los yonkes de tu estado y revisa sus respuestas en tu link.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '📲 Consultar con los yonkes' }));
    await listo();
    expect(screen.getByText('📲 Consultar con los yonkes', { selector: 'p' })).toBeInTheDocument();
    global.fetch = vi.fn(async () => ({ ok: true, json: async () => ({ ok: true, enlace: ENLACE }) }));
    fireEvent.change(screen.getByLabelText('Tu WhatsApp'), { target: { value: '6641234567' } });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: '📲 Consultar con los yonkes' })); });
    expect(screen.getByText('✅ ¡Listo! Guarda este enlace: ahí verás si algún yonke tiene tu pieza. Vence en 5 días.')).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/alerta/i);
  });

  it('aviso sin año exacto y "¿Cómo funciona?"', async () => {
    const { AvisarSinAnioExacto, ComoFunciona } = await cargar(ENCENDIDA);
    render(<AvisarSinAnioExacto tipoBusqueda="vehiculo" hayResultados marca="Toyota" modelo="Tacoma" anio="2015" pieza="Alternador" estado="" tipoResultado="cercano" />);
    expect(await screen.findByText('Si quieres, consulta con los yonkes: verán tu búsqueda activa (sin tus datos de contacto) y te responderán aquí si tienen la pieza.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '📲 Consultar con los yonkes' })).toBeInTheDocument();
    cleanup();
    render(<ComoFunciona />);
    expect(await screen.findByText('Consulta con los yonkes')).toBeInTheDocument();
    expect(screen.queryByText('Deja una búsqueda activa')).not.toBeInTheDocument();
  });
});

describe('bandera apagada: igual que en main', () => {
  it('AlertaUnPaso: compacta, discreta, sin resultados, envío y confirmación de siempre', async () => {
    const { AlertaUnPaso: m } = await cargar(APAGADA);
    render(<m.default variante="compacta" {...completo} />);
    await listo();
    expect(screen.getByRole('button', { name: '🔔 ¿No era lo que buscabas? Consulta con los yonkes aquí' })).toBeInTheDocument();
    cleanup();
    render(<m.default variante="discreta" {...completo} />);
    await listo();
    expect(screen.getByRole('button', { name: '🔔 ¿No encontraste la pieza exacta? Consulta con los yonkes' })).toBeInTheDocument();
    cleanup();
    render(<m.default variante="protagonista" {...completo} />);
    await listo();
    expect(screen.getByText('Consulta con los yonkes de Sonora: verán tu búsqueda activa y te responderán con su precio.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '🚨 Consultar con los yonkes 🚨' }));
    global.fetch = vi.fn(async () => ({ ok: true, json: async () => ({ ok: true, enlace: ENLACE }) }));
    fireEvent.change(screen.getByLabelText('Tu WhatsApp'), { target: { value: '6641234567' } });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: '🚨 Enviar búsqueda activa' })); });
    expect(screen.getByText('Ver mi búsqueda activa')).toBeInTheDocument();
  });

  it('errores de siempre', async () => {
    const { AlertaUnPaso: m, pedidos } = await cargar(APAGADA);
    render(<m.default variante="protagonista" {...completo} abiertoDeEntrada />);
    await listo();
    global.fetch = vi.fn(async () => ({ ok: false, json: async () => ({ ok: false, mensaje: pedidos.MENSAJES_PEDIDO.limiteWhatsapp }) }));
    fireEvent.change(screen.getByLabelText('Tu WhatsApp'), { target: { value: '6641234567' } });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: '🚨 Enviar búsqueda activa' })); });
    expect(screen.getByRole('alert')).toHaveTextContent(`Ya enviaste ${pedidos.MAX_PEDIDOS_POR_WHATSAPP_DIA} búsquedas activas hoy con este WhatsApp. Intenta mañana.`);
  });

  it('AvisarYonkes, aviso sin año exacto y "¿Cómo funciona?" de siempre', async () => {
    const { AvisarYonkes: a, AvisarSinAnioExacto, ComoFunciona } = await cargar(APAGADA);
    render(<a.default />);
    await listo();
    expect(screen.getByText('¿No la encontraste? Deja una búsqueda activa y los yonkes de tu estado te responden con precio si la tienen.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '🚨 Consultar con los yonkes 🚨' })).toBeInTheDocument();
    cleanup();
    render(<AvisarSinAnioExacto tipoBusqueda="vehiculo" hayResultados marca="Toyota" modelo="Tacoma" anio="2015" pieza="Alternador" estado="" tipoResultado="cercano" />);
    expect(await screen.findByText('Si quieres, consulta con los yonkes: verán tu búsqueda activa (sin tus datos de contacto) y te responderán aquí si tienen la pieza.')).toBeInTheDocument();
    cleanup();
    render(<ComoFunciona />);
    expect(await screen.findByText('Deja una búsqueda activa')).toBeInTheDocument();
  });
});
