// @vitest-environment jsdom
// AuthContext: soloBasico = yonke dueño, config/planes.limitesActivos === true y sin Premium vigente.
import { describe, expect, it, vi, afterEach } from 'vitest';
import { render, screen, cleanup, act } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

let usuarioActual = null;
vi.mock('firebase/auth', () => ({ onAuthStateChanged: (_auth, cb) => { cb(usuarioActual); return () => {}; } }));
vi.mock('../lib/firebase', () => ({ auth: {}, db: {} }));
vi.mock('../../lib/registrarActividadYonke', () => ({ registrarActividadYonke: vi.fn() }));

let docs = {};
const lecturas = [];
vi.mock('firebase/firestore', () => ({
  doc: (_db, ...ruta) => ruta.join('/'),
  getDoc: async (ruta) => {
    lecturas.push(ruta);
    return ruta in docs ? { exists: () => true, data: () => docs[ruta] } : { exists: () => false };
  },
}));

const { AuthProvider, useAuth } = await import('./AuthContext');

function Mostrar() {
  const { loading, soloBasico, limitesActivos, premiumVigente } = useAuth();
  if (loading) return null;
  return <p>{`basico=${soloBasico} limites=${limitesActivos} premium=${premiumVigente}`}</p>;
}
async function montar(yonke, planes) {
  usuarioActual = { uid: 'o1' };
  docs = { 'usuarios/o1': { rol: 'yonke', yonkeId: 'Y1' }, 'yonkes/Y1': yonke };
  if (planes) docs['config/planes'] = planes;
  await act(async () => { render(<AuthProvider><Mostrar /></AuthProvider>); });
}
const DIA = 86400000;

afterEach(() => { cleanup(); docs = {}; lecturas.length = 0; });

describe('AuthContext: límites del plan', () => {
  it('interruptor apagado (sin documento): nadie es "solo Básico"', async () => {
    await montar({ plan: 'freemium' });
    expect(screen.getByText('basico=false limites=false premium=false')).toBeInTheDocument();
  });
  it('limitesActivos false o "true" (texto): apagado', async () => {
    await montar({ plan: 'freemium' }, { limitesActivos: 'true' });
    expect(screen.getByText(/^basico=false limites=false/)).toBeInTheDocument();
  });
  it('encendido + freemium: solo Básico', async () => {
    await montar({ plan: 'freemium' }, { limitesActivos: true });
    expect(screen.getByText('basico=true limites=true premium=false')).toBeInTheDocument();
  });
  it('encendido + Premium sin fecha o con fecha futura: Premium vigente', async () => {
    await montar({ plan: 'premium' }, { limitesActivos: true });
    expect(screen.getByText('basico=false limites=true premium=true')).toBeInTheDocument();
    cleanup();
    await montar({ plan: 'premium', premiumHasta: new Date(Date.now() + 30 * DIA) }, { limitesActivos: true });
    expect(screen.getByText('basico=false limites=true premium=true')).toBeInTheDocument();
  });
  it('encendido + Premium vencido: solo Básico', async () => {
    await montar({ plan: 'premium', premiumHasta: new Date(Date.now() - DIA) }, { limitesActivos: true });
    expect(screen.getByText('basico=true limites=true premium=false')).toBeInTheDocument();
  });
  it('el admin no lee config/planes ni queda limitado', async () => {
    usuarioActual = { uid: 'adm' };
    docs = { 'usuarios/adm': { rol: 'admin' }, 'config/planes': { limitesActivos: true } };
    await act(async () => { render(<AuthProvider><Mostrar /></AuthProvider>); });
    expect(screen.getByText(/^basico=false/)).toBeInTheDocument();
    expect(lecturas).not.toContain('config/planes');
  });
});
