import { beforeEach, describe, expect, it, vi } from 'vitest';

// datos.js de /admin/pedidos: lo que guarda "Sugerir yonke" debe ser exactamente lo que exigen las
// reglas (firestore.rules, respuestaAdminValida / respuestaPedidoAdminValida).
const escrituras = [];
const borrados = [];
const borradosDelLote = [];
const consultas = [];
let configs = {};
vi.mock('../../lib/firebase', () => ({ db: 'db', auth: { currentUser: { uid: 'adm', email: 'admin@prueba.mx' } } }));
vi.mock('firebase/firestore', () => ({
  Timestamp: { fromDate: (d) => d }, deleteField: () => 'BORRAR_CAMPO', getCountFromServer: vi.fn(), limit: vi.fn(), orderBy: vi.fn(),
  updateDoc: vi.fn(async (ruta, datos) => { escrituras.push([ruta, datos]); }),
  writeBatch: () => {
    const lote = [];
    return {
      set: (ref, datos) => lote.push([ref.path ?? ref, datos]),
      update: (ref, datos) => lote.push([ref, datos]),
      delete: (ref) => borradosDelLote.push(ref),
      commit: async () => { escrituras.push(...lote); borrados.push(...borradosDelLote.splice(0)); },
    };
  },
  doc: (base, ...ruta) => (ruta.length === 0 ? { id: 'E1', path: `${base}/E1` } : ruta.join('/')),
  collection: (_db, ...ruta) => ruta.join('/'),
  where: (...a) => a,
  query: (ref, ...filtros) => { consultas.push([ref, ...filtros]); return ref; },
  serverTimestamp: () => 'HORA_DEL_SERVIDOR',
  getDoc: vi.fn(async (ruta) => ({ ref: ruta, exists: () => ruta in configs, data: () => configs[ruta] })),
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
  const respuesta = { yonkeId: 'Y2', yonkeNombre: 'Yonke Dos', evidenciaId: 'EV' };

  it('quitarRespuesta borra solo esa respuesta y deja el motivo en el mismo lote', async () => {
    await datos.quitarRespuesta('solicitudesPiezas', 'S1', respuesta, 'sinPieza');
    expect(borrados).toEqual(['solicitudesPiezas/S1/respuestas/Y2']);
    expect(escrituras).toHaveLength(1);
    expect(escrituras[0][0]).toBe('retirosRespuestas/E1');
    expect(escrituras[0][1]).toMatchObject({
      coleccion: 'solicitudesPiezas', pedidoId: 'S1', yonkeId: 'Y2', yonkeNombre: 'Yonke Dos', motivo: 'sinPieza',
      adminUid: 'adm', adminEmail: 'admin@prueba.mx', fecha: 'HORA_DEL_SERVIDOR',
    });
  });

  it('número ajeno: conserva la evidencia vigente; la ya conservada o inexistente no se toca', async () => {
    const vigente = { toDate: () => new Date(Date.now() + 1000) };
    configs['evidenciasSugerir/EV'] = { expiraAt: vigente };
    await datos.quitarRespuesta('pedidosClientes', 'P1', respuesta, 'numeroAjeno');
    expect(escrituras[1]).toEqual(['evidenciasSugerir/EV', {
      expiraAt: 'BORRAR_CAMPO', conservadaAt: 'HORA_DEL_SERVIDOR', conservadaPorUid: 'adm', motivoConservacion: 'Reclamo de número ajeno: respuesta retirada',
    }]);
    for (const estado of [{}, undefined]) {
      escrituras.length = 0;
      if (estado) configs['evidenciasSugerir/EV'] = estado; else delete configs['evidenciasSugerir/EV'];
      await datos.quitarRespuesta('pedidosClientes', 'P1', respuesta, 'numeroAjeno');
      expect(escrituras).toHaveLength(1);
    }
  });

  it('otro motivo no conserva la evidencia', async () => {
    configs['evidenciasSugerir/EV'] = { expiraAt: { toDate: () => new Date(Date.now() + 1000) } };
    await datos.quitarRespuesta('pedidosClientes', 'P1', respuesta, 'otro');
    expect(escrituras).toHaveLength(1);
  });

  it('el WhatsApp sale del contacto del cliente o de la ficha del taller', async () => {
    configs['pedidosClientes/P1/privado/contacto'] = { clienteWhatsapp: '6649998877' };
    configs['talleres/T1'] = { whatsapp: '6641110000' };
    expect(await datos.leerWhatsappSolicitante('pedidosClientes', { id: 'P1' })).toBe('6649998877');
    expect(await datos.leerWhatsappSolicitante('solicitudesPiezas', { id: 'S1', tallerId: 'T1' })).toBe('6641110000');
    expect(await datos.leerWhatsappSolicitante('pedidosClientes', { id: 'P2' })).toBeNull();
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
