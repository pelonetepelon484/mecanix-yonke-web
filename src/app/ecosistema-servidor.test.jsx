import { describe, expect, it, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import { NextRequest } from 'next/server';

// config/portada.ecosistema se lee en el servidor (page.js): con la bandera encendida, el texto del
// bloque va en el HTML inicial (lo que lee Google). Y un subdominio de yonke nunca llega a la
// portada (middleware.js lo manda a /tenant-demo), así que no puede mostrar el bloque.
let configPortada = null;
vi.mock('./lib/firebase-server', () => ({ dbServer: {} }));
vi.mock('./lib/firebase', () => ({ db: 'db' }));
vi.mock('firebase/firestore', () => ({
  doc: (...a) => a.slice(1).join('/'),
  collection: (...a) => a.slice(1).join('/'),
  query: (...a) => a[0], where: () => null, orderBy: () => null, limit: () => null,
  getDoc: vi.fn(async (ruta) => (ruta === 'config/portada' && configPortada
    ? { exists: () => true, data: () => configPortada }
    : { exists: () => false, data: () => ({}) })),
  getDocs: vi.fn(async () => ({ docs: [], empty: true, size: 0, forEach: () => {} })),
  addDoc: vi.fn(),
}));
vi.mock('./lib/busqueda/estadosServer', () => ({
  ESTADO_DEFAULT: 'baja-california', estadoDeYonke: () => 'baja-california',
  obtenerEstadosCombinado: async () => [{ id: 'baja-california', nombre: 'Baja California' }],
}));
vi.mock('./lib/busqueda/configBuscadorServer', () => ({ rangoAniosServer: async () => null }));

const { default: Home } = await import('./page.js');
const { middleware } = await import('../middleware.js');

const TITULO = 'Ecosistema de soluciones automotrices';

async function htmlInicial(config) {
  configPortada = config;
  return renderToString(await Home());
}

describe('HTML inicial de la portada (servidor)', () => {
  it('bandera encendida: el título, la entrada y las 5 tarjetas van en el HTML', async () => {
    const html = await htmlInicial({ ecosistema: true });
    for (const texto of [TITULO, 'Mecanix conecta yonkes, talleres y más soluciones automotrices en un solo lugar.',
      'Yonkes', 'Autopartes usadas.', 'Talleres y servicios', 'Refacciones nuevas', 'Especialistas', 'Servicios futuros', 'Próximamente']) {
      expect(html).toContain(texto);
    }
  }, 30000);

  it('sin documento, con false o con otro valor: el bloque no va en el HTML', async () => {
    for (const config of [null, { ecosistema: false }, { ecosistema: 'true' }, { botonPanel: true }]) {
      const html = await htmlInicial(config);
      expect(html).not.toContain(TITULO);
      expect(html).toContain('Refacciones y autopartes usadas en México'); // la portada sí se renderizó
    }
  }, 30000);
});

describe('subdominios de yonkes (middleware)', () => {
  const ir = (url) => middleware(new NextRequest(url, { headers: { host: new URL(url).host } }));

  it('la raíz y cualquier ruta de un subdominio van a /tenant-demo (nunca a la portada)', () => {
    for (const [url, destino] of [
      ['https://elguero.mecanixyonkevirtual.com/', '/tenant-demo'],
      ['https://elguero.mecanixyonkevirtual.com/cualquier-cosa', '/tenant-demo'],
      ['https://elguero.mecanixyonkevirtual.com/politicas', '/tenant-demo/politicas'],
    ]) {
      const r = ir(url);
      expect(new URL(r.headers.get('x-middleware-rewrite')).pathname).toBe(destino);
    }
  });

  it('el sitio principal (con y sin www) sigue a la portada, sin reescribir', () => {
    for (const url of ['https://www.mecanixyonkevirtual.com/', 'https://mecanixyonkevirtual.com/']) {
      expect(ir(url).headers.get('x-middleware-rewrite')).toBeNull();
    }
  });
});
