// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { TarjetaPremiumYonke, TarjetasPlanesTaller } from './TarjetasPlanes';
import { FUNCIONES_PLAN_PREMIUM, FUNCIONES_TALLER_BASICO, FUNCIONES_TALLER_PREMIUM, URL_QUIERO_PREMIUM, URL_QUIERO_PREMIUM_TALLER } from '../lib/planes';

afterEach(cleanup);

describe('tarjeta "Plan Premium" de yonkes', () => {
  it('nombre, precio, todas las funciones y el WhatsApp de siempre', () => {
    render(<TarjetaPremiumYonke />);
    expect(screen.getByText('Plan Premium')).toBeInTheDocument();
    expect(screen.getByText('$398.00 MXN al mes más IVA')).toBeInTheDocument();
    for (const f of FUNCIONES_PLAN_PREMIUM) expect(screen.getByText(f)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Quiero Premium' })).toHaveAttribute('href', URL_QUIERO_PREMIUM);
  });
});

describe('tarjetas de planes de talleres', () => {
  it('Básico sin costo con registro y Premium con su precio y su propio WhatsApp', () => {
    render(<TarjetasPlanesTaller />);
    expect(screen.getByText('Planes para tu taller')).toBeInTheDocument();
    expect(screen.getByText('Plan Básico')).toBeInTheDocument();
    expect(screen.getByText('Sin costo')).toBeInTheDocument();
    for (const f of FUNCIONES_TALLER_BASICO) expect(screen.getByText(f)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Registra tu taller gratis' })).toHaveAttribute('href', '/panel/taller/registro');
    expect(screen.getByText('$398.00 MXN al mes más IVA')).toBeInTheDocument();
    for (const f of FUNCIONES_TALLER_PREMIUM.slice(1)) expect(screen.getByText(f)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Quiero Premium' })).toHaveAttribute('href', URL_QUIERO_PREMIUM_TALLER);
  });
});
