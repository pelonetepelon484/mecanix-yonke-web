// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

// Página principal con config/pedidosClientes.formularioAbierto: el servidor manda
// formularioAbierto en la respuesta de búsqueda y, con la alerta de un paso encendida, el formulario
// sale abierto SOLO en sin_inventario, no_catalogado, sin_yonkes_estado y sin_en_tu_zona.
// Firestore simulado (config/pedidosClientes con alertaUnPaso y alertaSiempre encendidas).
vi.mock('./lib/firebase', () => ({ db: 'db' }));
vi.mock('firebase/firestore', () => ({
  doc: (...a) => a.slice(1).join('/'),
  collection: (...a) => a.slice(1).join('/'),
  query: (...a) => a[0], where: () => null, orderBy: () => null, limit: () => null,
  getDoc: vi.fn(async (ruta) => (ruta === 'config/pedidosClientes'
    ? { exists: () => true, data: () => ({ habilitado: true, alertaUnPaso: true, alertaSiempre: true }) }
    : { exists: () => false, data: () => ({}) })),
  getDocs: vi.fn(async () => ({ docs: [], empty: true, size: 0, forEach: () => {} })),
  addDoc: vi.fn(async () => ({ id: 'x' })),
}));

const { default: HomeClient } = await import('./HomeClient');
const { TEXTO_BOTON_ALERTA } = await import('./AvisarYonkes.js');

const BUSQUEDA = { marca: 'Nissan', modelo: 'Sentra', anio: 2005, pieza: 'Alternador' };
const TARJETA = {
  yonkeId: 'SON', yonkeNombre: 'Yonke Sonora', ciudad: 'Hermosillo', vehiculoId: 'v1', estadoYonke: 'sonora',
  calificacion: { promedio: 0, total: 0 }, metodosPago: [], vehiculo: { marca: 'Nissan', modelo: 'Sentra', anio: 2005 }, piezas: [], fotos: {},
};
const GRUPOS = [{ estado: 'sonora', estadoNombre: 'Sonora', resultados: [TARJETA] }];
// Respuesta del servidor para cada caso (sin la marca formularioAbierto).
const RESPUESTAS = {
  sin_inventario: { estado: 'sin_inventario', mensaje: 'No tenemos esa pieza en inventario ahorita.', busqueda: BUSQUEDA },
  no_catalogado: { estado: 'no_catalogado', mensaje: 'No identificamos ese modelo todavía — ¿nos confirmas la marca y el año?', busqueda: BUSQUEDA },
  sin_yonkes_estado: { estado: 'sin_yonkes_estado', mensaje: 'Todavía no hay yonkes en ese estado.', busqueda: BUSQUEDA },
  sin_en_tu_zona: {
    estado: 'resultados', resultados: [], resultadosCercanos: [], tipoResultado: 'exacto', busqueda: BUSQUEDA, marca: 'Nissan', modelo: 'Sentra', anio: 2005,
    sinResultadosEnTuEstado: { estado: 'jalisco', estadoNombre: 'Jalisco' }, resultadosOtrosEstados: GRUPOS,
  },
  numero_de_parte: { estado: 'numero_de_parte', mensaje: 'Parece un número de parte.' },
  pieza_sin_vehiculo: { estado: 'pieza_sin_vehiculo', mensaje: '¿Para qué vehículo es?', pieza: 'Alternador', ejemplo: 'alternador tsuru 2005' },
};

let respuesta = null;
beforeEach(() => {
  global.fetch = vi.fn(async () => ({ ok: true, json: async () => respuesta }));
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

async function buscar(caso, formularioAbierto) {
  respuesta = { ...RESPUESTAS[caso], ...(formularioAbierto ? { formularioAbierto: true } : {}) };
  render(<HomeClient textoSeoEstados="" />);
  fireEvent.change(screen.getByPlaceholderText('¿Qué pieza necesitas?'), { target: { value: 'alternador sentra 2005' } });
  fireEvent.click(screen.getByRole('button', { name: /Buscar con IA/ }));
  await waitFor(() => expect(global.fetch).toHaveBeenCalled());
  // Se espera a que aparezca la alerta (abierta o cerrada).
  await waitFor(() => expect(screen.queryByLabelText('Tu WhatsApp') || screen.queryByRole('button', { name: TEXTO_BOTON_ALERTA })).toBeTruthy());
}

const abierta = () => Boolean(screen.queryByLabelText('Tu WhatsApp'));

describe('formulario de la alerta abierto de entrada', () => {
  describe('bandera encendida (formularioAbierto en la respuesta)', () => {
    for (const caso of ['sin_inventario', 'no_catalogado', 'sin_yonkes_estado', 'sin_en_tu_zona']) {
      it(`${caso}: sale abierto, sin el botón`, async () => {
        await buscar(caso, true);
        expect(abierta()).toBe(true);
        expect(screen.queryByRole('button', { name: TEXTO_BOTON_ALERTA })).not.toBeInTheDocument();
        expect(screen.getByRole('button', { name: '📲 Consultar con los yonkes' })).toBeInTheDocument();
      });
    }
    for (const caso of ['numero_de_parte', 'pieza_sin_vehiculo']) {
      it(`${caso}: sigue cerrado, con el botón (aunque llegue la marca)`, async () => {
        await buscar(caso, true);
        expect(abierta()).toBe(false);
        expect(screen.getByRole('button', { name: TEXTO_BOTON_ALERTA })).toBeInTheDocument();
      });
    }
  });

  describe('bandera apagada: todo se ve igual que hoy', () => {
    for (const caso of ['sin_inventario', 'no_catalogado', 'sin_yonkes_estado', 'sin_en_tu_zona', 'numero_de_parte', 'pieza_sin_vehiculo']) {
      it(`${caso}: cerrado, con el botón`, async () => {
        await buscar(caso, false);
        expect(abierta()).toBe(false);
        expect(screen.getByRole('button', { name: TEXTO_BOTON_ALERTA })).toBeInTheDocument();
      });
    }
  });
});
