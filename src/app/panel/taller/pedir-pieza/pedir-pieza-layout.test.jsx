// @vitest-environment jsdom
import { describe, expect, it, vi, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

const replace = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace }) }));
vi.mock('../../AuthContext', () => ({ useAuth: () => ({ tallerId: 'T1' }) }));
vi.mock('../cotizaciones/datos', () => ({ leerTaller: vi.fn(async () => ({ nombre: 'Taller Uno', whatsapp: '6641110000', activo: true })) }));
const leerConfigSolicitudesPiezas = vi.fn(async () => null);
vi.mock('../../solicitudesPiezasDatos', () => ({ leerConfigSolicitudesPiezas: (...args) => leerConfigSolicitudesPiezas(...args) }));

let banderaGeneral = true;
vi.mock('../../../../lib/talleresHabilitados', () => ({ talleresHabilitados: () => banderaGeneral }));

const { default: PedirPiezaLayout } = await import('./layout.js');
const { usePedirPieza } = await import('./contexto.js');

function Hijo() {
  const { tallerId, taller } = usePedirPieza() || {};
  return <p>contexto: {tallerId} / {taller?.nombre}</p>;
}

afterEach(() => { cleanup(); replace.mockClear(); banderaGeneral = true; leerConfigSolicitudesPiezas.mockReset(); leerConfigSolicitudesPiezas.mockResolvedValue(null); });

describe('Layout de "pedir una pieza": apaga toda la función sin config/solicitudesPiezas', () => {
  it('con la bandera general apagada, manda de vuelta a /panel/taller sin mostrar nada', async () => {
    banderaGeneral = false;
    render(<PedirPiezaLayout><Hijo /></PedirPiezaLayout>);
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/panel/taller'));
    expect(screen.queryByText(/contexto:/)).not.toBeInTheDocument();
  });

  it('sin config/solicitudesPiezas, manda de vuelta a /panel/taller', async () => {
    leerConfigSolicitudesPiezas.mockResolvedValue(null);
    render(<PedirPiezaLayout><Hijo /></PedirPiezaLayout>);
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/panel/taller'));
    expect(screen.queryByText(/contexto:/)).not.toBeInTheDocument();
  });

  it('con habilitado=false, también manda de vuelta', async () => {
    leerConfigSolicitudesPiezas.mockResolvedValue({ habilitado: false });
    render(<PedirPiezaLayout><Hijo /></PedirPiezaLayout>);
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/panel/taller'));
  });

  it('con habilitado=true, muestra a los hijos con el taller en el contexto', async () => {
    leerConfigSolicitudesPiezas.mockResolvedValue({ habilitado: true });
    render(<PedirPiezaLayout><Hijo /></PedirPiezaLayout>);
    expect(await screen.findByText('contexto: T1 / Taller Uno')).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });
});
