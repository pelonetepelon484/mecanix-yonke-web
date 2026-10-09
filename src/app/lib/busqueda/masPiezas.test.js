import { describe, expect, it, vi } from 'vitest';

// Sin Firestore: el catálogo vivo y config/sinonimosPiezas no existen, se usa solo la base del repo.
vi.mock('../firebase-server', () => ({ dbServer: {} }));
vi.mock('firebase/firestore', () => ({
  doc: vi.fn(), collection: vi.fn(),
  getDoc: vi.fn(async () => ({ exists: () => false, data: () => ({}) })),
  getDocs: vi.fn(async () => ({ docs: [], empty: true })),
}));

const { extraerIntencion } = await import('./extraerIntencion');
const { filtrarPrevio } = await import('./filtroPrevio');
const { obtenerSinonimosCombinados } = await import('./sinonimosPiezas');
const { PIEZAS_CATALOGO, PIEZAS_CATALOGO_SUELTAS, PIEZAS_POR_VEHICULO, PIEZAS_SOLO_CATALOGO } = await import('../piezasCatalogo');

const pieza = async (texto) => (await extraerIntencion(texto)).pieza;

const NUEVAS = [
  'Módulo ABS', 'Módulo de bolsas de aire', 'Bolsas de aire', 'Sensores de oxígeno', 'Sensor de cigüeñal',
  'Sensor de árbol de levas', 'Radiador', 'Condensador de A/C', 'Electroventilador', 'Bomba de gasolina', 'Inyectores',
  'Motor de limpiaparabrisas', 'Elevador de vidrio', 'Estéreo', 'Switch de encendido', 'Catalizador', 'Mofle',
];

describe('catálogo', () => {
  it('las 17 piezas nuevas están en el catálogo y en piezas sueltas, pero NO se crean solas en cada vehículo', () => {
    expect(PIEZAS_SOLO_CATALOGO).toEqual(NUEVAS);
    for (const p of NUEVAS) {
      expect(PIEZAS_CATALOGO).toContain(p);
      expect(PIEZAS_CATALOGO_SUELTAS).toContain(p);
      expect(PIEZAS_POR_VEHICULO).not.toContain(p);
    }
  });
  it('cada vehículo nuevo sigue creando 52 piezas; el catálogo completo tiene 69', () => {
    expect(PIEZAS_POR_VEHICULO).toHaveLength(52);
    expect(PIEZAS_CATALOGO).toHaveLength(69);
    expect(new Set(PIEZAS_CATALOGO).size).toBe(69); // sin duplicados
  });
  it('"Cuerpo de aceleración" no se duplicó: ya existía como "Garganta"', () => {
    expect(PIEZAS_CATALOGO).toContain('Garganta');
    expect(PIEZAS_CATALOGO).not.toContain('Cuerpo de aceleración');
  });
});

describe('cada pieza nueva se encuentra por sus nombres comunes', () => {
  const casos = {
    'Módulo ABS': ['modulo abs', 'abs', 'bomba abs', 'unidad abs', 'computadora abs', 'abs module'],
    'Módulo de bolsas de aire': ['modulo de bolsas de aire', 'modulo srs', 'srs', 'modulo de airbag', 'computadora de bolsas de aire', 'airbag module'],
    'Bolsas de aire': ['bolsa de aire', 'bolsas de aire', 'airbag', 'bolsa de aire del volante'],
    Garganta: ['cuerpo de aceleracion', 'cuerpo de aceleración', 'throttle body', 'garganta', 'mariposa de aceleracion'],
    'Sensores de oxígeno': ['sensor de oxigeno', 'sensor de oxígeno', 'sensores de oxigeno', 'sensor o2', 'sonda lambda', 'oxygen sensor'],
    'Sensor de cigüeñal': ['sensor de cigüeñal', 'sensor de ciguenal', 'sensor ckp', 'crankshaft sensor'],
    'Sensor de árbol de levas': ['sensor de arbol de levas', 'sensor de árbol de levas', 'sensor de levas', 'sensor cmp', 'camshaft sensor'],
    Radiador: ['radiador', 'radiator'],
    'Condensador de A/C': ['condensador', 'condensador de a/c', 'condensador del aire acondicionado', 'condensador del clima', 'ac condenser'],
    Electroventilador: ['electroventilador', 'ventilador', 'ventilador del radiador', 'abanico', 'motoventilador', 'radiator fan'],
    'Bomba de gasolina': ['bomba de gasolina', 'bomba gasolina', 'bomba de combustible', 'fuel pump'],
    Inyectores: ['inyector', 'inyectores', 'fuel injector'],
    'Motor de limpiaparabrisas': ['motor de limpiaparabrisas', 'motor limpiaparabrisas', 'motor de limpiadores', 'motor de limpia', 'wiper motor'],
    'Elevador de vidrio': ['elevador de vidrio', 'elevador', 'motor de vidrio', 'motor del vidrio', 'motor de ventana', 'alzavidrios', 'window regulator'],
    Estéreo: ['estereo', 'estéreo', 'autoestereo', 'autoestéreo', 'radio', 'car stereo'],
    'Switch de encendido': ['switch de encendido', 'chapa de encendido', 'interruptor de encendido', 'inmovilizador', 'ignition switch'],
    Catalizador: ['catalizador', 'convertidor catalitico', 'catalytic converter'],
    Mofle: ['mofle', 'silenciador', 'muffler'],
  };
  for (const [esperada, sinonimos] of Object.entries(casos)) {
    it(`${esperada} (${sinonimos.length} formas) con vehículo`, async () => {
      for (const s of sinonimos) {
        const r = await extraerIntencion(`${s} nissan sentra 2010`);
        expect({ s, pieza: r.pieza }).toEqual({ s, pieza: esperada });
        expect({ s, reconocido: r.reconocido, modelo: r.modelo }).toEqual({ s, reconocido: true, modelo: 'Sentra' });
      }
    });
  }
  it('pasan el filtro previo (no se registran como "no interpretadas")', async () => {
    const sinonimos = await obtenerSinonimosCombinados();
    for (const s of ['abs sentra 2010', 'srs sentra 2010', 'mofle tsuru 2005', 'silenciador versa 2015', 'radio sentra 2010', 'inyector sentra 2010', 'sensor o2 sentra 2010', 'catalizador sentra 2010']) {
      expect({ s, permitido: filtrarPrevio(s, sinonimos).permitido }).toEqual({ s, permitido: true });
    }
  });
});

describe('choques de palabras', () => {
  it('"módulo abs" no es BCM', async () => {
    expect(await pieza('módulo abs sentra 2010')).toBe('Módulo ABS');
    expect(await pieza('modulo bcm sentra 2010')).toBe('Módulo BCM');
  });
  it('"sensor de oxígeno" no es "sensor de cigüeñal" (ni el MAF)', async () => {
    expect(await pieza('sensor de oxigeno sentra 2010')).toBe('Sensores de oxígeno');
    expect(await pieza('sensor de ciguenal sentra 2010')).toBe('Sensor de cigüeñal');
    expect(await pieza('sensor maf sentra 2010')).toBe('Sensor MAF');
  });
  it('"bolsa de aire" no es "módulo de bolsas de aire"', async () => {
    expect(await pieza('bolsa de aire sentra 2010')).toBe('Bolsas de aire');
    expect(await pieza('modulo de bolsas de aire sentra 2010')).toBe('Módulo de bolsas de aire');
  });
  it('"radiador" no es "condensador"; el soporte de radiador sigue siendo su propia pieza', async () => {
    expect(await pieza('radiador sentra 2010')).toBe('Radiador');
    expect(await pieza('condensador sentra 2010')).toBe('Condensador de A/C');
    expect(await pieza('soporte de radiador sentra 2010')).toBe('Soporte de radiador');
    expect(await pieza('header plate sentra 2010')).toBe('Soporte de radiador');
    expect(await pieza('ventilador del radiador sentra 2010')).toBe('Electroventilador');
  });
  it('"motor de vidrio" y "motor de limpiaparabrisas" no son el motor del vehículo', async () => {
    expect(await pieza('motor de vidrio sentra 2010')).toBe('Elevador de vidrio');
    expect(await pieza('motor limpiaparabrisas sentra 2010')).toBe('Motor de limpiaparabrisas');
    expect(await pieza('motor sentra 2010')).toBe('Motor');
    expect(await pieza('motor nissan sentra 2010')).toBe('Motor');
  });
  it('"mofle" y "silenciador" son la misma pieza; "catalizador" no es mofle', async () => {
    expect(await pieza('mofle sentra 2010')).toBe('Mofle');
    expect(await pieza('silenciador sentra 2010')).toBe('Mofle');
    expect(await pieza('catalizador sentra 2010')).toBe('Catalizador');
  });
  it('"estéreo", "autoestéreo" y "radio" son la misma pieza; "radio" no es "radiador"', async () => {
    for (const s of ['estéreo', 'autoestéreo', 'radio']) expect(await pieza(`${s} sentra 2010`)).toBe('Estéreo');
  });
  it('"switch" solo no se lee como encendido; "bobina de encendido" sigue siendo bobinas', async () => {
    expect(await pieza('switch sentra 2010')).not.toBe('Switch de encendido');
    expect(await pieza('switch de encendido sentra 2010')).toBe('Switch de encendido');
    expect(await pieza('bobina de encendido sentra 2010')).toBe('Bobinas de encendido');
  });
  it('lo que ya funcionaba sigue igual', async () => {
    expect(await pieza('bomba de direccion sentra 2010')).toBe('Bomba de dirección');
    expect(await pieza('computadora sentra 2010')).toBe('Computadora de motor');
    expect(await pieza('caja de fusibles sentra 2010')).toBe('Caja de fusibles');
    expect(await pieza('caja sentra 2010')).toBe('Transmisión');
    expect(await pieza('alternador sentra 2010')).toBe('Alternador');
    expect(await pieza('compresor sentra 2010')).toBe('Compresor A/C');
    expect(await pieza('filtro de aire sentra 2010')).toBe('Filtro de aire');
  });
});
