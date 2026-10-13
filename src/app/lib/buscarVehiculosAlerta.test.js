import { describe, expect, it, vi } from 'vitest';

const pares = [];
const buscarVehiculosPorAnio = vi.fn(async () => pares);
vi.mock('./buscarVehiculosPorAnio', () => ({ buscarVehiculosPorAnio: (...a) => buscarVehiculosPorAnio(...a) }));

const { buscarVehiculosAlerta, sinYonkesYaMostrados } = await import('./buscarVehiculosAlerta.js');

const DIA = 24 * 60 * 60 * 1000;
const AHORA = new Date('2026-10-12T18:00:00Z');
const yonke = (id, extra = {}) => ({ id, data: () => ({ nombre: `Yonke ${id}`, whatsapp: '6641111111', ciudad: 'Tijuana', activo: true, ...extra }) });
const vehiculo = (id, extra = {}) => ({
  id, data: () => ({ marca: 'Honda', modelo: 'Civic', ano: 2020, estado: 'activo', venceEn: new Date(AHORA.getTime() + 5 * DIA), piezasVendidas: [], ...extra }),
});

describe('buscarVehiculosAlerta', () => {
  it('sin marca, modelo, año o pieza no consulta nada', async () => {
    expect(await buscarVehiculosAlerta('db', [], { marca: 'Honda', modelo: 'Civic', anio: 2020, pieza: '' }, AHORA)).toEqual([]);
    expect(await buscarVehiculosAlerta('db', [], { marca: 'Honda', modelo: 'Civic', anio: null, pieza: 'Faro' }, AHORA)).toEqual([]);
    expect(buscarVehiculosPorAnio).not.toHaveBeenCalled();
  });

  it('usa la subcolección vehiculosAlerta con el año exacto y deja solo vigentes sin esa pieza vendida (Premium primero)', async () => {
    pares.splice(0, pares.length,
      { yonkeDoc: yonke('Y1'), vDoc: vehiculo('v1') },
      { yonkeDoc: yonke('Y2'), vDoc: vehiculo('v2', { piezasVendidas: ['ALTERNADOR'] }) },
      { yonkeDoc: yonke('Y3'), vDoc: vehiculo('v3', { venceEn: new Date(AHORA.getTime() - DIA) }) },
      { yonkeDoc: yonke('Y4', { plan: 'premium' }), vDoc: vehiculo('v4') });
    const lista = await buscarVehiculosAlerta('db', ['docs'], { marca: 'Honda', modelo: 'Civic', anio: 2020, pieza: 'Alternador' }, AHORA);
    expect(buscarVehiculosPorAnio).toHaveBeenCalledWith('db', ['docs'], 'Honda', 'Civic', 2020, 'vehiculosAlerta');
    expect(lista.map((v) => v.yonkeId)).toEqual(['Y4', 'Y1']);
    expect(lista[1]).toMatchObject({ yonkeNombre: 'Yonke Y1', whatsapp: '6641111111', vehiculo: { marca: 'Honda', modelo: 'Civic', ano: 2020 } });
  });

  it('con varias unidades, el yonke sigue apareciendo hasta que esa pieza se vende en todas', async () => {
    pares.splice(0, pares.length,
      { yonkeDoc: yonke('Y1'), vDoc: vehiculo('v1', { unidades: 3, ventasPiezas: { alternador: 2 } }) },
      { yonkeDoc: yonke('Y2'), vDoc: vehiculo('v2', { unidades: 3, ventasPiezas: { alternador: 3 } }) },
      // Registro viejo: 1 unidad y "alternador" vendido 1 vez.
      { yonkeDoc: yonke('Y3'), vDoc: vehiculo('v3', { piezasVendidas: ['Alternador'] }) });
    const lista = await buscarVehiculosAlerta('db', [], { marca: 'Honda', modelo: 'Civic', anio: 2020, pieza: 'Alternador' }, AHORA);
    expect(lista.map((v) => v.yonkeId)).toEqual(['Y1']);
    // El comprador nunca ve el número de unidades.
    expect(lista[0]).not.toHaveProperty('unidades');
    expect(lista[0].vehiculo).not.toHaveProperty('unidades');
  });

  it('no repite un yonke que ya sale en los resultados con un vehículo del mismo año', () => {
    const lista = [{ yonkeId: 'Y1', vehiculo: { ano: 2020 } }, { yonkeId: 'Y2', vehiculo: { ano: 2020 } }];
    expect(sinYonkesYaMostrados(lista, [{ yonkeId: 'Y1', vehiculo: { ano: 2020 } }, { yonkeId: 'Y2', vehiculo: { ano: 2018 } }]).map((v) => v.yonkeId)).toEqual(['Y2']);
  });
});
