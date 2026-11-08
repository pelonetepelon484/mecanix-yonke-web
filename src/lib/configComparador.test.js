import { describe, expect, it } from 'vitest';
import { LIMITES_POR_DEFECTO, ROLES_CON_CUENTA, banderasComparador } from './configComparador';

describe('config/comparador', () => {
  it('sin documento: apagado, sin login, búsqueda IA apagada y con los límites de inicio (5, 5, 20 y 10)', () => {
    expect(banderasComparador(null)).toEqual({
      habilitado: false, requiereLogin: false, limiteDiarioIp: 5, limiteDiarioDispositivo: 5, limiteDiarioConCuenta: 20, sugerenciasIA: false, limiteDiarioIA: 10,
    });
    expect(LIMITES_POR_DEFECTO).toEqual({ limiteDiarioIp: 5, limiteDiarioDispositivo: 5, limiteDiarioConCuenta: 20, limiteDiarioIA: 10 });
  });
  it('la búsqueda IA solo se enciende con true exacto y su límite es editable', () => {
    for (const v of ['true', 1, {}, null]) expect(banderasComparador({ habilitado: true, sugerenciasIA: v }).sugerenciasIA).toBe(false);
    expect(banderasComparador({ sugerenciasIA: true, limiteDiarioIA: 3 })).toMatchObject({ sugerenciasIA: true, limiteDiarioIA: 3 });
    expect(banderasComparador({ limiteDiarioIA: '50' }).limiteDiarioIA).toBe(10);
  });
  it('solo true exacto enciende; cada interruptor por separado', () => {
    for (const v of ['true', 1, {}, []]) {
      expect(banderasComparador({ habilitado: v }).habilitado).toBe(false);
      expect(banderasComparador({ requiereLogin: v }).requiereLogin).toBe(false);
    }
    expect(banderasComparador({ requiereLogin: true })).toMatchObject({ habilitado: false, requiereLogin: true });
  });
  it('límites editables; un valor raro usa el de inicio', () => {
    expect(banderasComparador({ limiteDiarioIp: 10, limiteDiarioConCuenta: 50 })).toMatchObject({ limiteDiarioIp: 10, limiteDiarioDispositivo: 5, limiteDiarioConCuenta: 50 });
    for (const v of ['10', -1, 1.5, 5000, null]) expect(banderasComparador({ limiteDiarioIp: v }).limiteDiarioIp).toBe(5);
  });
  it('solo yonke, taller y admin cuentan como cuenta', () => {
    expect(ROLES_CON_CUENTA).toEqual(['yonke', 'taller', 'admin']);
  });
});
