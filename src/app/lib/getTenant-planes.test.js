// Página propia = plan Premium cuando config/planes.limitesActivos es true: a dónde se manda a
// quien entra al subdominio de un yonke sin Premium vigente (redirección temporal a su ficha).
import { describe, expect, it, vi, beforeEach } from 'vitest';

let configPlanes = null;
vi.mock('./firebase-server', () => ({ dbServer: {} }));
vi.mock('firebase/firestore', () => ({
  doc: (_db, ...ruta) => ruta.join('/'),
  getDoc: async (ruta) => (ruta === 'config/planes' && configPlanes
    ? { exists: () => true, data: () => configPlanes }
    : { exists: () => false }),
  collection: vi.fn(), getDocs: vi.fn(), query: vi.fn(), where: vi.fn(),
}));

const { redireccionSinPremium, urlFichaPublica } = await import('./getTenant');
const DIA = 86400000;
const tenant = (extra = {}) => ({ id: 'Y1', ciudad: 'tijuana', activo: true, plan: 'freemium', ...extra });

beforeEach(() => { configPlanes = null; });

describe('ficha pública del yonke', () => {
  it('ciudad con ficha y yonke activo: /yonkes/{ciudad}/{id} del sitio principal', () => {
    expect(urlFichaPublica(tenant())).toBe('https://mecanixyonkevirtual.com/yonkes/tijuana/Y1');
  });
  it('ciudad sin ficha (otro estado) o yonke sin activo === true: la página principal', () => {
    expect(urlFichaPublica(tenant({ ciudad: 'hermosillo' }))).toBe('https://mecanixyonkevirtual.com');
    expect(urlFichaPublica(tenant({ activo: undefined }))).toBe('https://mecanixyonkevirtual.com');
  });
});

describe('redirección del subdominio', () => {
  it('interruptor apagado (sin documento, false o "true" texto): nunca redirige (regresión)', async () => {
    for (const valor of [null, { limitesActivos: false }, { limitesActivos: 'true' }]) {
      configPlanes = valor;
      expect(await redireccionSinPremium(tenant())).toBeNull();
      expect(await redireccionSinPremium(tenant({ plan: 'premium', premiumHasta: new Date(Date.now() - DIA) }))).toBeNull();
    }
  });
  it('encendido: Básico y Premium vencido van a su ficha', async () => {
    configPlanes = { limitesActivos: true };
    expect(await redireccionSinPremium(tenant())).toBe('https://mecanixyonkevirtual.com/yonkes/tijuana/Y1');
    expect(await redireccionSinPremium(tenant({ plan: 'premium', premiumHasta: { toDate: () => new Date(Date.now() - DIA) } })))
      .toBe('https://mecanixyonkevirtual.com/yonkes/tijuana/Y1');
  });
  it('encendido: Premium vigente (sin fecha o futura) no nota nada', async () => {
    configPlanes = { limitesActivos: true };
    expect(await redireccionSinPremium(tenant({ plan: 'premium' }))).toBeNull();
    expect(await redireccionSinPremium(tenant({ plan: 'premium', premiumHasta: { toDate: () => new Date(Date.now() + DIA) } }))).toBeNull();
  });
});
