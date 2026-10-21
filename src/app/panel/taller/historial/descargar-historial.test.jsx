// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

vi.mock('./datos', () => ({ listarTodosLosVehiculos: vi.fn(), guardarCsv: vi.fn(), msOVacio: (v) => (typeof v === 'number' ? v : null) }));
const { default: DescargarHistorial } = await import('./DescargarHistorial.js');
afterEach(cleanup);

const vehiculo = { placas: 'ABC123', marca: 'Nissan', modelo: 'Sentra', anio: 2001, servicios: [{ fecha: 0, descripcion: 'Aceite', piezas: [] }], recordatorios: [] };

describe('botón "Descargar mi historial"', () => {
  it('descarga el CSV con el nombre de hoy y dice cuántos vehículos', async () => {
    const listar = vi.fn(async () => [vehiculo]);
    const guardar = vi.fn();
    render(<DescargarHistorial tallerId="T1" fuentes={{ listar, guardar }} />);
    fireEvent.click(screen.getByRole('button', { name: '⬇️ Descargar mi historial' }));
    await act(async () => {});
    expect(listar).toHaveBeenCalledWith('T1');
    const [texto, nombre] = guardar.mock.calls[0];
    expect(texto.startsWith('﻿Placas,Marca')).toBe(true);
    expect(texto).toContain('ABC123,Nissan,Sentra,2001,Servicio');
    expect(nombre).toMatch(/^historial-\d{4}-\d{2}-\d{2}\.csv$/);
    expect(screen.getByRole('status')).toHaveTextContent('1 vehículo(s)');
  });
  it('sin vehículos: lo dice y no descarga', async () => {
    const guardar = vi.fn();
    render(<DescargarHistorial tallerId="T1" fuentes={{ listar: async () => [], guardar }} />);
    fireEvent.click(screen.getByRole('button', { name: '⬇️ Descargar mi historial' }));
    await act(async () => {});
    expect(guardar).not.toHaveBeenCalled();
    expect(screen.getByRole('status')).toHaveTextContent('Todavía no tienes vehículos');
  });
  it('si falla la lectura: mensaje en español', async () => {
    render(<DescargarHistorial tallerId="T1" fuentes={{ listar: async () => { throw new Error('x'); }, guardar: vi.fn() }} />);
    fireEvent.click(screen.getByRole('button', { name: '⬇️ Descargar mi historial' }));
    await act(async () => {});
    expect(screen.getByRole('status')).toHaveTextContent('No pudimos preparar tu historial');
  });
});
