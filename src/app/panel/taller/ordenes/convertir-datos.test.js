import { describe, expect, it, vi, beforeEach } from 'vitest';

// Firestore falso: registra lo que mete cada lote y si se confirmó.
const lotes = [];
let fallarCommits = 0;
let cotizacion = null;
vi.mock('../../../lib/firebase', () => ({ db: {} }));
vi.mock('firebase/firestore', () => ({
  collection: vi.fn(), doc: vi.fn((_db, ...ruta) => ruta.join('/')), getDoc: vi.fn(), getDocs: vi.fn(), limit: vi.fn(), orderBy: vi.fn(),
  query: vi.fn(), startAfter: vi.fn(), updateDoc: vi.fn(), deleteDoc: vi.fn(), deleteField: vi.fn(), where: vi.fn(), setDoc: vi.fn(),
  serverTimestamp: () => 'HORA_SERVIDOR',
  writeBatch: () => {
    const lote = { sets: [], deletes: [], confirmado: false };
    lotes.push(lote);
    return {
      set: (ref, datos) => lote.sets.push([ref, datos]),
      delete: (ref) => lote.deletes.push(ref),
      commit: async () => {
        if (fallarCommits > 0) { fallarCommits--; throw new Error('permission-denied'); }
        lote.confirmado = true;
      },
    };
  },
}));
vi.mock('../cotizaciones/datos', () => ({ leerCotizacion: vi.fn(async () => cotizacion) }));

const { convertirCotizacionEnOrden } = await import('./datos.js');
const { MENSAJES_CONVERSION } = await import('../../../../lib/ordenes');
const DIA = 86400000;
const veinte = Array.from({ length: 20 }, (_, i) => ({ numero: i, tipo: i < 10 ? 'pieza' : 'manoObra', descripcion: `R${i}`, cantidad: 1, precioUnitario: 100 }));

beforeEach(() => {
  lotes.length = 0;
  fallarCommits = 0;
  cotizacion = {
    folio: 'C251011-AAAA', cliente: { nombre: 'Juan' }, vehiculo: { marca: 'Nissan', modelo: 'Sentra', anio: 2001, placas: 'ABC123', kilometraje: 1000 },
    observaciones: 'x', renglones: veinte,
  };
});

describe('convertir en orden: un solo guardado, todo o nada', () => {
  it('en UN lote: crea la orden y borra los 20 renglones y la cotización', async () => {
    const folio = await convertirCotizacionEnOrden({ tallerId: 'T1', folioCotizacion: 'C251011-AAAA', avisoVersion: 'aviso-orden-0' });
    expect(folio).toMatch(/^O[0-9]{6}-[A-Z0-9]{4}$/);
    expect(lotes).toHaveLength(1);
    const [lote] = lotes;
    expect(lote.confirmado).toBe(true);
    expect(lote.sets).toHaveLength(1);
    expect(lote.sets[0][0]).toBe(`talleres/T1/ordenes/${folio}`);
    expect(lote.deletes).toEqual([
      ...veinte.map((r) => `talleres/T1/cotizaciones/C251011-AAAA/renglones/${r.numero}`),
      'talleres/T1/cotizaciones/C251011-AAAA',
    ]);
  });
  it('la orden nace "recibido", sin datos del cliente, sin enlace a la cotización y con borrado a 88 días', async () => {
    await convertirCotizacionEnOrden({ tallerId: 'T1', folioCotizacion: 'C251011-AAAA', avisoVersion: 'aviso-orden-0' });
    const orden = lotes[0].sets[0][1];
    expect(orden).toMatchObject({
      tallerId: 'T1', estado: 'recibido', cliente: {}, vehiculo: { marca: 'Nissan', modelo: 'Sentra', anio: 2001, kilometraje: 1000 },
      observaciones: 'x', totalCentavos: 200000, creadoAt: 'HORA_SERVIDOR', actualizadoAt: 'HORA_SERVIDOR', avisoVersion: 'aviso-orden-0',
    });
    expect(orden.piezas).toHaveLength(10);
    expect(orden.trabajos).toHaveLength(10);
    expect(Math.abs(orden.expiraAt.getTime() - (Date.now() + 88 * DIA))).toBeLessThan(5000);
    expect(JSON.stringify(orden)).not.toMatch(/Juan|ABC123|C251011|placas|cotizacion/);
  });
  it('si el guardado falla 3 veces: error claro y nada confirmado (la cotización queda intacta)', async () => {
    fallarCommits = 3;
    await expect(convertirCotizacionEnOrden({ tallerId: 'T1', folioCotizacion: 'C251011-AAAA' })).rejects.toThrow(MENSAJES_CONVERSION.fallo);
    expect(lotes).toHaveLength(3);
    expect(lotes.every((l) => !l.confirmado)).toBe(true);
  });
  it('si el folio choca una vez, prueba con otro y lo logra', async () => {
    fallarCommits = 1;
    await convertirCotizacionEnOrden({ tallerId: 'T1', folioCotizacion: 'C251011-AAAA' });
    expect(lotes.map((l) => l.confirmado)).toEqual([false, true]);
  });
  it('cotización que ya no existe o con más de 20 de un tipo: mensaje claro y sin guardar nada', async () => {
    cotizacion = null;
    await expect(convertirCotizacionEnOrden({ tallerId: 'T1', folioCotizacion: 'C251011-AAAA' })).rejects.toThrow(MENSAJES_CONVERSION.noExiste);
    cotizacion = { vehiculo: { marca: 'N', modelo: 'S', anio: 2001 }, observaciones: '', renglones: Array.from({ length: 21 }, (_, i) => ({ numero: i, tipo: 'pieza', descripcion: 'x', cantidad: 1, precioUnitario: 1 })) };
    await expect(convertirCotizacionEnOrden({ tallerId: 'T1', folioCotizacion: 'C251011-AAAA' })).rejects.toThrow(MENSAJES_CONVERSION.demasiados);
    expect(lotes).toHaveLength(0);
  });
  it('con copiarCliente: la orden lleva nombre y placas de la cotización, en el mismo guardado único', async () => {
    await convertirCotizacionEnOrden({ tallerId: 'T1', folioCotizacion: 'C251011-AAAA', avisoVersion: 'aviso-orden-1', copiarCliente: true });
    const orden = lotes[0].sets[0][1];
    expect(orden.cliente).toEqual({ nombre: 'Juan' });
    expect(orden.vehiculo.placas).toBe('ABC123');
    expect(orden.avisoVersion).toBe('aviso-orden-1');
    expect(lotes[0].deletes).toHaveLength(21);
  });
});

