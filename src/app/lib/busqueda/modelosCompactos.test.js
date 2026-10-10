import { describe, expect, it, vi } from 'vitest';

// Sin Firestore: el catálogo vivo y config/sinonimosPiezas no existen, se usa solo la base del repo.
// getDocs devuelve el inventario falso de `inventario` (para buscarVehiculosPorAnio).
let inventario = [];
vi.mock('../firebase-server', () => ({ dbServer: {} }));
vi.mock('firebase/firestore', () => ({
  doc: vi.fn(), collection: vi.fn(), query: vi.fn(), where: vi.fn(), getFirestore: vi.fn(() => ({})),
  getDoc: vi.fn(async () => ({ exists: () => false, data: () => ({}) })),
  getDocs: vi.fn(async () => ({ docs: inventario.map((d) => ({ data: () => d })), empty: inventario.length === 0 })),
}));

const { extraerIntencion } = await import('./extraerIntencion');
const { existeEnCatalogoVivo } = await import('./consultarInventario');
const { buscarVehiculosPorAnio } = await import('../buscarVehiculosPorAnio');
const { CATALOGO_BASE } = await import('../catalogoBase');
const { compactarModelo, mismoModelo } = await import('../modeloCompacto');

const leer = async (texto) => {
  const r = await extraerIntencion(texto);
  return { marca: r.marca, modelo: r.modelo, anio: r.anio, pieza: r.pieza, pregunta: r.requiereConfirmacion, modeloDesconocido: r.modeloDesconocido, piezaSinVehiculo: r.piezaSinVehiculo };
};

describe('casos reales de producción', () => {
  it('"honda crv 2015" -> Honda CR-V 2015, sin preguntar y sin "modelo desconocido"', async () => {
    expect(await leer('honda crv 2015')).toMatchObject({ marca: 'Honda', modelo: 'CR-V', anio: 2015, pregunta: false, modeloDesconocido: false });
  });
  it('"toyota pickup 1989" -> Toyota Pickup 1989', async () => {
    expect(await leer('toyota pickup 1989')).toMatchObject({ marca: 'Toyota', modelo: 'Pickup', anio: 1989, pregunta: false, modeloDesconocido: false });
  });
  it('"crv 2015 faro" (sin marca) -> Honda CR-V con la pieza', async () => {
    const r = await leer('crv 2015 faro');
    expect(r).toMatchObject({ marca: 'Honda', modelo: 'CR-V', anio: 2015, pregunta: false });
    expect(r.pieza).toBeTruthy();
  });
  it('"pickup 1990 defensa" (sin marca) NO se vuelve Toyota: pide el vehículo', async () => {
    expect(await leer('pickup 1990 defensa')).toMatchObject({ marca: null, modelo: null, piezaSinVehiculo: true });
  });
});

describe('crv, cr v y cr-v dan lo mismo', () => {
  for (const texto of ['honda crv', 'honda cr v', 'honda cr-v', 'honda CR-V', 'honda Cr-V', 'honda cr.v']) {
    it(texto, async () => {
      expect(await leer(`${texto} 2015`)).toMatchObject({ marca: 'Honda', modelo: 'CR-V', pregunta: false });
    });
  }
  for (const texto of ['toyota rav4', 'toyota rav 4', 'toyota rav-4']) {
    it(texto, async () => { expect(await leer(texto)).toMatchObject({ marca: 'Toyota', modelo: 'RAV4', pregunta: false }); });
  }
});

// Todas las formas de escribir (junto, separado, con guion) de cada modelo del catálogo base que
// lleva guion, espacio o punto, o letras pegadas a números. Se omiten a propósito: variantes con
// una palabra de relleno suelta ("a 4": nunca se pega, ver la prueba de "a 4 cilindros") y las que
// dejan un año suelto ("b 2000": "2000" se lee como año).
const RELLENO = new Set(['a', 'o', 'y', 'de', 'el', 'la', 'en', 'un', 'mi', 'su', 'me', 'se', 'al', 'del']);
const esAnio = (t) => /^(19[8-9]\d|20[0-3]\d)$/.test(t);
const normal = (t) => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const VARIANTES = [];
for (const [marca, modelos] of Object.entries(CATALOGO_BASE)) {
  for (const modelo of modelos) {
    const n = normal(modelo);
    const sinSep = n.replace(/[-\s.&]/g, '');
    if (!/[-\s.]/.test(n) && !/[a-z][0-9]|[0-9][a-z]/.test(sinSep)) continue;
    const formas = new Set([
      sinSep,
      n.replace(/[-.]/g, ' ').replace(/\s+/g, ' '),
      sinSep.replace(/([a-z])([0-9])/g, '$1 $2').replace(/([0-9])([a-z])/g, '$1 $2'),
    ]);
    formas.delete(n); // escrito igual que en el catálogo: eso lo resuelve el paso exacto de siempre
    for (const f of formas) {
      const tokens = f.split(' ');
      if (tokens.some((t) => RELLENO.has(t) || esAnio(t))) continue;
      VARIANTES.push([marca, modelo, f]);
    }
  }
}

describe('todas las variantes del catálogo base, con la marca escrita', () => {
  it(`hay suficientes variantes para que la prueba valga la pena (${VARIANTES.length})`, () => {
    expect(VARIANTES.length).toBeGreaterThan(120);
  });
  it.each(VARIANTES)('%s %s escrito "%s"', async (marca, modelo, forma) => {
    const r = await leer(`${normal(marca)} ${forma}`);
    expect(r.modelo).toBe(modelo);
    expect(r.pregunta).toBe(false);
  });
});

describe('sin marca: modelos de 4+ y la lista corta de 3', () => {
  const casos = [
    ['crv 2015', 'Honda', 'CR-V'], ['hrv', 'Honda', 'HR-V'], ['cx5 2018', 'Mazda', 'CX-5'], ['cx 5 2018', 'Mazda', 'CX-5'],
    ['cx 9 2010', 'Mazda', 'CX-9'], ['mx5', 'Mazda', 'MX-5'], ['s 10 1998', 'Chevrolet', 'S10'], ['c10 1980', 'Chevrolet', 'C-10'],
    ['k 10 1985', 'Chevrolet', 'K-10'], ['d21 1994', 'Nissan', 'D21'], ['rav 4 2010', 'Toyota', 'RAV4'], ['f 150 2005', 'Ford', 'F-150'],
    ['xtrail 2012', 'Nissan', 'X-Trail'], ['hilux 2000', 'Toyota', 'Hilux'],
  ];
  it.each(casos)('"%s" -> %s %s', async (texto, marca, modelo) => {
    expect(await leer(texto)).toMatchObject({ marca, modelo, pregunta: false });
  });
  it('modelos genéricos sin marca no se adivinan: "estacas 1995" ni "pick up 1990"', async () => {
    expect(await leer('estacas 1995')).toMatchObject({ marca: null, modelo: null });
    expect(await leer('pick up 1990')).toMatchObject({ marca: null, modelo: null });
  });
  it('genéricos CON marca sí: "nissan estacas", "isuzu pick up", "toyota pick-up"', async () => {
    expect(await leer('nissan estacas 1995')).toMatchObject({ marca: 'Nissan', modelo: 'Estacas' });
    expect(await leer('isuzu pick up 1990')).toMatchObject({ marca: 'Isuzu', modelo: 'Pickup' });
    expect(await leer('toyota pick-up 1989')).toMatchObject({ marca: 'Toyota', modelo: 'Pickup' });
  });
});

describe('modelos nuevos de camionetas viejas', () => {
  const casos = [
    ['ford f100 1975', 'Ford', 'F-100'], ['ford ranchero 1972', 'Ford', 'Ranchero'], ['chevrolet luv 1980', 'Chevrolet', 'LUV'],
    ['dodge d150 1985', 'Dodge', 'D-150'], ['dodge d 100 1970', 'Dodge', 'D-100'], ['dodge ram 50 1990', 'Dodge', 'Ram 50'],
    ['dodge ramcharger 1988', 'Dodge', 'Ramcharger'], ['nissan hardbody 1995', 'Nissan', 'Hardbody'], ['nissan pickup 1992', 'Nissan', 'Pickup'],
    ['mazda b2200 1990', 'Mazda', 'B2200'], ['mazda b 2600 1991', 'Mazda', 'B2600'], ['mitsubishi mighty max 1993', 'Mitsubishi', 'Mighty Max'],
  ];
  it.each(casos)('"%s" -> %s %s', async (texto, marca, modelo) => {
    expect(await leer(texto)).toMatchObject({ marca, modelo, pregunta: false });
  });
});

describe('lo que ya funcionaba sigue igual', () => {
  const casos = [
    ['mazda 3 2015', 'Mazda', '3'], ['dodge ram 1500 2010', 'Dodge', 'Ram 1500'], ['dodge ram 700', 'RAM', '700'],
    ['chrysler ram 700', 'RAM', '700'], ['cheyenne 2010', 'Chevrolet', 'Cheyenne'], ['honda civic 2005', 'Honda', 'Civic'],
    ['toyota land cruiser 1995', 'Toyota', 'Land Cruiser'], ['bmw serie 3 2008', 'BMW', 'Serie 3'], ['tsuru 2010', 'Nissan', 'Tsuru'],
    ['chevrolet silverado 1500 2012', 'Chevrolet', 'Silverado'],
  ];
  it.each(casos)('"%s" -> %s %s', async (texto, marca, modelo) => {
    expect(await leer(texto)).toMatchObject({ marca, modelo });
  });
  it('"town & country" (con el signo) ahora sí se reconoce', async () => {
    expect((await leer('chrysler town & country 2005')).modelo).toBe('Town & Country');
  });
  it('"a 4 cilindros" nunca se lee como Audi A4', async () => {
    expect((await leer('audi motor a 4 cilindros')).modelo).not.toBe('A4');
  });
  it('un modelo que de verdad no existe sigue siendo "modelo desconocido"', async () => {
    expect(await leer('toyota hiace 2010')).toMatchObject({ marca: 'Toyota', modelo: null, modeloDesconocido: true });
  });
  it('solo marca y año: sin modelo y sin "modelo desconocido"', async () => {
    expect(await leer('nissan 2015')).toMatchObject({ marca: 'Nissan', modelo: null, modeloDesconocido: false });
  });
  it('arregla de paso los que hoy agarraban otro modelo: "cx 5", "mx 5", "cx 3", "300 m"', async () => {
    expect((await leer('mazda cx 5')).modelo).toBe('CX-5');
    expect((await leer('mazda mx 5')).modelo).toBe('MX-5');
    expect((await leer('mazda cx 3')).modelo).toBe('CX-3');
    expect((await leer('chrysler 300 m')).modelo).toBe('300M');
  });
});

const YONKE = { id: 'Y1', data: () => ({ activo: true }) };

describe('comparación contra el inventario y el catálogo', () => {
  it('compactarModelo / mismoModelo', () => {
    expect(compactarModelo('CR-V')).toBe('crv');
    expect(compactarModelo(' Cr v ')).toBe('crv');
    expect(compactarModelo('Town & Country')).toBe('towncountry');
    expect(mismoModelo('CR-V', 'crv')).toBe(true);
    expect(mismoModelo('RAV4', 'rav 4')).toBe(true);
    expect(mismoModelo('Silverado', 'Silverado 1500')).toBe(false);
    expect(mismoModelo('', '')).toBe(false);
    expect(mismoModelo(null, undefined)).toBe(false);
  });
  it('existeEnCatalogoVivo reconoce "CRV" y "rav 4" como modelos del catálogo', async () => {
    expect(await existeEnCatalogoVivo('Honda', 'CRV')).toBe(true);
    expect(await existeEnCatalogoVivo('Toyota', 'rav 4')).toBe(true);
    expect(await existeEnCatalogoVivo('Toyota', 'Pickup')).toBe(true);
    expect(await existeEnCatalogoVivo('Honda', 'Atlas')).toBe(false);
  });
  it('inventario: un "CR-V" buscado encuentra lo que el yonke capturó como "CRV", "Cr-V" o "cr v"', async () => {
    inventario = [
      { marca: 'Honda', modelo: 'CRV', ano: 2015 }, { marca: 'Honda', modelo: 'Cr-V', ano: 2015 },
      { marca: 'Honda', modelo: 'cr v', ano: 2015 }, { marca: 'Honda', modelo: 'Civic', ano: 2015 },
      { marca: 'Honda', modelo: 'CR-V', ano: 2015, disponible: false },
    ];
    const r = await buscarVehiculosPorAnio({}, [YONKE], 'Honda', 'CR-V', 2015);
    expect(r.map((x) => x.vDoc.data().modelo)).toEqual(['CRV', 'Cr-V', 'cr v']);
    inventario = [];
  });
  it('inventario: "Cheyenne" sigue encontrando "Silverado" y "Silverado 1500"', async () => {
    inventario = [{ marca: 'Chevrolet', modelo: 'Silverado', ano: 2010 }, { marca: 'Chevrolet', modelo: 'Silverado 1500', ano: 2010 }, { marca: 'Chevrolet', modelo: 'Tahoe', ano: 2010 }];
    const r = await buscarVehiculosPorAnio({}, [YONKE], 'Chevrolet', 'Cheyenne', 2010);
    expect(r.map((x) => x.vDoc.data().modelo)).toEqual(['Silverado', 'Silverado 1500']);
    inventario = [];
  });
});
