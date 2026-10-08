import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { claveLimite, codigoCoincide, generarCodigo, hashCodigo } from './pedidosClientesServidor';
import { esCodigo } from './pedidosClientes';

describe('código del enlace del cliente', () => {
  it('32 bytes al azar en base64url (43 caracteres), distinto cada vez', () => {
    const codigos = new Set(Array.from({ length: 200 }, generarCodigo));
    expect(codigos.size).toBe(200);
    for (const c of codigos) expect(esCodigo(c)).toBe(true);
  });
  it('se guarda solo su SHA-256 y se compara contra él', () => {
    const c = generarCodigo();
    const hash = hashCodigo(c);
    expect(hash).toBe(createHash('sha256').update(c).digest('hex'));
    expect(hash).not.toContain(c);
    expect(codigoCoincide(c, hash)).toBe(true);
    expect(codigoCoincide(generarCodigo(), hash)).toBe(false);
  });
  it('un hash guardado mal formado nunca coincide', () => {
    const c = generarCodigo();
    for (const malo of [undefined, null, '', 'abc', c, hashCodigo(c).toUpperCase(), 42]) expect(codigoCoincide(c, malo)).toBe(false);
  });
});

describe('claves de los contadores de límite', () => {
  it('no guardan la IP ni el WhatsApp en claro, y cambian con la sal y la ventana', () => {
    const k = claveLimite('wa', '6641234567', 20000, 'sal-1');
    expect(k).toMatch(/^wa_[0-9a-f]{32}_20000$/);
    expect(k).not.toContain('6641234567');
    expect(claveLimite('wa', '6641234567', 20000, 'sal-2')).not.toBe(k);
    expect(claveLimite('wa', '6641234567', 20001, 'sal-1')).not.toBe(k);
    expect(claveLimite('ip', '6641234567', 20000, 'sal-1').startsWith('ip_')).toBe(true);
  });
});
