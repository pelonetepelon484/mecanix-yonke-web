import { describe, expect, it } from 'vitest';
import { MENSAJES_TALLER, normalizarWhatsapp, validarRegistroTaller, validarWhatsappTaller } from './taller';

const base = {
  nombre: 'Taller Pepe',
  whatsapp: '6641234567',
  ciudad: 'Tijuana',
  email: 'pepe@taller.mx',
  password: 'abcdefgh',
  confirmarPassword: 'abcdefgh',
};

describe('normalizarWhatsapp', () => {
  it('quita espacios y guiones', () => {
    expect(normalizarWhatsapp('664 123-4567')).toBe('6641234567');
  });
});

describe('validarWhatsappTaller', () => {
  it('acepta 10 dígitos, con espacios o guiones', () => {
    expect(validarWhatsappTaller('664-123 4567')).toEqual({ ok: true, valor: '6641234567' });
  });
  it('rechaza 9 dígitos, 11 dígitos y letras', () => {
    expect(validarWhatsappTaller('664123456').ok).toBe(false);
    expect(validarWhatsappTaller('66412345678').ok).toBe(false);
    expect(validarWhatsappTaller('66abc34567').ok).toBe(false);
  });
});

describe('validarRegistroTaller', () => {
  it('acepta datos válidos y limpia espacios del nombre y del correo', () => {
    const r = validarRegistroTaller({ ...base, nombre: '  Taller Pepe ', email: ' pepe@taller.mx ' });
    expect(r).toEqual({
      ok: true,
      datos: { nombre: 'Taller Pepe', whatsapp: '6641234567', ciudad: 'Tijuana', email: 'pepe@taller.mx', password: 'abcdefgh' },
    });
  });
  it('pide llenar los campos obligatorios', () => {
    expect(validarRegistroTaller({ ...base, ciudad: '  ' })).toEqual({ ok: false, mensaje: MENSAJES_TALLER.camposVacios });
  });
  it('exige nombre de al menos 2 letras', () => {
    expect(validarRegistroTaller({ ...base, nombre: 'A' })).toEqual({ ok: false, mensaje: MENSAJES_TALLER.nombre });
  });
  it('exige WhatsApp de 10 dígitos con el mensaje aprobado', () => {
    expect(validarRegistroTaller({ ...base, whatsapp: '12345' })).toEqual({ ok: false, mensaje: MENSAJES_TALLER.whatsapp });
  });
  it('rechaza un correo sin formato', () => {
    expect(validarRegistroTaller({ ...base, email: 'pepe@' })).toEqual({ ok: false, mensaje: MENSAJES_TALLER.correo });
  });
  it('exige contraseña de al menos 8 caracteres', () => {
    expect(validarRegistroTaller({ ...base, password: 'abc1234', confirmarPassword: 'abc1234' })).toEqual({ ok: false, mensaje: MENSAJES_TALLER.password });
  });
  it('avisa si las contraseñas no coinciden', () => {
    expect(validarRegistroTaller({ ...base, confirmarPassword: 'otra-clave' })).toEqual({ ok: false, mensaje: MENSAJES_TALLER.passwordNoCoincide });
  });
});
