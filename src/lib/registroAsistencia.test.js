import { describe, expect, it } from 'vitest';
import { MENSAJES_REGISTRO, TEXTO_PERMISO, enlaceRegistro, mensajeRegistro, validarRegistro } from './registroAsistencia';

const BUENO = {
  nombre: '  Grúas   El Güero ', servicios: ['llantera', 'grua', 'inventado'], ciudades: ['rosarito', 'tijuana'],
  telefono: '(664) 123-4567', atiende24h: false, horario: 'Lunes a sábado de 8 a 8', permiso: true,
};

describe('registro de proveedores de asistencia vial', () => {
  it('valida, limpia y deja solo servicios y ciudades conocidos', () => {
    const r = validarRegistro(BUENO);
    expect(r.ok).toBe(true);
    expect(r.datos).toEqual({
      nombre: 'Grúas El Güero', servicios: ['grua', 'llantera'], ciudades: ['tijuana', 'rosarito'],
      telefono: '6641234567', atiende24h: false, horario: 'Lunes a sábado de 8 a 8',
    });
  });

  it('dice el primer problema en español', () => {
    const casos = [
      [{ nombre: ' ' }, MENSAJES_REGISTRO.nombre],
      [{ servicios: [] }, MENSAJES_REGISTRO.servicios],
      [{ servicios: ['inventado'] }, MENSAJES_REGISTRO.servicios],
      [{ ciudades: [] }, MENSAJES_REGISTRO.ciudades],
      [{ telefono: '664 123' }, MENSAJES_REGISTRO.telefono],
      [{ horario: '' }, MENSAJES_REGISTRO.horario],
      [{ permiso: false }, MENSAJES_REGISTRO.permiso],
    ];
    for (const [cambio, mensaje] of casos) expect(validarRegistro({ ...BUENO, ...cambio })).toEqual({ ok: false, mensaje });
    expect(validarRegistro()).toEqual({ ok: false, mensaje: MENSAJES_REGISTRO.nombre });
  });

  it('24 horas no pide horario', () => {
    const r = validarRegistro({ ...BUENO, atiende24h: true, horario: '' });
    expect(r.ok).toBe(true);
    expect(r.datos.horario).toBe('');
  });

  it('mensaje de WhatsApp a Red Mecanix con los datos y el permiso al final', () => {
    const { datos } = validarRegistro(BUENO);
    expect(mensajeRegistro(datos)).toBe([
      'Hola, quiero registrar mi servicio de asistencia vial en Red Mecanix.',
      'Negocio: Grúas El Güero',
      'Servicios: Grúa, Llantera / vulcanizadora',
      'Ciudades: Tijuana, Playas de Rosarito',
      'Teléfono: 664 123 4567',
      'Horario: Lunes a sábado de 8 a 8',
      '',
      TEXTO_PERMISO,
    ].join('\n'));
    expect(mensajeRegistro({ ...datos, atiende24h: true, horario: '' })).toContain('Horario: 24 horas');
    expect(enlaceRegistro(datos)).toBe(`https://wa.me/526611034260?text=${encodeURIComponent(mensajeRegistro(datos))}`);
  });
});
