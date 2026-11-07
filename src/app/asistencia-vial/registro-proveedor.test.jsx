// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import RegistroProveedor from './RegistroProveedor';
import EcosistemaMecanix from '../EcosistemaMecanix';
import { MENSAJES_REGISTRO, TEXTO_BOTON_REGISTRO, TEXTO_PERMISO } from '../../lib/registroAsistencia';

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

const BOTON = `🚛 ${TEXTO_BOTON_REGISTRO}`;

function llenar() {
  fireEvent.change(screen.getByLabelText('Nombre del negocio'), { target: { value: 'Grúas El Güero' } });
  fireEvent.click(screen.getByLabelText('Grúa'));
  fireEvent.click(screen.getByLabelText('Tijuana'));
  fireEvent.change(screen.getByLabelText('Teléfono (10 dígitos)'), { target: { value: '664 123 4567' } });
  fireEvent.click(screen.getByLabelText('Atiendo 24 horas'));
}

describe('botón Regístrate (proveedores de asistencia vial)', () => {
  it('cerrado: solo el botón; al tocarlo, el formulario', () => {
    render(<RegistroProveedor />);
    expect(screen.queryByLabelText('Nombre del negocio')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: BOTON }));
    expect(screen.getByLabelText('Nombre del negocio')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '661 103 4260' })).toHaveAttribute('href', 'tel:+526611034260');
  });

  it('sin el permiso no abre WhatsApp y dice por qué', () => {
    const abrir = vi.spyOn(window, 'open').mockImplementation(() => null);
    render(<RegistroProveedor />);
    fireEvent.click(screen.getByRole('button', { name: BOTON }));
    llenar();
    fireEvent.click(screen.getByRole('button', { name: '💬 Enviar por WhatsApp' }));
    expect(screen.getByRole('alert')).toHaveTextContent(MENSAJES_REGISTRO.permiso);
    expect(abrir).not.toHaveBeenCalled();
  });

  it('completo: abre WhatsApp a Red Mecanix con el mensaje y no guarda nada', () => {
    const abrir = vi.spyOn(window, 'open').mockImplementation(() => null);
    const red = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response('{}'));
    render(<RegistroProveedor />);
    fireEvent.click(screen.getByRole('button', { name: BOTON }));
    llenar();
    expect(screen.queryByLabelText('Horario')).not.toBeInTheDocument();
    fireEvent.click(screen.getByLabelText(TEXTO_PERMISO));
    fireEvent.click(screen.getByRole('button', { name: '💬 Enviar por WhatsApp' }));
    expect(abrir).toHaveBeenCalledTimes(1);
    const [url, destino] = abrir.mock.calls[0];
    expect(url).toMatch(/^https:\/\/wa\.me\/526611034260\?text=/);
    const texto = decodeURIComponent(url.split('?text=')[1]);
    expect(texto).toContain('Negocio: Grúas El Güero');
    expect(texto).toContain('Horario: 24 horas');
    expect(texto).toContain(TEXTO_PERMISO);
    expect(destino).toBe('_blank');
    expect(screen.getByRole('status')).toHaveTextContent('Se abrió WhatsApp');
    expect(red).not.toHaveBeenCalled();
  });
});

describe('en la tarjeta de la portada', () => {
  it('sin la bandera no aparece; con la bandera, solo si se ve la tarjeta de asistencia vial', () => {
    const { rerender } = render(<EcosistemaMecanix asistenciaVial="proximamente" />);
    expect(screen.queryByRole('button', { name: BOTON })).not.toBeInTheDocument();
    rerender(<EcosistemaMecanix asistenciaVial="proximamente" registro />);
    expect(screen.getByRole('button', { name: BOTON })).toBeInTheDocument();
    rerender(<EcosistemaMecanix asistenciaVial={null} registro />);
    expect(screen.queryByRole('button', { name: BOTON })).not.toBeInTheDocument();
  });
});
