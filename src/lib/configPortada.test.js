import { describe, expect, it } from 'vitest';
import { banderasPortada } from './configPortada';

describe('config/portada', () => {
  it('botonPanel solo con true exacto', () => {
    expect(banderasPortada({ botonPanel: true })).toEqual({ botonPanel: true });
    for (const c of [null, undefined, {}, { botonPanel: 'true' }, { botonPanel: 1 }]) expect(banderasPortada(c)).toEqual({ botonPanel: false });
  });
});
