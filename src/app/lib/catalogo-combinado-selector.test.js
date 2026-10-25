import { describe, expect, it, vi } from 'vitest';

// cargarCatalogoCombinado() (selectores de marca/modelo): junta en pantalla las variantes de una
// marca y los modelos con espacios sobrantes. Firestore simulado; solo se lee.
let vivo = {};
vi.mock('./firebase', () => ({ db: 'db' }));
vi.mock('firebase/firestore', () => ({
  doc: () => 'config/catalogoVehiculos',
  getDoc: vi.fn(async () => ({ exists: () => true, data: () => ({ catalogo: vivo }) })),
}));

const { cargarCatalogoCombinado } = await import('./SelectorMarcaModelo');

const cargar = async (catalogoVivo) => { vivo = catalogoVivo; return cargarCatalogoCombinado(); };
const marcasComo = (c, re) => Object.keys(c).filter((m) => re.test(m));

describe('cargarCatalogoCombinado: marcas y modelos sin repetir en el selector', () => {
  it('"dodge", "DODGE" y " Dodge " salen una sola vez como "Dodge" (el nombre del catálogo base), con todos sus modelos', async () => {
    const c = await cargar({ dodge: ['Modelo Solo Vivo'], DODGE: ['Ram 1500'], ' Dodge ': ['Otro Vivo'] });
    expect(marcasComo(c, /dodge/i)).toEqual(['Dodge']);
    expect(c.Dodge).toEqual(expect.arrayContaining(['Modelo Solo Vivo', 'Ram 1500', 'Otro Vivo', 'Neon']));
    expect(new Set(c.Dodge).size).toBe(c.Dodge.length);
  });

  it('acentos: "Peugéot" se junta con "Peugeot" del catálogo base', async () => {
    const c = await cargar({ 'Peugéot': ['206'] });
    expect(marcasComo(c, /peug/i)).toEqual(['Peugeot']);
  });

  it('una marca que solo existe en el vivo sale una sola vez (la primera versión, sin espacios sobrantes)', async () => {
    const c = await cargar({ 'Marca Nueva': ['X1'], 'marca nueva ': ['X2'], 'MARCA  NUEVA': ['X3'] });
    expect(marcasComo(c, /marca\s+nueva/i)).toEqual(['Marca Nueva']);
    expect(c['Marca Nueva']).toEqual(['X1', 'X2', 'X3']);
  });

  it('"Civic" y "Civic " salen una sola vez; "CR-V" y "crv" siguen por separado (se deja para después)', async () => {
    const c = await cargar({ Honda: ['Civic ', ' Civic', 'crv', 'CR-V'] });
    expect(c.Honda.filter((m) => m.trim() === 'Civic')).toEqual(['Civic']);
    expect(c.Honda).toEqual(expect.arrayContaining(['CR-V', 'crv']));
  });

  it('sin catálogo vivo: el catálogo base tal cual, sin marcas repetidas', async () => {
    const c = await cargar({});
    const claves = Object.keys(c).map((m) => m.toLowerCase());
    expect(new Set(claves).size).toBe(claves.length);
    expect(c.MG).toContain('ZS');
  });
});
