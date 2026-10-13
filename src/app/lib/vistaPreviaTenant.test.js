import { afterEach, describe, expect, it, vi } from 'vitest';

let tenant = null;
let sinPremium = null;
const getTenantBySub = vi.fn(async () => tenant);
const obtenerEstadosCombinado = vi.fn(async () => [{ id: 'sonora', nombre: 'Sonora' }]);
vi.mock('./getTenant', async () => {
  const real = await vi.importActual('./getTenant');
  return {
    resolveBranding: real.resolveBranding, subdominioEstaActivo: real.subdominioEstaActivo,
    getTenantBySub: (...a) => getTenantBySub(...a), redireccionSinPremium: async () => sinPremium,
  };
});
vi.mock('./busqueda/estadosServer', () => ({ obtenerEstadosCombinado: (...a) => obtenerEstadosCombinado(...a) }));

const { datosImagenDeSubdominio } = await import('./vistaPreviaTenant.js');
const LOGO = 'https://firebasestorage.googleapis.com/v0/b/x/o/logos%2FY1.png?alt=media';
const descargarLogo = vi.fn(async () => 'data:image/png;base64,AAA');

afterEach(() => { tenant = null; sinPremium = null; vi.clearAllMocks(); });

describe('datos de la imagen de vista previa', () => {
  it('subdominio con formato inválido: genérica sin leer Firestore', async () => {
    expect(await datosImagenDeSubdominio('../x', { descargarLogo })).toBeNull();
    expect(await datosImagenDeSubdominio('Yonke', { descargarLogo })).toBeNull();
    expect(getTenantBySub).not.toHaveBeenCalled();
  });
  it('no existe, subdominio apagado o sin Premium vigente: genérica', async () => {
    expect(await datosImagenDeSubdominio('noexiste', { descargarLogo })).toBeNull();
    tenant = { id: 'Y1', nombre: 'Yonke', subdominioActivo: false };
    expect(await datosImagenDeSubdominio('yonke', { descargarLogo })).toBeNull();
    tenant = { id: 'Y1', nombre: 'Yonke' };
    sinPremium = 'https://mecanixyonkevirtual.com';
    expect(await datosImagenDeSubdominio('yonke', { descargarLogo })).toBeNull();
    expect(descargarLogo).not.toHaveBeenCalled();
  });
  it('con logo de Storage y ciudad de BC (sin leer estados)', async () => {
    tenant = { id: 'Y1', nombre: 'Yonke El Patos', ciudad: 'tijuana', logoUrl: LOGO, branding: { colorPrimario: '#0B6E4F' } };
    expect(await datosImagenDeSubdominio('yonkeelpatos', { descargarLogo })).toEqual({
      nombre: 'Yonke El Patos', lugar: 'Tijuana', colorPrimario: '#0B6E4F', logo: 'data:image/png;base64,AAA',
    });
    expect(descargarLogo).toHaveBeenCalledWith(LOGO);
    expect(obtenerEstadosCombinado).not.toHaveBeenCalled();
  });
  it('sin ciudad: el estado; un logo que no es de Storage no se descarga', async () => {
    tenant = { id: 'Y2', nombre: 'Deshuesadero Norte', estado: 'sonora', logoUrl: 'https://otro.com/l.png' };
    expect(await datosImagenDeSubdominio('deshuesaderonorte', { descargarLogo })).toEqual({
      nombre: 'Deshuesadero Norte', lugar: 'Sonora', colorPrimario: '#1A3C5E', logo: null,
    });
    expect(descargarLogo).not.toHaveBeenCalled();
  });
});
