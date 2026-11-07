// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { createHash, webcrypto } from 'node:crypto';

// Enlace "Estoy aquí" en el admin: el secreto solo vive en el enlace; Firestore guarda su huella.
const setDoc = vi.fn(async () => {});
const deleteDoc = vi.fn(async () => {});
let viejos = [];
vi.mock('../../lib/firebase', () => ({ db: {} }));
vi.mock('firebase/firestore', () => ({
  collection: (_db, ...p) => p.join('/'),
  doc: (_db, ...p) => p.join('/'),
  query: (...a) => a, where: (...a) => a,
  getDocs: vi.fn(async () => ({ size: viejos.length, docs: viejos.map((id) => ({ ref: `checkinsAsistencia/${id}` })) })),
  setDoc: (...a) => setDoc(...a), deleteDoc: (...a) => deleteDoc(...a), serverTimestamp: () => 'AHORA',
}));
if (!globalThis.crypto?.subtle) vi.stubGlobal('crypto', webcrypto);

const { default: EnlaceAqui, generarSecreto, huellaDe } = await import('./EnlaceAqui.js');
const p = { id: 'P1', nombre: 'Grúas El Güero', telefono: '6641234567', whatsapp: '6649998877' };

afterEach(() => { cleanup(); setDoc.mockClear(); deleteDoc.mockClear(); viejos = []; vi.restoreAllMocks(); });

describe('enlace "Estoy aquí" (admin)', () => {
  it('secreto de 43 caracteres base64url y huella SHA-256 en hex', async () => {
    const s = generarSecreto(new Uint8Array(32).fill(255));
    expect(s).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(await huellaDe(s)).toBe(createHash('sha256').update(s).digest('hex'));
    expect(generarSecreto()).not.toBe(generarSecreto());
  });
  it('crear: borra los enlaces viejos, guarda solo la huella y muestra el enlace para mandarlo', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    viejos = ['viejo1'];
    render(<EnlaceAqui p={p} />);
    fireEvent.click(screen.getByRole('button', { name: 'Crear enlace' }));
    const caja = await screen.findByRole('textbox', { name: 'Enlace Estoy aquí' });
    const enlace = caja.value;
    expect(enlace).toMatch(/^https:\/\/www\.mecanixyonkevirtual\.com\/asistencia-vial\/aqui#[A-Za-z0-9_-]{43}$/);
    expect(deleteDoc).toHaveBeenCalledWith('checkinsAsistencia/viejo1');
    expect(deleteDoc).not.toHaveBeenCalledWith('ubicacionesAsistencia/P1');
    const secreto = enlace.split('#')[1];
    expect(setDoc).toHaveBeenCalledWith(`checkinsAsistencia/${createHash('sha256').update(secreto).digest('hex')}`, { proveedorId: 'P1', creadoAt: 'AHORA' });
    expect(JSON.stringify(setDoc.mock.calls)).not.toContain(secreto);
    const wa = screen.getByRole('link', { name: 'Enviar por WhatsApp' }).getAttribute('href');
    expect(wa).toContain('6649998877');
    expect(decodeURIComponent(wa)).toContain(enlace);
  });
  it('desactivar: borra el enlace y lo quita del mapa', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    viejos = ['viejo1'];
    render(<EnlaceAqui p={p} />);
    fireEvent.click(screen.getByRole('button', { name: 'Desactivar enlace' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Enlace desactivado y proveedor quitado del mapa.');
    expect(deleteDoc).toHaveBeenCalledWith('checkinsAsistencia/viejo1');
    expect(deleteDoc).toHaveBeenCalledWith('ubicacionesAsistencia/P1');
  });
  it('si no confirma, no hace nada', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(<EnlaceAqui p={p} />);
    fireEvent.click(screen.getByRole('button', { name: 'Crear enlace' }));
    await waitFor(() => expect(setDoc).not.toHaveBeenCalled());
    expect(deleteDoc).not.toHaveBeenCalled();
  });
});
