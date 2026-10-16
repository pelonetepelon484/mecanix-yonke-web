// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

let avisar = null;
const onAuthStateChanged = vi.fn((auth, cb) => { avisar = cb; return () => {}; });
vi.mock('firebase/auth', () => ({ onAuthStateChanged: (...a) => onAuthStateChanged(...a) }));
vi.mock('./lib/firebase', () => ({ auth: {} }));

const { default: PestanasPortada, TEXTO_IR_A_MI_PANEL } = await import('./PestanasPortada.js');
const props = { pestanaActiva: 'cliente', setPestanaActiva: () => {}, conTalleres: true };

afterEach(() => { cleanup(); avisar = null; vi.clearAllMocks(); });

describe('pestañas de la portada', () => {
  it('bandera apagada: las de siempre y sin consultar la sesión', () => {
    render(<PestanasPortada {...props} botonPanel={false} />);
    expect(screen.getByRole('button', { name: '🏪 ¿Tienes un yonke?' })).toBeVisible();
    expect(screen.getByRole('button', { name: '🔧 ¿Tienes un taller?' })).toBeVisible();
    expect(onAuthStateChanged).not.toHaveBeenCalled();
  });

  it('encendida, mientras se recupera la sesión: los botones de negocio ocupan lugar sin verse (sin parpadeo)', () => {
    render(<PestanasPortada {...props} botonPanel />);
    expect(screen.getByText('🏪 ¿Tienes un yonke?')).toHaveStyle({ visibility: 'hidden' });
    expect(screen.queryByText(TEXTO_IR_A_MI_PANEL)).not.toBeInTheDocument();
  });

  it('encendida y visitante: "¿Tienes un yonke?" y "¿Tienes un taller?"', () => {
    render(<PestanasPortada {...props} botonPanel />);
    act(() => avisar(null));
    expect(screen.getByRole('button', { name: '🏪 ¿Tienes un yonke?' })).toBeVisible();
    expect(screen.queryByText(TEXTO_IR_A_MI_PANEL)).not.toBeInTheDocument();
  });

  it('encendida y con sesión: "Ir a mi panel" a /panel en lugar de los de negocio', () => {
    render(<PestanasPortada {...props} botonPanel />);
    act(() => avisar({ uid: 'u1' }));
    expect(screen.getByRole('link', { name: TEXTO_IR_A_MI_PANEL })).toHaveAttribute('href', '/panel');
    expect(screen.queryByText('🏪 ¿Tienes un yonke?')).not.toBeInTheDocument();
    expect(screen.queryByText('🔧 ¿Tienes un taller?')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '🔍 Busco una pieza' })).toBeVisible();
  });
});
