// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import VehiculosDisponiblesAlerta from './VehiculosDisponiblesAlerta';

afterEach(cleanup);

const v = { yonkeId: 'Y1', vehiculoAlertaId: 'honda_civic_2020', yonkeNombre: 'Yonke Uno', ciudad: 'Tijuana', whatsapp: '664 111 1111', verificado: true, vehiculo: { marca: 'Honda', modelo: 'Civic', ano: 2020 } };

describe('tarjetas "Vehículo disponible, pregunta por la pieza"', () => {
  it('sin lista no muestra nada', () => {
    const { container } = render(<VehiculosDisponiblesAlerta lista={[]} pieza="Alternador" />);
    expect(container).toBeEmptyDOMElement();
  });

  it('muestra el yonke, el vehículo, el texto que no promete la pieza y un WhatsApp con la pregunta', () => {
    render(<VehiculosDisponiblesAlerta lista={[v]} pieza="Alternador" />);
    expect(screen.getByText(/Yonke Uno/)).toBeInTheDocument();
    expect(screen.getByText(/Honda Civic 2020/)).toBeInTheDocument();
    expect(screen.getByText(/Vehículo disponible, pregunta por la pieza/)).toBeInTheDocument();
    const enlace = screen.getByRole('link', { name: /Preguntar por WhatsApp/ });
    expect(enlace).toHaveAttribute('href', expect.stringContaining('https://wa.me/526641111111?text='));
    expect(decodeURIComponent(enlace.getAttribute('href'))).toContain('Honda Civic 2020 completo. ¿Tienen disponible: Alternador?');
  });
});
