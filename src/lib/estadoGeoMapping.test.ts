import { describe, expect, it } from 'vitest';
import { CODIGO_GEO_A_ESTADO, ESTADO_A_CODIGO_GEO, codigoGeoDeEstado, estadoDeCodigoGeo } from './estadoGeoMapping';
import { REGIONES_VALIDAS } from './geoVercel';

// Los 32 ids reales de la colección `estados`, confirmados con una lectura en vivo de solo
// lectura el 2026-09-29 (ver auditoría). Si algún día se agrega/renombra un estado en Firestore,
// este test debe actualizarse a mano junto con ESTADO_A_CODIGO_GEO — es exactamente la alarma que
// se pidió: que el mapeo nunca se desincronice en silencio de los ids reales.
const IDS_REALES_COLECCION_ESTADOS = [
  'aguascalientes', 'baja-california', 'baja-california-sur', 'campeche', 'cdmx', 'chiapas',
  'chihuahua', 'coahuila', 'colima', 'durango', 'estado-de-mexico', 'guanajuato', 'guerrero',
  'hidalgo', 'jalisco', 'michoacan', 'morelos', 'nayarit', 'nuevo-leon', 'oaxaca', 'puebla',
  'queretaro', 'quintana-roo', 'san-luis-potosi', 'sinaloa', 'sonora', 'tabasco', 'tamaulipas',
  'tlaxcala', 'veracruz', 'yucatan', 'zacatecas',
];

describe('ESTADO_A_CODIGO_GEO — cobertura completa contra los 32 ids reales', () => {
  it('tiene exactamente 32 entradas', () => {
    expect(Object.keys(ESTADO_A_CODIGO_GEO)).toHaveLength(32);
    expect(IDS_REALES_COLECCION_ESTADOS).toHaveLength(32);
  });

  it('todo id real de la colección estados tiene un código de 3 letras', () => {
    const sinCodigo = IDS_REALES_COLECCION_ESTADOS.filter((id) => !ESTADO_A_CODIGO_GEO[id]);
    expect(sinCodigo).toEqual([]);
  });

  it('la tabla no tiene ninguna llave de más que no sea un id real', () => {
    const idsExtra = Object.keys(ESTADO_A_CODIGO_GEO).filter((id) => !IDS_REALES_COLECCION_ESTADOS.includes(id));
    expect(idsExtra).toEqual([]);
  });

  it('todo código de la tabla es uno de los 32 códigos válidos (REGIONES_VALIDAS de geoVercel.ts)', () => {
    const invalidos = Object.values(ESTADO_A_CODIGO_GEO).filter((codigo) => !REGIONES_VALIDAS.has(codigo));
    expect(invalidos).toEqual([]);
  });

  it('todo código válido de REGIONES_VALIDAS tiene un estado -- ningún código queda huérfano', () => {
    const sinEstado = [...REGIONES_VALIDAS].filter((codigo) => !CODIGO_GEO_A_ESTADO[codigo]);
    expect(sinEstado).toEqual([]);
  });

  it('es una relación 1 a 1: sin códigos duplicados entre estados distintos', () => {
    const codigos = Object.values(ESTADO_A_CODIGO_GEO);
    expect(new Set(codigos).size).toBe(codigos.length);
  });
});

describe('codigoGeoDeEstado / estadoDeCodigoGeo', () => {
  it('convierte en ambas direcciones para casos reales', () => {
    expect(codigoGeoDeEstado('baja-california')).toBe('bcn');
    expect(codigoGeoDeEstado('nuevo-leon')).toBe('nle');
    expect(codigoGeoDeEstado('cdmx')).toBe('cmx');
    expect(codigoGeoDeEstado('estado-de-mexico')).toBe('mex');
    expect(estadoDeCodigoGeo('jal')).toBe('jalisco');
  });

  it('id o código desconocido -> null, sin lanzar', () => {
    expect(codigoGeoDeEstado('atlantida')).toBeNull();
    expect(estadoDeCodigoGeo('xxx')).toBeNull();
  });
});
