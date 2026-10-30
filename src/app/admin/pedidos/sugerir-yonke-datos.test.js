import { beforeEach, describe, expect, it, vi } from 'vitest';

// datos.js de /admin/pedidos: lo que guarda "Sugerir yonke" debe ser exactamente lo que exigen las
// reglas (firestore.rules, respuestaAdminValida / respuestaPedidoAdminValida).
const escrituras = [];
const borrados = [];
const consultas = [];
let configs = {};
vi.mock('../../lib/firebase', () => ({ db: 'db', auth: { currentUser: { uid: 'adm' } } }));
vi.mock('firebase/firestore', () => ({
  Timestamp: {}, deleteField: vi.fn(), getCountFromServer: vi.fn(), limit: vi.fn(), orderBy: vi.fn(), updateDoc: vi.fn(), writeBatch: vi.fn(),
  doc: (_db, ...ruta) => ruta.join('/'),
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
  it('guarda "precio a tratar", sin precio ni dia, con las marcas del admin y el vencimiento del pedido', async () => {
    configs['pedidosClientes/P1'] = { expiraAt: 'VENCE_P1', estadoPedido: 'abierta' };
    await datos.sugerirYonke('pedidosClientes', 'P1', { id: 'Y1', nombre: 'El Güero', whatsapp: '6641111111', estado: 'baja-california' });
    expect(escrituras).toEqual([['pedidosClientes/P1/respuestas/Y1', {
      yonkeId: 'Y1', yonkeNombre: 'El Güero', whatsapp: '6641111111',
      tieneLaPieza: true, precioATratar: true, nota: '',
      creadoPorAdmin: true, creadoPorAdminUid: 'adm',
      creadoAt: 'HORA_DEL_SERVIDOR', expiraAt: 'VENCE_P1',
    }]]);
    expect(escrituras[0][1]).not.toHaveProperty('precio');
    expect(escrituras[0][1]).not.toHaveProperty('dia');
  });

  it('si el pedido ya no existe, no guarda nada', async () => {
    await expect(datos.sugerirYonke('solicitudesPiezas', 'NO', { id: 'Y1', nombre: 'X', whatsapp: '1' })).rejects.toThrow();
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
