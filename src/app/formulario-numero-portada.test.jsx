// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

// Página principal en modo número (config/pedidosClientes.formularioAbierto, que el servidor manda
// como formularioAbierto en la respuesta) contra la bandera apagada: recuadro de la alerta, título de
// otros estados y el recuadro azul "Aún no tenemos yonkes registrados en…".
// config/pedidosClientes: con la bandera encendida el documento trae formularioAbierto (textos de
// "consulta") y el servidor manda formularioAbierto en la respuesta (formulario abierto).
let configPedidos = {};
vi.mock('./lib/firebase', () => ({ db: 'db' }));
vi.mock('firebase/firestore', () => ({
  doc: (...a) => a.slice(1).join('/'),
  collection: (...a) => a.slice(1).join('/'),
  query: (...a) => a[0], where: () => null, orderBy: () => null, limit: () => null,
  getDoc: vi.fn(async (ruta) => (ruta === 'config/pedidosClientes'
    ? { exists: () => true, data: () => configPedidos }
    : { exists: () => false, data: () => ({}) })),
  getDocs: vi.fn(async () => ({ docs: [], empty: true, size: 0, forEach: () => {} })),
  addDoc: vi.fn(async () => ({ id: 'x' })),
}));

const { TEXTO_MODO_NUMERO, TITULO_SIN_RESULTADOS } = await import('./AlertaUnPaso.js');
const { TEXTO_BOTON_ALERTA, TEXTO_CASILLA_OTROS_ESTADOS, TEXTO_CONSENTIMIENTO_OTROS_ESTADOS } = await import('./AvisarYonkes.js');
const { TITULO_CON_OTROS_ESTADOS } = await import('../lib/otrosEstadosPantalla');

const BUSQUEDA = { marca: 'Nissan', modelo: 'Sentra', anio: 2005, pieza: 'Alternador' };
const SIN_YONKES = 'Aún no tenemos yonkes registrados en Colima — muy pronto estaremos ahí. Prueba buscando en "Todos los estados".';
const TARJETA = {
  yonkeId: 'SON', yonkeNombre: 'Yonke Sonora', ciudad: 'Hermosillo', vehiculoId: 'v1', estadoYonke: 'sonora',
  calificacion: { promedio: 0, total: 0 }, metodosPago: [], vehiculo: { marca: 'Nissan', modelo: 'Sentra', anio: 2005 }, piezas: [], fotos: {},
};
const RESPUESTAS = {
  // Ya se buscó en otros estados y tampoco hubo nada.
  sinYonkesRevisado: { estado: 'sin_yonkes_estado', mensaje: SIN_YONKES, busqueda: BUSQUEDA, otrosEstadosRevisados: true },
  // Caso a de otros estados: abajo sí hay resultados de otros estados.
  numeroDeParte: { estado: 'numero_de_parte', mensaje: 'Parece un número de parte.' },
  conOtrosEstados: {
    estado: 'sin_inventario', mensaje: 'No tenemos esa pieza en inventario ahorita.', busqueda: BUSQUEDA,
    otrosEstadosRevisados: true, resultadosOtrosEstados: [{ estado: 'sonora', estadoNombre: 'Sonora', resultados: [TARJETA] }],
  },
};

let respuesta = null;
beforeEach(() => { global.fetch = vi.fn(async () => ({ ok: true, json: async () => respuesta })); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

// Botón que abre el formulario: el de siempre o, con la bandera, el de "consulta".
const botonAbrir = () => screen.queryByRole('button', { name: TEXTO_BOTON_ALERTA }) || screen.queryByRole('button', { name: '📲 Consultar con los yonkes' });

async function buscar(caso, bandera) {
  configPedidos = { habilitado: true, alertaUnPaso: true, otrosEstados: true, ...(bandera ? { formularioAbierto: true } : {}) };
  // El servidor solo manda la marca en los casos sin resultado (ver route.js).
  const sinResultado = ['sin_inventario', 'sin_yonkes_estado'].includes(RESPUESTAS[caso].estado);
  respuesta = { ...RESPUESTAS[caso], ...(bandera && sinResultado ? { formularioAbierto: true } : {}) };
  // La lectura de banderas se guarda por carga de página: se recarga el módulo en cada prueba.
  vi.resetModules();
  const { default: HomeClient } = await import('./HomeClient');
  render(<HomeClient textoSeoEstados="" />);
  fireEvent.change(screen.getByPlaceholderText('¿Qué pieza necesitas?'), { target: { value: 'alternador sentra 2005' } });
  fireEvent.click(screen.getByRole('button', { name: /Buscar con IA/ }));
  await waitFor(() => expect(screen.queryByLabelText('Tu WhatsApp') || botonAbrir()).toBeTruthy());
}

// El recuadro naranja de la alerta (el que contiene el campo o el botón).
const recuadro = () => (screen.queryByLabelText('Tu WhatsApp') || botonAbrir())
  .closest('div[style*="border: 2px solid"]');

describe('bandera encendida (modo número)', () => {
  it('sin yonkes en el estado y ya buscado en otros estados: sin el recuadro azul; formulario abierto con el texto nuevo y sin "alerta"', async () => {
    await buscar('sinYonkesRevisado', true);
    expect(screen.queryByText(SIN_YONKES)).not.toBeInTheDocument();
    expect(screen.getByText(TEXTO_MODO_NUMERO)).toBeInTheDocument();
    expect(screen.queryByText(TITULO_SIN_RESULTADOS)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '📲 Consultar con los yonkes' })).toBeInTheDocument();
    const texto = recuadro().textContent.replace(TEXTO_CASILLA_OTROS_ESTADOS, '').replace(TEXTO_CONSENTIMIENTO_OTROS_ESTADOS, '');
    expect(texto).not.toMatch(/alerta|te avisamos|avisarte/i);
  });

  it('con resultados de otros estados: "Lo encontramos en otros estados" y debajo el texto nuevo', async () => {
    await buscar('conOtrosEstados', true);
    expect(screen.getByText(TITULO_CON_OTROS_ESTADOS)).toBeInTheDocument();
    expect(screen.getByText(TEXTO_MODO_NUMERO)).toBeInTheDocument();
    expect(screen.queryByText(/Consulta con los yonkes de tu estado/)).not.toBeInTheDocument();
  });
});

describe('bandera encendida: título del recuadro en número de parte (sin formulario abierto)', () => {
  it('"¿No encuentras la pieza? Consulta con los yonkes" y el botón "📲 Consultar con los yonkes"', async () => {
    await buscar('numeroDeParte', true);
    expect(screen.getByText('¿No encuentras la pieza? Consulta con los yonkes')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '📲 Consultar con los yonkes' })).toBeInTheDocument();
    expect(screen.queryByLabelText('Tu WhatsApp')).not.toBeInTheDocument();
  });
});

describe('bandera apagada: igual que hoy', () => {
  it('sin yonkes en el estado: el recuadro azul sigue y la alerta sale cerrada, con el botón', async () => {
    await buscar('sinYonkesRevisado', false);
    expect(screen.getByText(SIN_YONKES)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: TEXTO_BOTON_ALERTA })).toBeInTheDocument();
    expect(screen.queryByText(TEXTO_MODO_NUMERO)).not.toBeInTheDocument();
    // Al abrirla, el formulario de siempre.
    fireEvent.click(screen.getByRole('button', { name: TEXTO_BOTON_ALERTA }));
    expect(screen.getByRole('button', { name: '🚨 Enviar búsqueda activa' })).toBeInTheDocument();
  });

  it('con resultados de otros estados: el título y el texto de siempre', async () => {
    await buscar('conOtrosEstados', false);
    expect(screen.getByText(TITULO_CON_OTROS_ESTADOS)).toBeInTheDocument();
    expect(screen.getByText(/Consulta con los yonkes de tu estado/)).toBeInTheDocument();
    expect(screen.queryByText(TEXTO_MODO_NUMERO)).not.toBeInTheDocument();
  });

  it('número de parte: título "¿No encuentras la pieza? Consulta con los yonkes" y el botón de siempre', async () => {
    await buscar('numeroDeParte', false);
    expect(screen.getByText('¿No encuentras la pieza? Consulta con los yonkes')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: TEXTO_BOTON_ALERTA })).toBeInTheDocument();
  });
});
