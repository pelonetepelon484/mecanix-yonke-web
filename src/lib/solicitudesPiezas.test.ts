import { describe, expect, it } from 'vitest';
import { calcularExpiraAtSolicitud, DIAS_VIGENCIA_SOLICITUD, MENSAJES_RESPUESTA, MENSAJES_SOLICITUD, validarRespuesta, validarSolicitud } from './solicitudesPiezas';

const vehiculo = { marca: 'Nissan', modelo: 'Sentra', anio: 2001 };

describe('validarSolicitud', () => {
  it('acepta un pedido completo', () => {
    expect(validarSolicitud({ vehiculo, pieza: 'Defensa delantera', nota: '' })).toBeNull();
  });
  it('rechaza sin marca o sin modelo', () => {
    expect(validarSolicitud({ vehiculo: { ...vehiculo, marca: '' }, pieza: 'x', nota: '' })).toBe(MENSAJES_SOLICITUD.vehiculo);
    expect(validarSolicitud({ vehiculo: { ...vehiculo, modelo: '  ' }, pieza: 'x', nota: '' })).toBe(MENSAJES_SOLICITUD.vehiculo);
  });
  it('rechaza año fuera de rango o no entero', () => {
    expect(validarSolicitud({ vehiculo: { ...vehiculo, anio: 1800 }, pieza: 'x', nota: '' })).toBe(MENSAJES_SOLICITUD.anio);
    expect(validarSolicitud({ vehiculo: { ...vehiculo, anio: 2001.5 }, pieza: 'x', nota: '' })).toBe(MENSAJES_SOLICITUD.anio);
  });
  it('rechaza pieza vacía o muy larga', () => {
    expect(validarSolicitud({ vehiculo, pieza: '', nota: '' })).toBe(MENSAJES_SOLICITUD.pieza);
    expect(validarSolicitud({ vehiculo, pieza: 'a'.repeat(101), nota: '' })).toBe(MENSAJES_SOLICITUD.pieza);
  });
  it('rechaza nota de más de 200 caracteres', () => {
    expect(validarSolicitud({ vehiculo, pieza: 'x', nota: 'a'.repeat(201) })).toBe(MENSAJES_SOLICITUD.nota);
  });
  it('acepta nota de exactamente 200 caracteres', () => {
    expect(validarSolicitud({ vehiculo, pieza: 'x', nota: 'a'.repeat(200) })).toBeNull();
  });
});

describe('validarRespuesta', () => {
  it('"la tengo" exige precio mayor a 0 y hasta el tope', () => {
    expect(validarRespuesta({ tieneLaPieza: true, precio: 0, nota: '' })).toBe(MENSAJES_RESPUESTA.precio);
    expect(validarRespuesta({ tieneLaPieza: true, precio: -5, nota: '' })).toBe(MENSAJES_RESPUESTA.precio);
    expect(validarRespuesta({ tieneLaPieza: true, precio: 1000001, nota: '' })).toBe(MENSAJES_RESPUESTA.precio);
    expect(validarRespuesta({ tieneLaPieza: true, precio: 500, nota: '' })).toBeNull();
  });
  it('"no la tengo" no exige precio', () => {
    expect(validarRespuesta({ tieneLaPieza: false, precio: Number.NaN, nota: '' })).toBeNull();
  });
  it('rechaza nota de más de 200 caracteres en cualquier caso', () => {
    expect(validarRespuesta({ tieneLaPieza: false, precio: Number.NaN, nota: 'a'.repeat(201) })).toBe(MENSAJES_RESPUESTA.nota);
  });
});

describe('calcularExpiraAtSolicitud', () => {
  it('vence a los 5 días exactos', () => {
    expect(DIAS_VIGENCIA_SOLICITUD).toBe(5);
    const desde = new Date('2026-10-07T12:00:00Z');
    const esperado = new Date('2026-10-12T12:00:00Z');
    expect(calcularExpiraAtSolicitud(desde).getTime()).toBe(esperado.getTime());
  });
});
