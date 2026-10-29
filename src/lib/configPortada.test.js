import { describe, expect, it } from 'vitest';
import { banderasPortada } from './configPortada';

describe('config/portada', () => {
  it('botonPanel solo con true exacto', () => {
    expect(banderasPortada({ botonPanel: true }).botonPanel).toBe(true);
    for (const c of [null, undefined, {}, { botonPanel: 'true' }, { botonPanel: 1 }]) expect(banderasPortada(c).botonPanel).toBe(false);
  });

  it('ecosistema solo con true exacto: sin documento, false u otro valor = apagada', () => {
    expect(banderasPortada(null)).toEqual({ botonPanel: false, ecosistema: false, bienvenida: false });
    expect(banderasPortada({ ecosistema: false }).ecosistema).toBe(false);
    for (const valor of ['true', 1, 'si', {}, []]) expect(banderasPortada({ ecosistema: valor }).ecosistema).toBe(false);
    expect(banderasPortada({ ecosistema: true })).toEqual({ botonPanel: false, ecosistema: true, bienvenida: false });
    // Una no enciende la otra.
    expect(banderasPortada({ botonPanel: true })).toEqual({ botonPanel: true, ecosistema: false, bienvenida: false });
  });

  it('bienvenida solo con true exacto y sin encender las otras', () => {
    expect(banderasPortada({ bienvenida: true })).toEqual({ botonPanel: false, ecosistema: false, bienvenida: true });
    for (const valor of ['true', 1, 'si', {}, [], false]) expect(banderasPortada({ bienvenida: valor }).bienvenida).toBe(false);
  });
});
