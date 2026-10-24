// @vitest-environment jsdom
import { describe, expect, it, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import CreditoMecanix, { esColorOscuro } from './CreditoMecanix';

afterEach(cleanup);

describe('crédito "Con tecnología" del pie de los subdominios', () => {
  it('fondo claro: el logo nuevo directo, como siempre (sin pastilla)', () => {
    render(<CreditoMecanix colorFondo="#F0F2F5" />);
    const logo = screen.getByRole('img', { name: 'Mecanix' });
    expect(logo).toHaveAttribute('src', '/logo-mecanix-solo.webp');
    expect(logo).toHaveStyle({ height: '17px' });
    expect(screen.queryByTestId('pastilla-mecanix')).not.toBeInTheDocument();
    expect(screen.getByRole('link')).toHaveAttribute('href', 'https://mecanixyonkevirtual.com');
    expect(screen.getByRole('link')).toHaveTextContent('Con tecnología');
  });
  it('fondo oscuro: el MISMO logo nuevo, dentro de una pastilla blanca chica (nunca el logo blanco viejo)', () => {
    render(<CreditoMecanix colorFondo="#101820" />);
    const pastilla = screen.getByTestId('pastilla-mecanix');
    expect(pastilla).toHaveStyle({ backgroundColor: '#FFFFFF' });
    const logo = screen.getByRole('img', { name: 'Mecanix' });
    expect(pastilla).toContainElement(logo);
    expect(logo).toHaveAttribute('src', '/logo-mecanix-solo.webp');
    expect(document.body.innerHTML).not.toContain('logo-mecanix-blanco');
  });
  it('sin color (o inválido) cuenta como claro, igual que antes', () => {
    expect(esColorOscuro(undefined)).toBe(false);
    expect(esColorOscuro('azul')).toBe(false);
    expect(esColorOscuro('#000')).toBe(true);
    expect(esColorOscuro('#FFFFFF')).toBe(false);
  });
});
