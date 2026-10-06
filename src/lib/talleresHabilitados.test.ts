import { afterEach, describe, expect, it, vi } from 'vitest';
import { talleresHabilitados } from './talleresHabilitados';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('talleresHabilitados', () => {
  it('apagada si la variable no existe', () => {
    vi.stubEnv('NEXT_PUBLIC_TALLERES_HABILITADOS', undefined as unknown as string);
    expect(talleresHabilitados()).toBe(false);
  });
  it('apagada con cualquier valor distinto de exactamente "1"', () => {
    for (const valor of ['', '0', 'true', 'si', ' 1', '1 ', '01', 'TRUE']) {
      vi.stubEnv('NEXT_PUBLIC_TALLERES_HABILITADOS', valor);
      expect(talleresHabilitados(), `valor "${valor}"`).toBe(false);
    }
  });
  it('encendida solo con "1"', () => {
    vi.stubEnv('NEXT_PUBLIC_TALLERES_HABILITADOS', '1');
    expect(talleresHabilitados()).toBe(true);
  });
});
