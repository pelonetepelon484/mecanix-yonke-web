import { describe, expect, it } from 'vitest';
import { banderasPortada } from './configPortada';

// Las dos de asistencia vial, apagadas.
const AV = { asistenciaVialProximamente: false, asistenciaVialActiva: false, asistenciaVialMapa: false, asistenciaVialRegistro: false };

describe('config/portada', () => {
  it('botonPanel solo con true exacto', () => {
    expect(banderasPortada({ botonPanel: true }).botonPanel).toBe(true);
    for (const c of [null, undefined, {}, { botonPanel: 'true' }, { botonPanel: 1 }]) expect(banderasPortada(c).botonPanel).toBe(false);
  });

  it('ecosistema solo con true exacto: sin documento, false u otro valor = apagada', () => {
    expect(banderasPortada(null)).toEqual({ botonPanel: false, ecosistema: false, bienvenida: false, ...AV });
    expect(banderasPortada({ ecosistema: false }).ecosistema).toBe(false);
    for (const valor of ['true', 1, 'si', {}, []]) expect(banderasPortada({ ecosistema: valor }).ecosistema).toBe(false);
    expect(banderasPortada({ ecosistema: true })).toEqual({ botonPanel: false, ecosistema: true, bienvenida: false, ...AV });
    // Una no enciende la otra.
    expect(banderasPortada({ botonPanel: true })).toEqual({ botonPanel: true, ecosistema: false, bienvenida: false, ...AV });
  });

  it('bienvenida solo con true exacto y sin encender las otras', () => {
    expect(banderasPortada({ bienvenida: true })).toEqual({ botonPanel: false, ecosistema: false, bienvenida: true, ...AV });
    for (const valor of ['true', 1, 'si', {}, [], false]) expect(banderasPortada({ bienvenida: valor }).bienvenida).toBe(false);
  });

  it('asistencia vial: cada una solo con true exacto y sin encender las otras', () => {
    expect(banderasPortada({ asistenciaVialProximamente: true })).toEqual({ botonPanel: false, ecosistema: false, bienvenida: false, asistenciaVialProximamente: true, asistenciaVialActiva: false, asistenciaVialMapa: false, asistenciaVialRegistro: false });
    expect(banderasPortada({ asistenciaVialActiva: true })).toEqual({ botonPanel: false, ecosistema: false, bienvenida: false, asistenciaVialProximamente: false, asistenciaVialActiva: true, asistenciaVialMapa: false, asistenciaVialRegistro: false });
    for (const valor of ['true', 1, 'si', {}, [], false]) {
      expect(banderasPortada({ asistenciaVialProximamente: valor }).asistenciaVialProximamente).toBe(false);
      expect(banderasPortada({ asistenciaVialActiva: valor }).asistenciaVialActiva).toBe(false);
      expect(banderasPortada({ asistenciaVialMapa: valor }).asistenciaVialMapa).toBe(false);
      expect(banderasPortada({ asistenciaVialRegistro: valor }).asistenciaVialRegistro).toBe(false);
    }
    expect(banderasPortada({ asistenciaVialMapa: true }).asistenciaVialMapa).toBe(true);
    expect(banderasPortada({ asistenciaVialMapa: true }).asistenciaVialActiva).toBe(false);
    expect(banderasPortada({ asistenciaVialRegistro: true })).toEqual({ botonPanel: false, ecosistema: false, bienvenida: false, ...AV, asistenciaVialRegistro: true });
  });
});
