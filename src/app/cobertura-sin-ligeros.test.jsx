import { describe, expect, it, vi } from 'vitest';

// La portada: los yonkes de registro ligero no cuentan en "N yonkes en N estados" ni como cobertura.
let yonkes = [];
let propsRecibidas = null;
vi.mock('./HomeClient', () => ({ default: (props) => { propsRecibidas = props; return null; } }));
vi.mock('./lib/firebase-server', () => ({ dbServer: {} }));
vi.mock('firebase/firestore', () => ({
  doc: (...a) => a.slice(1).join('/'),
  collection: (...a) => a.slice(1).join('/'),
  getDoc: vi.fn(async () => ({ exists: () => false })),
  getDocs: vi.fn(async () => ({ docs: yonkes.map((d) => ({ data: () => d })), size: yonkes.length })),
}));
vi.mock('./lib/busqueda/estadosServer', () => ({
  ESTADO_DEFAULT: 'baja-california', estadoDeYonke: (y) => y.estado,
  obtenerEstadosCombinado: async () => [{ id: 'baja-california', nombre: 'Baja California' }, { id: 'colima', nombre: 'Colima' }, { id: 'sonora', nombre: 'Sonora' }],
}));
vi.mock('./lib/busqueda/configBuscadorServer', () => ({ rangoAniosServer: async () => null }));
vi.mock('./lib/refaccionariaPublica', () => ({ buscadorRefaccionesEncendido: async () => false }));

const { default: Home } = await import('./page.js');
const { textoConteoRedYonkes } = await import('./lib/conteoRedYonkes');
const pintar = async () => { const el = await Home(); el.type(el.props); return propsRecibidas; };

describe('conteo de la portada', () => {
  it('no cuenta ligeros, ni un estado con puros ligeros; los que completaron sí', async () => {
    yonkes = [
      { estado: 'baja-california' }, { estado: 'baja-california', tipoRegistro: 'ligero' },
      { estado: 'colima', tipoRegistro: 'ligero' }, { estado: 'sonora', tipoRegistro: 'completo' },
    ];
    const props = await pintar();
    expect(props.textoConteoRed).toBe(textoConteoRedYonkes({ yonkes: 2, estados: 2 }));
    expect(props.textoSeoEstados).toContain('Sonora');
    expect(props.textoSeoEstados).not.toContain('Colima');
  });
});
