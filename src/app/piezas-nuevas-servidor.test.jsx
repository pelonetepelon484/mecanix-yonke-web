import { describe, expect, it, vi } from 'vitest';
import { renderToString } from 'react-dom/server';

// config/refaccionarias.buscador se lee en el servidor (page.js): solo con buscador y paginaPublica
// en true exacto aparece el selector de piezas nuevas; si no, o si falla la lectura, la portada de
// siempre.
let configRefaccionarias = null;
let falla = false;
vi.mock('./lib/firebase-server', () => ({ dbServer: {} }));
vi.mock('./lib/firebase', () => ({ db: 'db' }));
vi.mock('firebase/firestore', () => ({
  doc: (...a) => a.slice(1).join('/'),
  collection: (...a) => a.slice(1).join('/'),
  query: (...a) => a[0], where: () => null, orderBy: () => null, limit: () => null,
  getDoc: vi.fn(async (ruta) => {
    if (ruta === 'config/refaccionarias' && falla) throw new Error('sin red');
    return ruta === 'config/refaccionarias' && configRefaccionarias
      ? { exists: () => true, data: () => configRefaccionarias }
      : { exists: () => false, data: () => ({}) };
  }),
  getDocs: vi.fn(async () => ({ docs: [], empty: true, size: 0, forEach: () => {} })),
  addDoc: vi.fn(),
}));
vi.mock('./lib/busqueda/estadosServer', () => ({
  ESTADO_DEFAULT: 'baja-california', estadoDeYonke: () => 'baja-california',
  obtenerEstadosCombinado: async () => [{ id: 'baja-california', nombre: 'Baja California' }],
}));
vi.mock('./lib/busqueda/configBuscadorServer', () => ({ rangoAniosServer: async () => null }));

// Cada caso con módulos nuevos: la configuración se guarda 5 minutos en memoria.
async function htmlInicial(config, conFalla = false) {
  configRefaccionarias = config;
  falla = conFalla;
  vi.resetModules();
  const { default: Home } = await import('./page.js');
  return renderToString(await Home());
}

describe('portada en el servidor: bandera del buscador de piezas nuevas', () => {
  it('buscador y paginaPublica en true: con el selector', async () => {
    expect(await htmlInicial({ buscador: true, paginaPublica: true })).toContain('Piezas nuevas (refaccionarias)');
  });
  it('sin paginaPublica, con otro valor, sin documento o si falla la lectura: sin el selector', async () => {
    for (const [config, conFalla] of [[{ buscador: true }], [{ buscador: 'true', paginaPublica: true }], [null], [{ buscador: true, paginaPublica: true }, true]]) {
      const html = await htmlInicial(config, conFalla);
      expect(html).not.toContain('Piezas nuevas');
      expect(html).toContain('Buscador inteligente');
    }
  });
});
