import { describe, expect, it } from 'vitest';
import { DEMANDA_MINIMO_POR_FILA, claveDemanda, construirReporteDemanda } from './reporteDemandaYonke';

function b(pieza: string | null, marca: string | null, modelo: string | null, anio: number | null, conResultado: boolean) {
  return { pieza, marca, modelo, anio, conResultado };
}

describe('claveDemanda', () => {
  it('con año', () => {
    expect(claveDemanda(b('Calavera', 'Dodge', 'Stratus', 2002, true), true)).toBe('Calavera — Dodge Stratus 2002');
  });
  it('sin año (incluirAnio=false)', () => {
    expect(claveDemanda(b('Calavera', 'Dodge', 'Stratus', 2002, true), false)).toBe('Calavera — Dodge Stratus');
  });
  it('sin ningún dato', () => {
    expect(claveDemanda(b(null, null, null, null, true), true)).toBe('(sin detalle)');
  });
});

describe('construirReporteDemanda', () => {
  it('el umbral mínimo es 2', () => {
    expect(DEMANDA_MINIMO_POR_FILA).toBe(2);
  });

  it('descarta grupos con menos del mínimo, sin exponer el conteo', () => {
    const r = construirReporteDemanda([
      b('Calavera', 'Dodge', 'Stratus', 2002, true), // 1 sola -- no alcanza
      b('Faro', 'Honda', 'Civic', 2010, true),
      b('Faro', 'Honda', 'Civic', 2010, true), // 2 -- sí alcanza
    ], { incluirAnio: true });
    expect(r).toEqual([{ clave: 'Faro — Honda Civic 2010', estado: 'Con resultado' }]);
  });

  it('una sola búsqueda sin resultado en el grupo basta para "Demanda sin cubrir"', () => {
    const r = construirReporteDemanda([
      b('Faro', 'Honda', 'Civic', 2010, true),
      b('Faro', 'Honda', 'Civic', 2010, true),
      b('Faro', 'Honda', 'Civic', 2010, false),
    ], { incluirAnio: true });
    expect(r).toEqual([{ clave: 'Faro — Honda Civic 2010', estado: 'Demanda sin cubrir' }]);
  });

  it('todas con resultado -> "Con resultado"', () => {
    const r = construirReporteDemanda([
      b('Faro', 'Honda', 'Civic', 2010, true),
      b('Faro', 'Honda', 'Civic', 2010, true),
    ], { incluirAnio: true });
    expect(r[0].estado).toBe('Con resultado');
  });

  it('ordena de más a menos buscado', () => {
    const busquedas = [
      ...Array(2).fill(b('A', 'M', 'X', 2020, true)),
      ...Array(4).fill(b('B', 'M', 'Y', 2020, true)),
      ...Array(3).fill(b('C', 'M', 'Z', 2020, true)),
    ];
    const r = construirReporteDemanda(busquedas, { incluirAnio: true });
    expect(r.map((f) => f.clave)).toEqual(['B — M Y 2020', 'C — M Z 2020', 'A — M X 2020']);
  });

  it('incluirAnio=false junta el mismo vehículo de distintos años en una sola fila', () => {
    const r = construirReporteDemanda([
      b('Calavera', 'Dodge', 'Stratus', 2001, true),
      b('Calavera', 'Dodge', 'Stratus', 2002, false),
    ], { incluirAnio: false });
    expect(r).toEqual([{ clave: 'Calavera — Dodge Stratus', estado: 'Demanda sin cubrir' }]);
  });

  it('default incluirAnio=true si no se especifica', () => {
    const r = construirReporteDemanda([
      b('Calavera', 'Dodge', 'Stratus', 2001, true),
      b('Calavera', 'Dodge', 'Stratus', 2001, true),
      b('Calavera', 'Dodge', 'Stratus', 2002, true),
    ]);
    // 2001 x2 alcanza el mínimo, 2002 (x1) no -- confirma que se agrupó CON año por default.
    expect(r).toEqual([{ clave: 'Calavera — Dodge Stratus 2001', estado: 'Con resultado' }]);
  });

  it('lista vacía -> []', () => {
    expect(construirReporteDemanda([])).toEqual([]);
  });

  it('ninguna fila del resultado contiene un número en ninguna de sus propiedades', () => {
    const r = construirReporteDemanda([
      b('Faro', 'Honda', 'Civic', 2010, true),
      b('Faro', 'Honda', 'Civic', 2010, false),
    ]);
    for (const fila of r) {
      for (const valor of Object.values(fila)) {
        expect(typeof valor).not.toBe('number');
      }
    }
  });
});
