// @vitest-environment jsdom
import { describe, expect, it, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

vi.mock('./cotizaciones/datos', () => ({ aceptarVersion: vi.fn(async () => {}) }));

const { default: AvisoVersion } = await import('./AvisoVersion.js');

afterEach(() => cleanup());

describe('aviso de cambios de términos', () => {
  it('enlaza a la sección de talleres de /terminos', () => {
    render(<AvisoVersion tallerId="T1" versionVigente={{ version: 'talleres-2026-10-1' }} resumen="x" onAceptada={() => {}} />);
    expect(screen.getByRole('link', { name: 'Leer el texto completo' })).toHaveAttribute('href', 'https://mecanixyonkevirtual.com/terminos#talleres');
  });
  // Decisión del abogado: sin términos vigentes solo se ve, reimprime y descarga (ya no "quitar datos").
  it('taller activo: solo visualizar, reimprimir y descargar; ya NO ofrece quitar datos', () => {
    render(<AvisoVersion tallerId="T1" versionVigente={{ version: 'talleres-2026-10-1' }} resumen="x" onAceptada={() => {}} tallerActivo />);
    expect(screen.getByText('Mientras no aceptes, solo puedes visualizar, reimprimir y descargar tus documentos anteriores.')).toBeInTheDocument();
    expect(screen.queryByText(/quitar los datos/)).not.toBeInTheDocument();
  });
  it('taller desactivado: NO menciona quitar datos', () => {
    render(<AvisoVersion tallerId="T1" versionVigente={{ version: 'talleres-2026-10-1' }} resumen="x" onAceptada={() => {}} tallerActivo={false} />);
    expect(screen.queryByText(/quitar los datos/)).not.toBeInTheDocument();
  });
});
