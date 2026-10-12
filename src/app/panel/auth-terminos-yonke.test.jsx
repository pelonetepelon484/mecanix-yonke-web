// @vitest-environment jsdom
// AuthContext: con config/terminosYonkes, el dueño de un yonke sin la versión vigente queda en
// solo lectura (puedeEditarYonke = false). Sin el documento, o para el admin, nada cambia.
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
  const { loading, puedeEditarYonke, terminosYonke } = useAuth();
  if (loading) return null;
  return <p>{`puede=${puedeEditarYonke} requerida=${!!terminosYonke?.requerida} resumen=${terminosYonke?.resumenCambios ?? ''}`}</p>;
}
async function montar() {
  await act(async () => { render(<AuthProvider><Mostrar /></AuthProvider>); });
}

afterEach(() => { cleanup(); docs = {}; lecturas.length = 0; });

describe('AuthContext: términos de yonkes', () => {
  it('con documento y versión vieja: solo lectura, con el resumen del documento', async () => {
    usuarioActual = { uid: 'o1' };
    docs = {
      'usuarios/o1': { rol: 'yonke', yonkeId: 'Y1' },
      'yonkes/Y1': { plan: 'freemium', aceptacionLegal: { version: 'v1' } },
      'config/terminosYonkes': { version: 'v2', resumenCambios: 'Cambios de octubre' },
    };
    await montar();
    expect(screen.getByText('puede=false requerida=true resumen=Cambios de octubre')).toBeInTheDocument();
  });
  it('con documento y sin aceptacionLegal (creado por el admin): solo lectura', async () => {
    usuarioActual = { uid: 'o1' };
    docs = { 'usuarios/o1': { rol: 'yonke', yonkeId: 'Y1' }, 'yonkes/Y1': {}, 'config/terminosYonkes': { version: 'v2' } };
    await montar();
    expect(screen.getByText(/^puede=false/)).toBeInTheDocument();
  });
  it('con documento y la versión vigente: puede editar', async () => {
    usuarioActual = { uid: 'o1' };
    docs = { 'usuarios/o1': { rol: 'yonke', yonkeId: 'Y1' }, 'yonkes/Y1': { aceptacionLegal: { version: 'v2' } }, 'config/terminosYonkes': { version: 'v2' } };
    await montar();
    expect(screen.getByText(/^puede=true/)).toBeInTheDocument();
  });
  it('sin documento: no se exige nada', async () => {
    usuarioActual = { uid: 'o1' };
    docs = { 'usuarios/o1': { rol: 'yonke', yonkeId: 'Y1' }, 'yonkes/Y1': {} };
    await montar();
    expect(screen.getByText('puede=true requerida=false resumen=')).toBeInTheDocument();
  });
  it('el admin nunca queda bloqueado y no lee config/terminosYonkes', async () => {
    usuarioActual = { uid: 'adm' };
    docs = { 'usuarios/adm': { rol: 'admin' }, 'config/terminosYonkes': { version: 'v2' } };
    await montar();
    expect(screen.getByText(/^puede=true/)).toBeInTheDocument();
    expect(lecturas).not.toContain('config/terminosYonkes');
  });
});
