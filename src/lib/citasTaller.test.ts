import { describe, expect, it } from 'vitest';
import {
  MENSAJES_CITA, enlaceRecordatorioCita, expiraCita, fechaDeInputs, inputsDeFecha, mensajeRecordatorioCita, separarHoy, textoDia, textoHora,
  validarCita, ordenDesdeCita,
} from './citasTaller';

const AHORA = new Date(2026, 10, 6, 12, 0).getTime(); // viernes 6 de noviembre de 2026, 12:00
const base = { fecha: '2026-11-10', hora: '09:30', nombre: '  Juan   Pérez ', telefono: '(664) 123-4567', vehiculo: 'Nissan Versa 2018', placas: 'abc 123', motivo: 'Afinación' };

describe('fechaDeInputs / inputsDeFecha', () => {
  it('arma la fecha local y la regresa igual', () => {
    const f = fechaDeInputs('2026-11-10', '09:30');
    expect(f).toEqual(new Date(2026, 10, 10, 9, 30));
    expect(inputsDeFecha(f as Date)).toEqual({ fecha: '2026-11-10', hora: '09:30' });
  });
  it('rechaza fechas que no existen o mal escritas', () => {
    for (const [d, h] of [['2026-02-30', '09:00'], ['2026-11-10', '24:00'], ['10/11/2026', '09:00'], ['', ''], [undefined, '09:00']]) {
      expect(fechaDeInputs(d, h)).toBeNull();
    }
  });
});

describe('validarCita', () => {
  it('limpia y normaliza lo escrito', () => {
    const r = validarCita(base, AHORA);
    expect(r).toEqual({ ok: true, datos: { fecha: new Date(2026, 10, 10, 9, 30), nombre: 'Juan Pérez', telefono: '6641234567', vehiculo: 'Nissan Versa 2018', placas: 'ABC123', motivo: 'Afinación', estado: 'pendiente' } });
  });
  it('solo el nombre y la fecha son obligatorios', () => {
    const r = validarCita({ fecha: '2026-11-10', hora: '09:30', nombre: 'Ana' }, AHORA);
    expect(r.ok && r.datos).toMatchObject({ telefono: '', vehiculo: '', placas: '', motivo: '', estado: 'pendiente' });
  });
  it('errores en español', () => {
    expect(validarCita({ ...base, hora: '' }, AHORA)).toEqual({ ok: false, mensaje: MENSAJES_CITA.fecha });
    expect(validarCita({ ...base, fecha: '2026-10-01' }, AHORA)).toEqual({ ok: false, mensaje: MENSAJES_CITA.fechaPasada });
    expect(validarCita({ ...base, fecha: '2027-12-01' }, AHORA)).toEqual({ ok: false, mensaje: MENSAJES_CITA.fechaLejana });
    expect(validarCita({ ...base, nombre: ' ' }, AHORA)).toEqual({ ok: false, mensaje: MENSAJES_CITA.nombre });
    expect(validarCita({ ...base, telefono: '123' }, AHORA)).toEqual({ ok: false, mensaje: MENSAJES_CITA.telefono });
    expect(validarCita({ ...base, placas: 'ABC_123' }, AHORA)).toEqual({ ok: false, mensaje: MENSAJES_CITA.placas });
    expect(validarCita({ ...base, motivo: 'x'.repeat(201) }, AHORA)).toEqual({ ok: false, mensaje: MENSAJES_CITA.motivo });
    expect(validarCita({ ...base, vehiculo: 'x'.repeat(101) }, AHORA)).toEqual({ ok: false, mensaje: MENSAJES_CITA.vehiculo });
    expect(validarCita({ ...base, estado: 'perdida' }, AHORA)).toEqual({ ok: false, mensaje: MENSAJES_CITA.estado });
  });
  it('acepta una cita pasada reciente (para marcarla atendida)', () => {
    expect(validarCita({ ...base, fecha: '2026-11-01', estado: 'atendida' }, AHORA).ok).toBe(true);
  });
});

describe('fechas y textos', () => {
  it('se borra 30 días después de la cita', () => {
    const f = new Date(2026, 10, 10, 9, 30);
    expect(expiraCita(f).getTime() - f.getTime()).toBe(30 * 86400000);
  });
  it('día y hora en español, sin depender del navegador', () => {
    expect(textoDia(new Date(2026, 10, 10, 9, 30))).toBe('martes 10 de noviembre');
    expect(textoHora(new Date(2026, 10, 10, 9, 5))).toBe('9:05 a. m.');
    expect(textoHora(new Date(2026, 10, 10, 0, 0))).toBe('12:00 a. m.');
    expect(textoHora(new Date(2026, 10, 10, 12, 0))).toBe('12:00 p. m.');
    expect(textoHora(new Date(2026, 10, 10, 16, 30))).toBe('4:30 p. m.');
  });
  it('mensaje de recordatorio y enlace de WhatsApp', () => {
    const f = new Date(2026, 10, 10, 9, 30);
    expect(mensajeRecordatorioCita('Taller Ruiz', 'Juan Pérez', f)).toBe('Hola Juan, le recordamos su cita en Taller Ruiz el martes 10 de noviembre a las 9:30 a. m.');
    const enlace = enlaceRecordatorioCita('6641234567', 'Taller Ruiz', 'Juan', f) as string;
    expect(enlace).toContain('6641234567');
    expect(decodeURIComponent(enlace)).toContain('le recordamos su cita');
    expect(enlaceRecordatorioCita('', 'Taller Ruiz', 'Juan', f)).toBeNull();
    expect(enlaceRecordatorioCita('6641234567', 'Taller Ruiz', 'Juan', null)).toBeNull();
  });
  it('separa las de hoy de las próximas', () => {
    const ahora = new Date(2026, 10, 6, 12, 0);
    const citas = [
      { id: 'a', fecha: new Date(2026, 10, 6, 8, 0) },
      { id: 'b', fecha: { toDate: () => new Date(2026, 10, 6, 23, 59) } },
      { id: 'c', fecha: new Date(2026, 10, 7, 0, 0) },
    ];
    const r = separarHoy(citas, ahora);
    expect(r.hoy.map((c) => c.id)).toEqual(['a', 'b']);
    expect(r.proximas.map((c) => c.id)).toEqual(['c']);
  });
});

describe('ordenDesdeCita', () => {
  const cita = { nombre: 'Juan', telefono: '6641234567', vehiculo: 'Nissan Versa 2018', placas: 'ABC123', motivo: 'Ruido en frenos' };
  it('con datos del cliente', () => {
    expect(ordenDesdeCita(cita, true)).toEqual({
      cliente: { nombre: 'Juan', telefono: '6641234567' },
      vehiculo: { marca: 'Nissan', modelo: 'Versa', anio: 2018, placas: 'ABC123' },
      fallaReportada: 'Ruido en frenos',
    });
  });
  it('sin datos del cliente: solo vehículo y falla', () => {
    expect(ordenDesdeCita(cita, false)).toEqual({ cliente: {}, vehiculo: { marca: 'Nissan', modelo: 'Versa', anio: 2018 }, fallaReportada: 'Ruido en frenos' });
    expect(ordenDesdeCita({ nombre: 'Ana', vehiculo: 'Tsuru' }, false).vehiculo).toEqual({ marca: '', modelo: '' });
  });
});
