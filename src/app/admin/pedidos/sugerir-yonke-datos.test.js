import { beforeEach, describe, expect, it, vi } from 'vitest';

// datos.js de /admin/pedidos: lo que guarda "Sugerir yonke" debe ser exactamente lo que exigen las
// reglas (firestore.rules, respuestaAdminValida / respuestaPedidoAdminValida).
const escrituras = [];
const borrados = [];
const consultas = [];
let configs = {};
vi.mock('../../lib/firebase', () => ({ db: 'db', auth: { currentUser: { uid: 'adm', email: 'admin@prueba.mx' } } }));
vi.mock('firebase/firestore', () => ({
  Timestamp: { fromDate: (d) => d }, deleteField: () => 'BORRAR_CAMPO', getCountFromServer: vi.fn(), limit: vi.fn(), orderBy: vi.fn(),
  updateDoc: vi.fn(async (ruta, datos) => { escrituras.push([ruta, datos]); }),
  writeBatch: () => {
    const lote = [];
    return { set: (ref, datos) => lote.push([ref.path ?? ref, datos]), commit: async () => { escrituras.push(...lote); } };
  },
  doc: (base, ...ruta) => (ruta.length === 0 ? { id: 'E1', path: `${base}/E1` } : ruta.join('/')),
  collection: (_db, ...ruta) => ruta.join('/'),
  where: (...a) => a,
  query: (ref, ...filtros) => { consultas.push([ref, ...filtros]); return ref; },
  serverTimestamp: () => 'HORA_DEL_SERVIDOR',
  getDoc: vi.fn(async (ruta) => ({ exists: () => ruta in configs, data: () => configs[ruta] })),
  getDocs: vi.fn(async () => ({
    docs: [
      { id: 'Y1', data: () => ({ nombre: 'El Güero', whatsapp: '6641111111', estado: 'baja-california', activo: true, verificado: true }) },
      { id: 'Y9', data: () => ({ nombre: '', whatsapp: '6649999999', estado: 'baja-california', activo: true }) },
    ],
  })),
  setDoc: vi.fn(async (ruta, datos) => { escrituras.push([ruta, datos]); }),
  deleteDoc: vi.fn(async (ruta) => { borrados.push(ruta); }),
}));

const datos = await import('./datos');

beforeEach(() => { escrituras.length = 0; borrados.length = 0; consultas.length = 0; configs = {}; });

describe('sugerirYonke', () => {
  const evidencia = { medio: 'whatsapp', mensaje: 'Sí la tengo y autorizo.', recibidoAt: new Date('2026-11-01T10:00:00Z') };

  it('guarda "precio a tratar", sin precio ni dia, con las marcas del admin y el vencimiento del pedido', async () => {
    configs['pedidosClientes/P1'] = { expiraAt: 'VENCE_P1', estadoPedido: 'abierta' };
    await datos.sugerirYonke('pedidosClientes', 'P1', { id: 'Y1', nombre: 'El Güero', whatsapp: '6641111111', estado: 'baja-california' }, evidencia);
    expect(escrituras[0]).toEqual(['pedidosClientes/P1/respuestas/Y1', {
      yonkeId: 'Y1', yonkeNombre: 'El Güero', whatsapp: '6641111111',
      tieneLaPieza: true, precioATratar: true, nota: '',
      creadoPorAdmin: true, creadoPorAdminUid: 'adm', evidenciaId: 'E1',
      creadoAt: 'HORA_DEL_SERVIDOR', expiraAt: 'VENCE_P1',
    }]);
    expect(escrituras[0][1]).not.toHaveProperty('precio');
    expect(escrituras[0][1]).not.toHaveProperty('dia');
  });

  it('guarda la evidencia en el mismo lote, a 30 días y con la búsqueda escrita', async () => {
    configs['pedidosClientes/P1'] = { expiraAt: 'VENCE_P1', pieza: 'Alternador', vehiculo: { marca: 'Nissan', modelo: 'Sentra', anio: 2005 } };
    const antes = Date.now();
    await datos.sugerirYonke('pedidosClientes', 'P1', { id: 'Y1', nombre: 'El Güero', whatsapp: '6641111111' }, evidencia);
    const [ruta, guardada] = escrituras[1];
    expect(ruta).toBe('evidenciasSugerir/E1');
    expect(guardada).toMatchObject({
      coleccion: 'pedidosClientes', pedidoId: 'P1', busqueda: 'Alternador · Nissan Sentra 2005',
      yonkeId: 'Y1', yonkeNombre: 'El Güero', yonkeWhatsapp: '6641111111',
      medio: 'whatsapp', mensaje: 'Sí la tengo y autorizo.', recibidoAt: evidencia.recibidoAt,
      autorizacionConfirmada: true, adminUid: 'adm', adminEmail: 'admin@prueba.mx', creadoAt: 'HORA_DEL_SERVIDOR',
    });
    expect(guardada.expiraAt.getTime() - antes).toBeGreaterThanOrEqual(30 * 24 * 60 * 60 * 1000);
    expect(guardada.expiraAt.getTime() - antes).toBeLessThan(30 * 24 * 60 * 60 * 1000 + 60000);
  });

  it('si el pedido ya no existe, no guarda nada', async () => {
    await expect(datos.sugerirYonke('solicitudesPiezas', 'NO', { id: 'Y1', nombre: 'X', whatsapp: '1' }, evidencia)).rejects.toThrow();
    expect(escrituras).toEqual([]);
  });
});

describe('quitarRespuesta y yonkes por estado', () => {
  it('quitarRespuesta borra solo esa respuesta', async () => {
    await datos.quitarRespuesta('solicitudesPiezas', 'S1', 'Y2');
    expect(borrados).toEqual(['solicitudesPiezas/S1/respuestas/Y2']);
  });

  it('listarYonkesActivosDeEstado consulta por estado y activo, y descarta los que no tienen nombre', async () => {
    const lista = await datos.listarYonkesActivosDeEstado('baja-california');
    expect(consultas).toEqual([['yonkes', ['estado', '==', 'baja-california'], ['activo', '==', true]]]);
    expect(lista).toEqual([{ id: 'Y1', nombre: 'El Güero', whatsapp: '6641111111', estado: 'baja-california' }]);
  });
});

describe('evidencias', () => {
  it('conservar quita el vencimiento y deja motivo; borrar borra solo esa', async () => {
    await datos.conservarEvidencia('E1', 'Reclamó el yonke');
    expect(escrituras).toEqual([['evidenciasSugerir/E1', {
      expiraAt: 'BORRAR_CAMPO', conservadaAt: 'HORA_DEL_SERVIDOR', conservadaPorUid: 'adm', motivoConservacion: 'Reclamó el yonke',
    }]]);
    await datos.borrarEvidenciaConservada('E1');
    expect(borrados).toEqual(['evidenciasSugerir/E1']);
  });
});

describe('leerBanderasSugerirYonke', () => {
  it('cada una solo con sugerirYonkeAdmin true exacto y la función de ese tipo encendida', async () => {
    expect(await datos.leerBanderasSugerirYonke()).toEqual({ clientes: false, talleres: false });
    configs['config/pedidosClientes'] = { habilitado: true, sugerirYonkeAdmin: true };
    configs['config/solicitudesPiezas'] = { habilitado: true, sugerirYonkeAdmin: 'true' };
    expect(await datos.leerBanderasSugerirYonke()).toEqual({ clientes: true, talleres: false });
    configs['config/pedidosClientes'] = { habilitado: false, sugerirYonkeAdmin: true };
    configs['config/solicitudesPiezas'] = { habilitado: true, sugerirYonkeAdmin: true };
    expect(await datos.leerBanderasSugerirYonke()).toEqual({ clientes: false, talleres: true });
  });
});
