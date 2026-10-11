// @vitest-environment jsdom
import { describe, expect, it, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

vi.mock('./cotizaciones/datos', () => ({ aceptarVersion: vi.fn() }));
const { default: AvisoVersion } = await import('./AvisoVersion.js');

afterEach(() => cleanup());

describe('aviso de reaceptación: cotizaciones y órdenes', () => {
  it('taller activo: dice "cotizaciones y órdenes" y que puede quitar datos o eliminarlas', () => {
    render(<AvisoVersion tallerId="T1" versionVigente={{ version: 'v2' }} resumen="x" onAceptada={() => {}} tallerActivo />);
    expect(screen.getByText('Mientras no aceptes la versión nueva, tus cotizaciones y órdenes se ven en solo lectura: no puedes crear ni editar. Puedes quitar los datos de tus clientes o eliminarlas.')).toBeInTheDocument();
  });
  it('taller desactivado: "cotizaciones y órdenes", sin ofrecer quitar ni eliminar', () => {
    render(<AvisoVersion tallerId="T1" versionVigente={{ version: 'v2' }} resumen="x" onAceptada={() => {}} tallerActivo={false} />);
    expect(screen.getByText('Mientras no aceptes la versión nueva, tus cotizaciones y órdenes se ven en solo lectura: no puedes crear ni editar.')).toBeInTheDocument();
  });
});
