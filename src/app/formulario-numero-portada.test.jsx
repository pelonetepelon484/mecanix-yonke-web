// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

// Página principal en modo número (config/pedidosClientes.formularioAbierto, que el servidor manda
// como formularioAbierto en la respuesta) contra la bandera apagada: recuadro de la alerta, título de
// otros estados y el recuadro azul "Aún no tenemos yonkes registrados en…".
vi.mock('./lib/firebase', () => ({ db: 'db' }));
vi.mock('firebase/firestore', () => ({
  doc: (...a) => a.slice(1).join('/'),
  collection: (...a) => a.slice(1).join('/'),
  query: (...a) => a[0], where: () => null, orderBy: () => null, limit: () => null,
  getDoc: vi.fn(async (ruta) => (ruta === 'config/pedidosClientes'
    ? { exists: () => true, data: () => ({ habilitado: true, alertaUnPaso: true, otrosEstados: true }) }
    : { exists: () => false, data: () => ({}) })),
  getDocs: vi.fn(async () => ({ docs: [], empty: true, size: 0, forEach: () => {} })),
  addDoc: vi.fn(async () => ({ id: 'x' })),
}));

const { default: HomeClient } = await import('./HomeClient');
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
  conOtrosEstados: {
    estado: 'sin_inventario', mensaje: 'No tenemos esa pieza en inventario ahorita.', busqueda: BUSQUEDA,
    otrosEstadosRevisados: true, resultadosOtrosEstados: [{ estado: 'sonora', estadoNombre: 'Sonora', resultados: [TARJETA] }],
  },
};

let respuesta = null;
beforeEach(() => { global.fetch = vi.fn(async () => ({ ok: true, json: async () => respuesta })); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

async function buscar(caso, bandera) {
  respuesta = { ...RESPUESTAS[caso], ...(bandera ? { formularioAbierto: true } : {}) };
  render(<HomeClient textoSeoEstados="" />);
  fireEvent.change(screen.getByPlaceholderText('¿Qué pieza necesitas?'), { target: { value: 'alternador sentra 2005' } });
  fireEvent.click(screen.getByRole('button', { name: /Buscar con IA/ }));
  await waitFor(() => expect(screen.queryByLabelText('Tu WhatsApp') || screen.queryByRole('button', { name: TEXTO_BOTON_ALERTA })).toBeTruthy());
}

// El recuadro naranja de la alerta (el que contiene el campo o el botón).
const recuadro = () => (screen.queryByLabelText('Tu WhatsApp') || screen.getByRole('button', { name: TEXTO_BOTON_ALERTA }))
  .closest('div[style*="border: 2px solid"]');

describe('bandera encendida (modo número)', () => {
  it('sin yonkes en el estado y ya buscado en otros estados: sin el recuadro azul; formulario abierto con el texto nuevo y sin "alerta"', async () => {
    await buscar('sinYonkesRevisado', true);
    expect(screen.queryByText(SIN_YONKES)).not.toBeInTheDocument();
    expect(screen.getByText(TEXTO_MODO_NUMERO)).toBeInTheDocument();
    expect(screen.queryByText(TITULO_SIN_RESULTADOS)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '📲 Enviar' })).toBeInTheDocument();
    const texto = recuadro().textContent.replace(TEXTO_CASILLA_OTROS_ESTADOS, '').replace(TEXTO_CONSENTIMIENTO_OTROS_ESTADOS, '');
    expect(texto).not.toMatch(/alerta|te avisamos|avisarte/i);
  });

  it('con resultados de otros estados: "Lo encontramos en otros estados" y debajo el texto nuevo', async () => {
    await buscar('conOtrosEstados', true);
    expect(screen.getByText(TITULO_CON_OTROS_ESTADOS)).toBeInTheDocument();
    expect(screen.getByText(TEXTO_MODO_NUMERO)).toBeInTheDocument();
    expect(screen.queryByText(/Activa la alerta de búsqueda/)).not.toBeInTheDocument();
  });
});

describe('bandera apagada: igual que hoy', () => {
  it('sin yonkes en el estado: el recuadro azul sigue y la alerta sale cerrada, con el botón', async () => {
    await buscar('sinYonkesRevisado', false);
    expect(screen.getByText(SIN_YONKES)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: TEXTO_BOTON_ALERTA })).toBeInTheDocument();
    expect(screen.queryByText(TEXTO_MODO_NUMERO)).not.toBeInTheDocument();
  });

  it('con resultados de otros estados: el título y el texto de siempre', async () => {
    await buscar('conOtrosEstados', false);
    expect(screen.getByText(TITULO_CON_OTROS_ESTADOS)).toBeInTheDocument();
    expect(screen.getByText(/Activa la alerta de búsqueda/)).toBeInTheDocument();
    expect(screen.queryByText(TEXTO_MODO_NUMERO)).not.toBeInTheDocument();
  });
});
