import { describe, expect, it } from 'vitest';
import { MENSAJES_CODIGO, mensajeCodigoTemporal, validarUsoCodigo } from './codigoTemporal';

describe('validarUsoCodigo', () => {
  it('limpia WhatsApp y código', () => {
    expect(validarUsoCodigo({ whatsapp: '664-123-4567', codigo: ' abcdefghjkmn ', password: 'clave-nueva' }).datos)
      .toEqual({ whatsapp: '6641234567', codigo: 'abcdefghjkmn', password: 'clave-nueva' });
  });
  it('rechaza lo inválido', () => {
    expect(validarUsoCodigo({}).error).toBe(MENSAJES_CODIGO.whatsapp);
    expect(validarUsoCodigo({ whatsapp: '6641234567', codigo: 'x' }).error).toBe(MENSAJES_CODIGO.codigo);
    expect(validarUsoCodigo({ whatsapp: '6641234567', codigo: 'abcdefghjkmn', password: 'corta' }).error).toBe(MENSAJES_CODIGO.password);
  });
});

describe('mensajeCodigoTemporal', () => {
  it('incluye código, vigencia y enlace', () => {
    const m = mensajeCodigoTemporal('abcdefghjkmn');
    expect(m).toContain('abcdefghjkmn');
    expect(m).toContain('24 horas');
    expect(m).toContain('/panel/codigo-temporal');
  });
});
