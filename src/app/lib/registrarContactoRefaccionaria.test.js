import { describe, expect, it, vi } from 'vitest';

const setDoc = vi.fn(async () => {});
vi.mock('./firebase', () => ({ db: {} }));
vi.mock('firebase/firestore', () => ({ doc: (_db, ...p) => p.join('/'), setDoc: (...a) => setDoc(...a), increment: (n) => ({ inc: n }) }));
const { mesContador, registrarContactoRefaccionaria } = await import('./registrarContactoRefaccionaria.js');

describe('contador de WhatsApp de refaccionarias', () => {
  it('suma 1 en refaccionarias/{id}/contactos/{AAAA-MM} con merge', () => {
    registrarContactoRefaccionaria('R1');
    expect(setDoc).toHaveBeenCalledWith(`refaccionarias/R1/contactos/${mesContador()}`, { clics: { inc: 1 } }, { merge: true });
    expect(mesContador(new Date('2026-03-15T12:00:00Z'))).toBe('2026-03');
  });
  it('sin id no hace nada; una falla se ignora', async () => {
    setDoc.mockClear();
    registrarContactoRefaccionaria('');
    expect(setDoc).not.toHaveBeenCalled();
    setDoc.mockRejectedValueOnce(new Error('permiso'));
    const aviso = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(() => registrarContactoRefaccionaria('R1')).not.toThrow();
    await new Promise((r) => setTimeout(r, 0));
    expect(aviso).toHaveBeenCalled();
    aviso.mockRestore();
  });
});
