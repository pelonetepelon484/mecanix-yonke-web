// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

let config = null;
vi.mock('firebase/firestore', () => ({
  doc: (...a) => a.join('/'),
  getDoc: async () => ({ exists: () => config !== null, data: () => config }),
}));
vi.mock('./lib/firebase', () => ({ db: 'db' }));

// La bandera se cachea por módulo: cada prueba importa el componente de nuevo.
async function cargar() {
  vi.resetModules();
  return (await import('./ComoFuncionaBuscador.js')).default;
}
afterEach(() => { cleanup(); config = null; });

describe('¿Cómo funciona el buscador de Mecanix?', () => {
  it('muestra el título, los 3 pasos y las dos ramas', async () => {
    const ComoFunciona = await cargar();
    render(<ComoFunciona />);
    expect(screen.getByRole('heading', { name: '¿CÓMO FUNCIONA EL BUSCADOR DE MECANIX?' })).toBeInTheDocument();
    for (const t of ['1. Escribe lo que buscas', '2. Elige tu estado (o todos)', '3. Buscamos en los yonkes de la red',
      '¿La encontramos?', 'Ves qué yonke la tiene', 'WhatsApp o reserva', 'Confirma antes de pagar', 'Busca en otros estados']) {
      expect(screen.getByText(t)).toBeInTheDocument();
    }
  });

  it('"Deja una alerta" solo con config/pedidosClientes.habilitado', async () => {
    config = { habilitado: false };
    let ComoFunciona = await cargar();
    render(<ComoFunciona />);
    await screen.findByText('Busca en otros estados');
    await new Promise((r) => setTimeout(r, 0));
    expect(screen.queryByText('Publica tu búsqueda')).not.toBeInTheDocument();
    cleanup();

    config = { habilitado: true };
    ComoFunciona = await cargar();
    render(<ComoFunciona />);
    expect(await screen.findByText('Publica tu búsqueda')).toBeInTheDocument();
  });
});
