import { describe, expect, it } from 'vitest';
import { idContadorRateLimit } from './rateLimitId';

describe('idContadorRateLimit', () => {
  it('no contiene la IP en claro', () => {
    const id = idContadorRateLimit('187.190.12.34', 100, 'sal');
    expect(id).not.toContain('187');
    expect(id).not.toContain('190.12');
  });
  it('es determinista para misma IP+minuto+sal', () => {
    expect(idContadorRateLimit('1.2.3.4', 5, 'sal')).toBe(idContadorRateLimit('1.2.3.4', 5, 'sal'));
  });
  it('cambia con la IP, el minuto o la sal', () => {
    const base = idContadorRateLimit('1.2.3.4', 5, 'sal');
    expect(idContadorRateLimit('1.2.3.5', 5, 'sal')).not.toBe(base);
    expect(idContadorRateLimit('1.2.3.4', 6, 'sal')).not.toBe(base);
    expect(idContadorRateLimit('1.2.3.4', 5, 'otra')).not.toBe(base);
  });
  it('formato seguro para ID de Firestore: hex_minuto, sin "/" ni espacios', () => {
    expect(idContadorRateLimit('::1', 42, 's')).toMatch(/^[0-9a-f]{32}_42$/);
  });
});
