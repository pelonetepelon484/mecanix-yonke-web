import { describe, expect, it } from 'vitest';
import { geoDesdeHeadersVercel } from './geoVercel';

describe('geoDesdeHeadersVercel', () => {
  it('México con región válida -> estado en minúsculas y ciudad decodificada', () => {
    expect(geoDesdeHeadersVercel({ country: 'MX', region: 'BCN', city: 'Tijuana' }))
      .toEqual({ estado: 'bcn', ciudad: 'Tijuana', pais: 'MX' });
    expect(geoDesdeHeadersVercel({ country: 'mx', region: 'CMX', city: 'Ciudad%20de%20M%C3%A9xico' }))
      .toEqual({ estado: 'cmx', ciudad: 'Ciudad de México', pais: 'MX' });
  });

  it('alias antiguo DIF -> cmx', () => {
    expect(geoDesdeHeadersVercel({ country: 'MX', region: 'DIF' }).estado).toBe('cmx');
  });

  it('país distinto de MX -> desconocido pero conserva el país', () => {
    expect(geoDesdeHeadersVercel({ country: 'US', region: 'CA', city: 'Los%20Angeles' }))
      .toEqual({ estado: 'desconocido', ciudad: null, pais: 'US' });
  });

  it('región no reconocida en México -> desconocido', () => {
    expect(geoDesdeHeadersVercel({ country: 'MX', region: 'XXX', city: 'Algo' }))
      .toEqual({ estado: 'desconocido', ciudad: null, pais: 'MX' });
  });

  it('sin headers (local) -> desconocido y país null, nunca asume MX', () => {
    expect(geoDesdeHeadersVercel({})).toEqual({ estado: 'desconocido', ciudad: null, pais: null });
    expect(geoDesdeHeadersVercel({ country: null, region: null, city: null }))
      .toEqual({ estado: 'desconocido', ciudad: null, pais: null });
  });

  it('ciudad ausente o con codificación inválida -> null sin lanzar', () => {
    expect(geoDesdeHeadersVercel({ country: 'MX', region: 'JAL' }).ciudad).toBeNull();
    expect(geoDesdeHeadersVercel({ country: 'MX', region: 'JAL', city: '%E0%A4%A' }).ciudad).toBeNull();
  });
});
