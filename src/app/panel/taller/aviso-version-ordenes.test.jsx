// @vitest-environment jsdom
import { describe, expect, it, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

const aceptarVersion = vi.fn(async () => {});
vi.mock('./cotizaciones/datos', () => ({ aceptarVersion: (...a) => aceptarVersion(...a) }));
const { default: AvisoVersion, esAceptacionEscrita } = await import('./AvisoVersion.js');

const TEXTO = 'Mientras no aceptes, solo puedes visualizar, reimprimir y descargar tus documentos anteriores.';
const aviso = (props = {}) => render(<AvisoVersion tallerId="T1" versionVigente={{ version: 'v2' }} resumen="x" onAceptada={props.onAceptada ?? (() => {})} tallerActivo={props.tallerActivo ?? true} />);
const boton = () => screen.getByRole('button', { name: 'Acepto la versión nueva' });
const campo = () => screen.getByLabelText('Para aceptar, escribe la palabra ACEPTO');

beforeEach(() => aceptarVersion.mockClear());
afterEach(() => cleanup());

describe('aviso de reaceptación', () => {
  it('activo o desactivado: solo visualizar, reimprimir y descargar (sin ofrecer quitar ni eliminar)', () => {
    aviso({ tallerActivo: true });
    expect(screen.getByText(TEXTO)).toBeInTheDocument();
    expect(screen.queryByText(/quitar|eliminar/i)).not.toBeInTheDocument();
    cleanup();
    aviso({ tallerActivo: false });
    expect(screen.getByText(TEXTO)).toBeInTheDocument();
  });
});

describe('aceptación escrita: hay que escribir ACEPTO', () => {
  it('sin escribir nada, el botón está desactivado y un clic no acepta', () => {
    aviso();
    expect(boton()).toBeDisabled();
    fireEvent.click(boton());
    expect(aceptarVersion).not.toHaveBeenCalled();
  });
  it('cualquier otra cosa deja el botón desactivado', () => {
    aviso();
    for (const t of ['ACEPT', 'ACEPTO.', 'A CEPTO', 'acepto ya', 'sí', 'ACEPTÓ', 'ACEPTO ACEPTO']) {
      fireEvent.change(campo(), { target: { value: t } });
      expect(boton()).toBeDisabled();
    }
  });
  it('ACEPTO en mayúsculas o minúsculas, con espacios al inicio o al final, activa el botón y registra la aceptación', async () => {
    const onAceptada = vi.fn();
    aviso({ onAceptada });
    fireEvent.change(campo(), { target: { value: '  acepto ' } });
    expect(boton()).toBeEnabled();
    fireEvent.click(boton());
    await waitFor(() => expect(aceptarVersion).toHaveBeenCalledWith('T1', 'v2'));
    await waitFor(() => expect(onAceptada).toHaveBeenCalled());
  });
  it('la regla de la palabra', () => {
    for (const t of ['ACEPTO', 'acepto', 'Acepto', '  ACEPTO  ', '\tacepto\n']) expect(esAceptacionEscrita(t)).toBe(true);
    for (const t of ['', 'acept', 'aceptó', 'no acepto', null, undefined]) expect(esAceptacionEscrita(t)).toBe(false);
  });
});
