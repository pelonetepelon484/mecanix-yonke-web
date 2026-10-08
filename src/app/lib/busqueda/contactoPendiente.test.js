import { describe, expect, it, vi } from 'vitest';
import {
  MENSAJE_SIN_INVENTARIO, MENSAJE_SIN_INVENTARIO_PEDIDOS, MENSAJE_VEHICULO_SIN_INVENTARIO, MENSAJE_VEHICULO_SIN_INVENTARIO_PEDIDOS,
  crearPersistirContacto, mensajeSinInventario,
} from './contactoPendiente';

const FECHA = new Date('2026-10-08T18:00:00Z');
function armar(activos) {
  const guardar = vi.fn(async () => {});
  const notificar = vi.fn(async () => {});
  const persistir = crearPersistirContacto({ guardar, notificar, pedidosClientesActivos: vi.fn(async () => activos), ahora: () => FECHA });
  return { guardar, notificar, persistir };
}
const busqueda = { texto: 'alternador sentra 2005', pieza: 'Alternador', marca: 'Nissan', modelo: 'Sentra', anio: 2005, estado: 'sin_inventario' };

describe('/api/buscar con config/pedidosClientes APAGADA o inexistente: exactamente como antes', () => {
  it('guarda en busquedas_pendientes con la misma forma de siempre y avisa al admin con el mismo texto', async () => {
    const { guardar, notificar, persistir } = armar(false);
    await persistir('664 123 4567', busqueda);
    expect(guardar).toHaveBeenCalledWith('busquedas_pendientes', {
      pieza: 'Alternador', marca: 'Nissan', modelo: 'Sentra', anio: 2005,
      textoOriginal: 'alternador sentra 2005', estado: 'sin_inventario', fecha: FECHA, contacto: '664 123 4567', atendido: false,
    });
    expect(notificar).toHaveBeenCalledWith(
      '🔔 Búsqueda pendiente en Mecanix\n\nBuscaban: Alternador Nissan Sentra 2005\nEstado: sin_inventario\nContacto del cliente: 664 123 4567\n\nRevisa el panel para dar seguimiento.',
    );
    expect(guardar.mock.invocationCallOrder[0]).toBeLessThan(notificar.mock.invocationCallOrder[0]);
  });
  it('sin datos estructurados usa el texto original en el aviso, y nulos por omisión', async () => {
    const { guardar, notificar, persistir } = armar(false);
    await persistir('6641234567', { texto: 'hola', estado: 'no_interpretada' });
    expect(guardar.mock.calls[0][1]).toMatchObject({ pieza: null, marca: null, modelo: null, anio: null, textoOriginal: 'hola' });
    expect(notificar.mock.calls[0][0]).toContain('Buscaban: hola');
  });
  it('sin contacto no guarda ni avisa', async () => {
    const { guardar, notificar, persistir } = armar(false);
    await persistir('', busqueda);
    expect(guardar).not.toHaveBeenCalled();
    expect(notificar).not.toHaveBeenCalled();
  });
  it('los mensajes de "sin inventario" son los de siempre', () => {
    expect(mensajeSinInventario()).toBe('No tenemos esa pieza en inventario ahorita, pero te avisamos en cuanto algún yonke la registre.');
    expect(mensajeSinInventario({ vehiculo: true })).toBe('No tenemos ese vehículo en inventario ahorita, pero te avisamos en cuanto algún yonke lo registre.');
    expect(mensajeSinInventario({ pedidosClientesActivos: false })).toBe(MENSAJE_SIN_INVENTARIO);
    expect(mensajeSinInventario({ vehiculo: true, pedidosClientesActivos: false })).toBe(MENSAJE_VEHICULO_SIN_INVENTARIO);
  });
});

describe('/api/buscar con config/pedidosClientes PRENDIDA', () => {
  it('no guarda en busquedas_pendientes ni avisa por CallMeBot, aunque llegue un contacto', async () => {
    const { guardar, notificar, persistir } = armar(true);
    await persistir('664 123 4567', busqueda);
    expect(guardar).not.toHaveBeenCalled();
    expect(notificar).not.toHaveBeenCalled();
  });
  it('el mensaje de "sin inventario" ya no promete avisar', () => {
    expect(mensajeSinInventario({ pedidosClientesActivos: true })).toBe(MENSAJE_SIN_INVENTARIO_PEDIDOS);
    expect(mensajeSinInventario({ vehiculo: true, pedidosClientesActivos: true })).toBe(MENSAJE_VEHICULO_SIN_INVENTARIO_PEDIDOS);
    expect(MENSAJE_SIN_INVENTARIO_PEDIDOS).not.toMatch(/avisamos/);
    expect(MENSAJE_VEHICULO_SIN_INVENTARIO_PEDIDOS).not.toMatch(/avisamos/);
  });
});
