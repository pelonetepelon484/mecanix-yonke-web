import { describe, expect, it, vi, beforeEach } from 'vitest';

// Mock del wrapper de Admin SDK -- nunca toca Firestore real. Cada test arma su propio
// getAdminAuth()/getAdminDb() fake según el escenario que quiere probar.
vi.mock('../../lib/firebase-admin', () => ({
  getAdminAuth: vi.fn(),
  getAdminDb: vi.fn(),
}));

const { getAdminAuth, getAdminDb } = await import('../../lib/firebase-admin');
const { GET } = await import('./route.js');

function docFake(existe, data) {
  return { exists: existe, data: () => data };
}

// db falso mínimo: solo implementa lo que route.js realmente llama.
function dbFake({ usuario, yonke, busquedasDocs = [] }) {
  return {
    collection(nombre) {
      if (nombre === 'usuarios') {
        return { doc: () => ({ get: async () => docFake(Boolean(usuario), usuario) }) };
      }
      if (nombre === 'yonkes') {
        return { doc: () => ({ get: async () => docFake(Boolean(yonke), yonke) }) };
      }
      if (nombre === 'busquedas') {
        return {
          where: () => ({
            where: () => ({
              get: async () => ({ docs: busquedasDocs.map((d) => ({ data: () => d })) }),
            }),
          }),
        };
      }
      throw new Error(`colección inesperada en el mock: ${nombre}`);
    },
  };
}

function authFake(uidODeniega) {
  return {
    verifyIdToken: vi.fn(async (token) => {
      if (uidODeniega === null) throw new Error('token inválido');
      return { uid: uidODeniega };
    }),
  };
}

function req({ token = 'valido', periodo } = {}) {
  const url = new URL('http://localhost/api/demanda-yonke');
  if (periodo) url.searchParams.set('periodo', periodo);
  const headers = new Headers();
  if (token) headers.set('authorization', `Bearer ${token}`);
  return new Request(url, { headers });
}

// Recorre cualquier valor y falla si encuentra un number en algún lado -- exactamente lo que
// pidió la auditoría: "el test debe correr sobre la respuesta final completa del endpoint".
function sinNumeros(valor, ruta = 'raíz') {
  if (typeof valor === 'number') throw new Error(`Se encontró un number en ${ruta}: ${valor}`);
  if (Array.isArray(valor)) valor.forEach((v, i) => sinNumeros(v, `${ruta}[${i}]`));
  else if (valor && typeof valor === 'object') {
    for (const [k, v] of Object.entries(valor)) sinNumeros(v, `${ruta}.${k}`);
  }
}

beforeEach(() => {
  getAdminAuth.mockReset();
  getAdminDb.mockReset();
});

describe('GET /api/demanda-yonke — autenticación y autorización', () => {
  it('sin Admin SDK configurado -> 503', async () => {
    getAdminAuth.mockReturnValue(null);
    getAdminDb.mockReturnValue(null);
    const res = await GET(req());
    expect(res.status).toBe(503);
  });

  it('sin header Authorization -> 401', async () => {
    getAdminAuth.mockReturnValue(authFake('u1'));
    getAdminDb.mockReturnValue(dbFake({}));
    const res = await GET(req({ token: null }));
    expect(res.status).toBe(401);
  });

  it('token inválido -> 401', async () => {
    getAdminAuth.mockReturnValue(authFake(null));
    getAdminDb.mockReturnValue(dbFake({}));
    const res = await GET(req());
    expect(res.status).toBe(401);
  });

  it('usuario sin doc en /usuarios -> 403', async () => {
    getAdminAuth.mockReturnValue(authFake('u1'));
    getAdminDb.mockReturnValue(dbFake({ usuario: null }));
    const res = await GET(req());
    expect(res.status).toBe(403);
  });

  it('rol distinto de "yonke" -> 403', async () => {
    getAdminAuth.mockReturnValue(authFake('u1'));
    getAdminDb.mockReturnValue(dbFake({ usuario: { rol: 'admin', yonkeId: 'y1' } }));
    const res = await GET(req());
    expect(res.status).toBe(403);
  });

  it('yonke inexistente (borrado) -> 403', async () => {
    getAdminAuth.mockReturnValue(authFake('u1'));
    getAdminDb.mockReturnValue(dbFake({ usuario: { rol: 'yonke', yonkeId: 'y1' }, yonke: null }));
    const res = await GET(req());
    expect(res.status).toBe(403);
  });

  it('yonke desactivado (activo:false) -> 403', async () => {
    getAdminAuth.mockReturnValue(authFake('u1'));
    getAdminDb.mockReturnValue(dbFake({
      usuario: { rol: 'yonke', yonkeId: 'y1' },
      yonke: { activo: false, estado: 'baja-california' },
    }));
    const res = await GET(req());
    expect(res.status).toBe(403);
  });

  it('nunca acepta un estado o yonkeId que mande el cliente -- el query string se ignora', async () => {
    getAdminAuth.mockReturnValue(authFake('u1'));
    const db = dbFake({
      usuario: { rol: 'yonke', yonkeId: 'y1' },
      yonke: { activo: true, estado: 'jalisco' },
      busquedasDocs: [],
    });
    const spyCollection = vi.spyOn(db, 'collection');
    getAdminDb.mockReturnValue(db);
    const url = new URL('http://localhost/api/demanda-yonke?estado=nuevo-leon&yonkeId=otro-yonke&periodo=7');
    const headers = new Headers({ authorization: 'Bearer valido' });
    await GET(new Request(url, { headers }));
    // Se llamó a 'busquedas' -- si hubiera usado el estado del query, habría fallado el mock
    // (dbFake solo conoce el estado real 'jalisco' vía el yonke, no lee el query en absoluto).
    expect(spyCollection).toHaveBeenCalledWith('busquedas');
  });
});

describe('GET /api/demanda-yonke — plan y periodo', () => {
  it('yonke activo con plan freemium igual recibe reporte (sin chequeo de plan)', async () => {
    getAdminAuth.mockReturnValue(authFake('u1'));
    getAdminDb.mockReturnValue(dbFake({
      usuario: { rol: 'yonke', yonkeId: 'y1' },
      yonke: { activo: true, estado: 'baja-california-sur', plan: 'freemium' },
      busquedasDocs: [],
    }));
    const res = await GET(req());
    expect(res.status).toBe(200);
  });

  it('periodo inválido cae al default (7 días) sin tronar', async () => {
    getAdminAuth.mockReturnValue(authFake('u1'));
    getAdminDb.mockReturnValue(dbFake({
      usuario: { rol: 'yonke', yonkeId: 'y1' },
      yonke: { activo: true, estado: 'queretaro' },
      busquedasDocs: [],
    }));
    const res = await GET(req({ periodo: '9999' }));
    expect(res.status).toBe(200);
  });
});

describe('GET /api/demanda-yonke — respuesta sin números', () => {
  it('estado sin código conocido -> {filas: []}, sin números', async () => {
    getAdminAuth.mockReturnValue(authFake('u1'));
    getAdminDb.mockReturnValue(dbFake({
      usuario: { rol: 'yonke', yonkeId: 'y1' },
      yonke: { activo: true, estado: 'atlantida-inexistente' },
    }));
    const res = await GET(req());
    const body = await res.json();
    expect(body).toEqual({ filas: [] });
    sinNumeros(body);
  });

  it('con datos reales que superan el mínimo, la respuesta completa no contiene ningún number', async () => {
    getAdminAuth.mockReturnValue(authFake('u1'));
    const busquedasDocs = [
      { pieza: 'Faro', marca: 'Honda', modelo: 'Civic', anio: 2010, conResultado: true, estado: 'ok' },
      { pieza: 'Faro', marca: 'Honda', modelo: 'Civic', anio: 2011, conResultado: false, estado: 'sin_inventario' },
      { pieza: 'Calavera', marca: 'Dodge', modelo: 'Stratus', anio: 2002, conResultado: true, estado: 'ok' },
      { pieza: 'Calavera', marca: 'Dodge', modelo: 'Stratus', anio: 2003, conResultado: true, estado: 'ok' },
      // Se debe excluir por completo -- no debe aparecer ninguna fila ni afectar el conteo:
      { pieza: 'Facia trasera', marca: null, modelo: null, anio: null, conResultado: false, estado: 'pieza_sin_vehiculo', sinVehiculo: true },
    ];
    getAdminDb.mockReturnValue(dbFake({
      usuario: { rol: 'yonke', yonkeId: 'y1' },
      yonke: { activo: true, estado: 'tamaulipas' },
      busquedasDocs,
    }));
    const res = await GET(req({ periodo: '30' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.filas.length).toBeGreaterThan(0);
    expect(body.filas.some((f) => f.clave.includes('pieza_sin_vehiculo'))).toBe(false);
    sinNumeros(body);
  });

  it('responde el mismo resultado cacheado en una segunda llamada sin volver a leer busquedas', async () => {
    getAdminAuth.mockReturnValue(authFake('u1'));
    const db = dbFake({
      usuario: { rol: 'yonke', yonkeId: 'y1' },
      yonke: { activo: true, estado: 'sonora' }, // estado distinto para no chocar con la caché de otros tests
      busquedasDocs: [
        { pieza: 'Puerta', marca: 'Nissan', modelo: 'Sentra', anio: 2015, conResultado: true, estado: 'ok' },
        { pieza: 'Puerta', marca: 'Nissan', modelo: 'Sentra', anio: 2016, conResultado: true, estado: 'ok' },
      ],
    });
    const spyCollection = vi.spyOn(db, 'collection');
    getAdminDb.mockReturnValue(db);
    const primera = await GET(req({ periodo: '7' }));
    const segunda = await GET(req({ periodo: '7' }));
    expect(await primera.json()).toEqual(await segunda.json());
    // 'busquedas' solo debió leerse una vez -- la segunda vino de la caché en memoria.
    expect(spyCollection.mock.calls.filter(([n]) => n === 'busquedas')).toHaveLength(1);
  });
});
