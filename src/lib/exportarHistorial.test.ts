import { describe, expect, it } from 'vitest';
import { COLUMNAS_HISTORIAL, celdaCsv, csvHistorial, fechaCsv, nombreCsvHistorial } from './exportarHistorial';

const ms = (v: unknown) => (typeof v === 'number' ? v : null);
const D = (y: number, m: number, d: number) => new Date(y, m - 1, d, 12).getTime();

describe('"Descargar mi historial" (CSV)', () => {
  const vehiculos = [
    {
      placas: 'XYZ9', marca: 'Toyota', modelo: 'Corolla', anio: 2020,
      servicios: [{ fecha: D(2026, 5, 1), descripcion: 'Afinación', piezas: [] }],
      recordatorios: [],
    },
    {
      placas: 'ABC123', marca: 'Nissan', modelo: 'Sentra', anio: 2001,
      telefono: '6641112233', cliente: { nombre: 'Juan' }, // aunque el documento trajera datos del cliente
      servicios: [
        { fecha: D(2026, 3, 10), kilometraje: 152000, descripcion: 'Cambio de aceite, filtro "original"', piezas: ['Filtro', 'Aceite 5W30'] },
        { fecha: D(2026, 1, 5), kilometraje: 150000, descripcion: '=SUMA(A1)', piezas: [] },
      ],
      recordatorios: [
        { tipo: 'Cambio de aceite', fecha: D(2026, 9, 10), estado: 'pendiente' },
        { tipo: 'Frenos', fecha: D(2026, 4, 1), estado: 'atendido' },
      ],
    },
  ];
  const csv = csvHistorial(vehiculos as never, ms);
  const renglones = csv.slice(1).split('\r\n');

  it('UTF-8 con BOM (Excel), encabezados y fin de renglón \\r\\n', () => {
    expect(csv.charCodeAt(0)).toBe(0xFEFF);
    expect(renglones[0]).toBe(COLUMNAS_HISTORIAL.join(','));
    expect(csv.endsWith('\r\n')).toBe(true);
  });
  it('un renglón por servicio (por placas y fecha) y solo los recordatorios pendientes', () => {
    expect(renglones.slice(1, -1)).toEqual([
      "ABC123,Nissan,Sentra,2001,Servicio,05/01/2026,150000,'=SUMA(A1),,,,",
      'ABC123,Nissan,Sentra,2001,Servicio,10/03/2026,152000,"Cambio de aceite, filtro ""original""",Filtro; Aceite 5W30,,,',
      'ABC123,Nissan,Sentra,2001,Recordatorio,,,,,Cambio de aceite,10/09/2026,pendiente',
      'XYZ9,Toyota,Corolla,2020,Servicio,01/05/2026,,Afinación,,,,',
    ]);
  });
  it('NUNCA datos del cliente ni teléfono', () => {
    expect(csv).not.toContain('6641112233');
    expect(csv).not.toContain('Juan');
  });
  it('celdas: comillas, comas, saltos de línea y protección contra fórmulas', () => {
    expect(celdaCsv('a,b')).toBe('"a,b"');
    expect(celdaCsv('dijo "hola"')).toBe('"dijo ""hola"""');
    expect(celdaCsv('línea\nnueva')).toBe('"línea\nnueva"');
    expect(celdaCsv('+52 664')).toBe("'+52 664");
    expect(celdaCsv('-cambio')).toBe("'-cambio");
    expect(celdaCsv('@x')).toBe("'@x");
    expect(celdaCsv(null)).toBe('');
  });
  it('fechas en dd/mm/aaaa y nombre del archivo con la fecha', () => {
    expect(fechaCsv(D(2026, 10, 21))).toBe('21/10/2026');
    expect(fechaCsv(null)).toBe('');
    expect(nombreCsvHistorial(new Date(2026, 9, 21))).toBe('historial-2026-10-21.csv');
  });
  it('sin vehículos: solo encabezados', () => {
    expect(csvHistorial([], ms)).toBe('﻿' + COLUMNAS_HISTORIAL.join(',') + '\r\n');
  });
});
