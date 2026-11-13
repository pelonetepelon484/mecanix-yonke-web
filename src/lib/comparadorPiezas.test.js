import { describe, expect, it } from 'vitest';
import {
  ALERTA_CLUSTER, MENSAJES_COMPARADOR, NOTA_PARTES_DISTINTAS, TIPOS_PIEZA, NOTA_PROGRAMACION, NOTA_VERIFICAR_PARTE, RESULTADOS, claveVin, compararVehiculos,
  normalizarParte, normalizarVin, resultadoPorPieza, validarEntrada, vehiculoDesdeVpic, vinParaMostrar, vinValido,
} from './comparadorPiezas';

const fila = (extra = {}) => ({
  Make: 'NISSAN', Model: 'Versa', ModelYear: '2015', EngineModel: 'HR16DE', DisplacementL: '1.598000', EngineCylinders: '4',
  FuelTypePrimary: 'Gasoline', TransmissionStyle: '', DriveType: 'FWD/Front-Wheel Drive', BodyClass: 'Sedan/Saloon',
  PlantCountry: 'MEXICO', PlantCity: 'AGUASCALIENTES', ...extra,
});
const v = (extra) => vehiculoDesdeVpic(fila(extra));

describe('VIN y número de parte', () => {
  it('VIN: 17 caracteres sin I, O ni Q; mayúsculas y sin espacios', () => {
    expect(normalizarVin(' 3n1cn7ap-5fl 812345 ')).toBe('3N1CN7AP5FL812345');
    expect(vinValido('3N1CN7AP5FL812345')).toBe(true);
    for (const malo of ['3N1CN7AP5FL81234', '3N1CN7AP5FL8123456', '3N1CN7AP5FL81234O', '3N1CN7AP5FL81234I', '3N1CN7AP5FL81234Q']) expect(vinValido(malo)).toBe(false);
  });
  it('clave sin número de serie y sin dígito verificador', () => {
    expect(claveVin('3N1CN7AP5FL812345')).toBe('3N1CN7AP*FL');
    expect(claveVin('3N1CN7AP5FL8123')).toBeNull();
    expect(vinParaMostrar('3N1CN7AP5FL812345')).toBe('3N1CN7AP5FL••••••');
  });
  it('número de parte: mayúsculas, sin espacios, guiones, puntos ni diagonales', () => {
    expect(normalizarParte(' 23710-3sg 0a.b/1 ')).toBe('237103SG0AB1');
  });
});

describe('datos de vPIC', () => {
  it('toma los 12 campos reales; vacíos y "Not Applicable" quedan vacíos', () => {
    const d = v({ EngineModel: 'Not Applicable', TransmissionStyle: null });
    expect(d).toMatchObject({ marca: 'NISSAN', modelo: 'Versa', anio: '2015', motor: '', cilindrada: '1.6', cilindros: '4', transmision: '', pais: 'MEXICO', sinDatos: false });
  });
  it('sin marca ni año: sin datos', () => {
    expect(vehiculoDesdeVpic({ Make: '', ModelYear: '' }).sinDatos).toBe(true);
    expect(vehiculoDesdeVpic(null).sinDatos).toBe(true);
  });
});

describe('comparación campo por campo', () => {
  it('coincide / difiere / sin datos, y el porcentaje solo con lo comparado', () => {
    const c = compararVehiculos(v(), v({ ModelYear: '2017', DisplacementL: '1.6' }));
    const estado = Object.fromEntries(c.filas.map((f) => [f.key, f.estado]));
    expect(estado).toMatchObject({ marca: 'coincide', anio: 'difiere', cilindrada: 'coincide', transmision: 'sin_datos' });
    expect(c.comparados).toBe(11);
    expect(c.coinciden).toBe(10);
    expect(c.porcentaje).toBe(91);
  });
  it('sin datos de un lado: nada comparado y sin porcentaje', () => {
    const c = compararVehiculos(v(), { sinDatos: true });
    expect(c.comparados).toBe(0);
    expect(c.porcentaje).toBeNull();
    expect(c.filas.every((f) => f.estado === 'sin_datos')).toBe(true);
  });
});

describe('resultado por pieza', () => {
  it('número de parte idéntico: compatible (las electrónicas con su nota)', () => {
    expect(resultadoPorPieza({ tipo: 'motor', parteA: 'ABC123', parteB: 'ABC123' }).resultado).toBe(RESULTADOS.compatible);
    for (const tipo of ['computadora', 'tcm', 'bcm', 'cluster']) {
      const r = resultadoPorPieza({ tipo, parteA: 'ABC123', parteB: 'ABC123' });
      expect(r.resultado).toBe(RESULTADOS.compatible);
      expect(r.nota).toBe(NOTA_PROGRAMACION);
    }
  });
  it('distintos pero registrados como equivalentes o para ese vehículo: según registros', () => {
    expect(resultadoPorPieza({ tipo: 'motor', parteA: 'A11', parteB: 'B22' }, null, null, { equivalentes: true }).resultado).toBe(RESULTADOS.registros);
    expect(resultadoPorPieza({ tipo: 'bcm', parteA: 'A11' }, null, v(), { aplicacion: true })).toMatchObject({ resultado: RESULTADOS.registros, nota: NOTA_PROGRAMACION });
  });
  it('electrónicas: el VIN nunca basta', () => {
    expect(resultadoPorPieza({ tipo: 'computadora' }, v(), v())).toMatchObject({ resultado: RESULTADOS.indeterminado, nota: NOTA_VERIFICAR_PARTE });
    expect(resultadoPorPieza({ tipo: 'tcm', parteA: 'A11', parteB: 'B22' }, v(), v())).toMatchObject({ resultado: RESULTADOS.indeterminado, nota: NOTA_PARTES_DISTINTAS });
  });
  it('motor: cilindrada, cilindros, combustible y año cercano', () => {
    expect(resultadoPorPieza({ tipo: 'motor' }, v(), v({ ModelYear: '2018' })).resultado).toBe(RESULTADOS.probable);
    expect(resultadoPorPieza({ tipo: 'motor' }, v(), v({ ModelYear: '2019' })).resultado).toBe(RESULTADOS.noCompatible);
    expect(resultadoPorPieza({ tipo: 'motor' }, v(), v({ DisplacementL: '1.8' })).resultado).toBe(RESULTADOS.noCompatible);
    expect(resultadoPorPieza({ tipo: 'motor' }, v(), v({ FuelTypePrimary: 'Diesel' })).resultado).toBe(RESULTADOS.noCompatible);
    expect(resultadoPorPieza({ tipo: 'motor' }, v(), v({ EngineCylinders: '' })).resultado).toBe(RESULTADOS.indeterminado);
  });
  it('transmisión: sin el tipo de transmisión no se adivina; con tracción distinta, no compatible', () => {
    expect(resultadoPorPieza({ tipo: 'transmision' }, v(), v()).resultado).toBe(RESULTADOS.indeterminado);
    const auto = { TransmissionStyle: 'Automatic' };
    expect(resultadoPorPieza({ tipo: 'transmision' }, v(auto), v(auto)).resultado).toBe(RESULTADOS.probable);
    expect(resultadoPorPieza({ tipo: 'transmision' }, v(auto), v({ TransmissionStyle: 'Manual/Standard' })).resultado).toBe(RESULTADOS.noCompatible);
    expect(resultadoPorPieza({ tipo: 'transmision' }, v(auto), v({ ...auto, DriveType: 'AWD/All-Wheel Drive' })).resultado).toBe(RESULTADOS.noCompatible);
  });
  it('sin datos de VIN: no se puede determinar', () => {
    expect(resultadoPorPieza({ tipo: 'motor' }, v(), null).resultado).toBe(RESULTADOS.indeterminado);
    expect(resultadoPorPieza({ tipo: 'motor' }, { sinDatos: true }, v()).resultado).toBe(RESULTADOS.indeterminado);
  });
});

describe('lista de piezas (2026-11-07)', () => {
  it('dos grupos: mecánica solo motor y transmisión; sin discos de freno ni bolsas de aire', () => {
    expect(TIPOS_PIEZA.map((t) => t.key)).toEqual(['motor', 'transmision', 'computadora', 'tcm', 'bcm', 'cluster']);
    expect(JSON.stringify(TIPOS_PIEZA)).not.toMatch(/freno|bolsa|airbag/i);
  });
  it('tablero: siempre la alerta del kilometraje del carro donante; las demás, sin alerta', () => {
    expect(resultadoPorPieza({ tipo: 'cluster', parteA: 'A11', parteB: 'A11' }).alerta).toBe(ALERTA_CLUSTER);
    expect(resultadoPorPieza({ tipo: 'cluster' }, v(), v()).alerta).toBe(ALERTA_CLUSTER);
    expect(ALERTA_CLUSTER).toMatch(/kilometraje del carro donante/);
    expect(resultadoPorPieza({ tipo: 'motor' }, v(), v()).alerta).toBeNull();
  });
});

describe('entrada', () => {
  it('pide tipo, valida VIN y número de parte, y algo de cada lado', () => {
    expect(validarEntrada({})).toEqual({ ok: false, mensaje: MENSAJES_COMPARADOR.tipo });
    expect(validarEntrada({ tipo: 'motor', vinA: 'corto', vinB: '3N1CN7AP5FL812345' }).mensaje).toBe(MENSAJES_COMPARADOR.vinA);
    expect(validarEntrada({ tipo: 'motor', vinA: '3N1CN7AP5FL812345', vinB: 'x' }).mensaje).toBe(MENSAJES_COMPARADOR.vinB);
    expect(validarEntrada({ tipo: 'motor', parteA: 'a-', parteB: 'ABC123' }).mensaje).toBe(MENSAJES_COMPARADOR.parte);
    expect(validarEntrada({ tipo: 'motor', vinA: '3N1CN7AP5FL812345' }).mensaje).toBe(MENSAJES_COMPARADOR.nada);
    expect(validarEntrada({ tipo: 'motor', parteA: 'abc-123', vinB: '3n1cn7ap5fl812345' })).toEqual({
      ok: true, datos: { tipo: 'motor', vinA: '', vinB: '3N1CN7AP5FL812345', parteA: 'ABC123', parteB: '' },
    });
  });
  it('el mensaje del límite no dice "gratis"', () => {
    expect(JSON.stringify(MENSAJES_COMPARADOR)).not.toMatch(/gratis/i);
  });
});
