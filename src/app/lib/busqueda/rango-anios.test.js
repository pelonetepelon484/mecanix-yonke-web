import { beforeEach, describe, expect, it, vi } from 'vitest';

// Inventario falso: CR-V de varios años en dos yonkes. buscarVehiculosPorAnio filtra por año como
// el real (anio null = todos los años).
let inventario = [];
vi.mock('../firebase-server', () => ({ dbServer: {} }));
vi.mock('../firebase', () => ({ db: {}, auth: {} }));
vi.mock('firebase/firestore', () => ({
  collection: () => 'yonkes',
  getDocs: async () => ({ docs: [{ id: 'Y1', data: () => ({ activo: true, plan: 'freemium' }) }, { id: 'Y2', data: () => ({ activo: true, plan: 'premium' }) }] }),
  doc: () => 'doc', getDoc: async () => ({ exists: () => false }),
}));
vi.mock('../yonkesServerData', () => ({ getRatingParaYonke: async () => ({ promedio: null, total: 0 }) }));
vi.mock('../buscarVehiculosPorAnio', () => ({
  buscarVehiculosPorAnio: async (_db, yonkesDocs, _marca, _modelo, anio, sub = 'vehiculos') => (sub !== 'vehiculos' ? [] : inventario
    .filter((v) => anio == null || v.ano === anio)
    .map((v) => ({ yonkeDoc: yonkesDocs.find((y) => y.id === v.yonke), vDoc: { id: v.id, data: () => ({ marca: 'Honda', modelo: 'CR-V', ano: v.ano }) } }))),
}));

const { consultarInventarioVehiculo, consultarInventario } = await import('./consultarInventario');
const crv = (id, ano, yonke = 'Y1') => ({ id, ano, yonke });
const anios = (lista) => lista.map((r) => r.vehiculo.ano);
const buscar = (rango) => consultarInventarioVehiculo({ marca: 'Honda', modelo: 'CR-V', anio: 2016, estado: 'todos', rango });

beforeEach(() => { inventario = []; });

describe('"crv 2016" con el rango corto (±2)', () => {
  it('no trae la 1997 y trae 2016, 2015, 2017, 2014, 2018 en ese orden', async () => {
    inventario = [crv('v97', 1997), crv('v20', 2020), crv('v18', 2018), crv('v14', 2014), crv('v17', 2017), crv('v15', 2015), crv('v16', 2016), crv('v12', 2012)];
    const r = await buscar(2);
    expect(r.tipoResultado).toBe('exacto');
    expect([...anios(r.resultados), ...anios(r.resultadosCercanos)]).toEqual([2016, 2015, 2017, 2014, 2018]);
  });

  it('sin el año exacto, los cercanos ocupan los resultados en ese orden', async () => {
    inventario = [crv('v97', 1997), crv('v18', 2018), crv('v14', 2014), crv('v17', 2017), crv('v15', 2015)];
    const r = await buscar(2);
    expect(r.tipoResultado).toBe('cercano');
    expect(anios(r.resultados)).toEqual([2015, 2017, 2014, 2018]);
  });

  it('dentro del mismo año, Premium primero (la cercanía va antes que el plan)', async () => {
    inventario = [crv('a', 2017, 'Y1'), crv('b', 2015, 'Y1'), crv('c', 2017, 'Y2')];
    const r = await buscar(2);
    expect(r.resultados.map((x) => x.vehiculoId)).toEqual(['b', 'c', 'a']);
  });

  it('si solo hay una 1997: nada (sin resultados, para que salga la alerta)', async () => {
    inventario = [crv('v97', 1997)];
    expect(await buscar(2)).toMatchObject({ resultados: [], resultadosCercanos: [] });
  });

  it('el rango es configurable: con 1, solo 2015 y 2017', async () => {
    inventario = [crv('v18', 2018), crv('v14', 2014), crv('v17', 2017), crv('v15', 2015)];
    expect(anios((await buscar(1)).resultados)).toEqual([2015, 2017]);
  });

  it('con pieza también: nada fuera del rango', async () => {
    inventario = [crv('v97', 1997)];
    const r = await consultarInventario({ marca: 'Honda', modelo: 'CR-V', anio: 2016, pieza: 'Alternador', estado: 'todos', rango: 2 });
    expect(r.resultados).toEqual([]);
  });
});

describe('bandera apagada (rango null): exactamente como hoy', () => {
  it('±4 y, si no hay nada, "cualquier año" (la 1997 sale)', async () => {
    inventario = [crv('v97', 1997)];
    const r = await buscar(null);
    expect(r.tipoResultado).toBe('cualquierAno');
    expect(anios(r.resultados)).toEqual([1997]);
  });
  it('los cercanos llegan hasta ±4 (2012 a 2020)', async () => {
    inventario = [crv('v20', 2020), crv('v12', 2012), crv('v11', 2011)];
    const r = await buscar(null);
    expect(r.tipoResultado).toBe('cercano');
    expect(anios(r.resultados).sort()).toEqual([2012, 2020]);
  });
  it('sin año escrito ("crv"): todos los años, con o sin bandera', async () => {
    inventario = [crv('v97', 1997), crv('v16', 2016)];
    for (const rango of [null, 2]) {
      const r = await consultarInventarioVehiculo({ marca: 'Honda', modelo: 'CR-V', anio: null, estado: 'todos', rango });
      expect(anios(r.resultados).sort()).toEqual([1997, 2016]);
    }
  });
});
