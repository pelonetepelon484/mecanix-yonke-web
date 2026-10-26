import { describe, expect, it, vi } from 'vitest';
import { MAX_AVISOS_PUSH_YONKE_HORA, crearAvisarYonkes, textoAviso, urlAviso, veAlertaDeOtroEstado } from './avisarYonkes';

const DB = { falso: true };
const conEnvio = { activo: true, verificado: true, enviosNacionales: true, verAlertasOtrosEstados: true };
const ALERTA = { tipo: 'alertaCliente', id: 'Pedido0001', estado: 'baja-california', vehiculo: { marca: 'Nissan', modelo: 'Sentra', anio: 2005 }, pieza: 'Alternador', incluirOtrosEstados: false };
const TALLER = { tipo: 'pedidoTaller', id: 'S1', estado: 'baja-california', vehiculo: { marca: 'Ford', modelo: 'Focus', anio: 2012 }, pieza: 'Faro' };

function falsos({ habilitado = true, cliente = 'ok', contar } = {}) {
  const contadores = new Map();
  const enviados = [];
  const borrados = [];
  const dispositivos = [
    { docId: 'YBC1_a', yonkeId: 'YBC1', token: 'tok-bc1-a' },
    { docId: 'YBC1_b', yonkeId: 'YBC1', token: 'tok-bc1-b' },
    { docId: 'YBC2_a', yonkeId: 'YBC2', token: 'tok-bc2' },
    { docId: 'YJ_a', yonkeId: 'YJ', token: 'tok-jal' },
    { docId: 'YS_a', yonkeId: 'YS', token: 'tok-son-sin-interruptor' },
  ];
  const deps = {
    habilitado: vi.fn(async () => habilitado),
    cliente: vi.fn(() => (cliente === null ? null : {
      enviar: vi.fn(async (token, datos) => {
        enviados.push({ token, datos });
        return typeof cliente === 'function' ? cliente(token) : cliente;
      }),
    })),
    yonkesDelEstado: vi.fn(async (_db, estado) => (estado === 'baja-california' ? [{ id: 'YBC1' }, { id: 'YBC2' }, { id: 'YBC3' }] : [])),
    yonkesOtrosEstados: vi.fn(async () => [
      { id: 'YJ', estado: 'jalisco', ...conEnvio },
      { id: 'YS', estado: 'sonora', ...conEnvio, verAlertasOtrosEstados: false },
      { id: 'YBC1', estado: 'baja-california', ...conEnvio },
    ]),
    dispositivosDe: vi.fn(async (_db, ids) => dispositivos.filter((d) => ids.includes(d.yonkeId))),
    borrarDispositivo: vi.fn(async (_db, docId) => { borrados.push(docId); }),
    contar: contar ?? vi.fn(async (_db, clave, max) => {
      const n = contadores.get(clave) || 0;
      if (n >= max) return false;
      contadores.set(clave, n + 1);
      return true;
    }),
    claveLimite: (tipo, valor, ventana) => `${tipo}_${valor}_${ventana}`,
    ahora: () => new Date('2026-10-12T18:00:00Z'),
  };
  return { deps, enviados, borrados };
}

describe('texto y pantalla del aviso', () => {
  it('solo pieza y vehículo; nada del cliente ni del taller', () => {
    expect(textoAviso('alertaCliente', ALERTA)).toEqual({ titulo: 'Nueva búsqueda activa', cuerpo: 'Alternador · Nissan Sentra 2005' });
    expect(textoAviso('pedidoTaller', { ...TALLER, tallerNombre: 'Taller X', whatsapp: '6641234567' })).toEqual({ titulo: 'Nuevo pedido de un taller', cuerpo: 'Faro · Ford Focus 2012' });
  });
  it('al tocarlo abre Pedidos (con la alerta, si es de un cliente)', () => {
    expect(urlAviso('alertaCliente', 'Pedido0001')).toBe('/panel/reservaciones?pedido=Pedido0001');
    expect(urlAviso('pedidoTaller', 'S1')).toBe('/panel/reservaciones');
    expect(urlAviso('alertaCliente', '../x?<script>')).toBe('/panel/reservaciones');
  });
  it('otros estados: Verificado + Envíos nacionales + interruptor + activo, y de otro estado', () => {
    expect(veAlertaDeOtroEstado({ estado: 'jalisco', ...conEnvio }, 'baja-california')).toBe(true);
    expect(veAlertaDeOtroEstado({ estado: 'baja-california', ...conEnvio }, 'baja-california')).toBe(false);
    for (const falta of ['activo', 'verificado', 'enviosNacionales', 'verAlertasOtrosEstados']) {
      expect(veAlertaDeOtroEstado({ estado: 'jalisco', ...conEnvio, [falta]: false }, 'baja-california')).toBe(false);
    }
  });
});

describe('falla cerrada', () => {
  it('sin config/notificaciones.habilitado: no lee yonkes ni manda nada', async () => {
    const f = falsos({ habilitado: false });
    expect(await crearAvisarYonkes(f.deps)(DB, ALERTA)).toEqual({ enviados: 0, motivo: 'apagado' });
    expect(f.deps.yonkesDelEstado).not.toHaveBeenCalled();
    expect(f.enviados).toHaveLength(0);
  });
  it('sin credenciales de FCM: tampoco', async () => {
    const f = falsos({ cliente: null });
    expect(await crearAvisarYonkes(f.deps)(DB, ALERTA)).toEqual({ enviados: 0, motivo: 'sinCredenciales' });
    expect(f.deps.yonkesDelEstado).not.toHaveBeenCalled();
  });
  it('sin db (identidad de servicio no disponible): nada', async () => {
    const f = falsos();
    expect((await crearAvisarYonkes(f.deps)(null, ALERTA)).enviados).toBe(0);
  });
});

describe('a quién se avisa', () => {
  it('alerta de cliente: a todos los dispositivos de los yonkes activos de su estado', async () => {
    const f = falsos();
    const r = await crearAvisarYonkes(f.deps)(DB, ALERTA);
    expect(r).toEqual({ enviados: 3, borrados: 0 });
    expect(f.enviados.map((e) => e.token).sort()).toEqual(['tok-bc1-a', 'tok-bc1-b', 'tok-bc2']);
    expect(f.deps.yonkesOtrosEstados).not.toHaveBeenCalled();
    expect(f.enviados[0].datos).toEqual({ titulo: 'Nueva búsqueda activa', cuerpo: 'Alternador · Nissan Sentra 2005', url: '/panel/reservaciones?pedido=Pedido0001', etiqueta: 'mecanix-alertas' });
  });
  it('alerta que acepta otros estados: suma a los que cumplen la regla (sin repetir a los del estado)', async () => {
    const f = falsos();
    await crearAvisarYonkes(f.deps)(DB, { ...ALERTA, incluirOtrosEstados: true });
    expect(f.enviados.map((e) => e.token).sort()).toEqual(['tok-bc1-a', 'tok-bc1-b', 'tok-bc2', 'tok-jal']);
  });
  it('pedido de taller: solo su estado, aunque se pidan otros estados', async () => {
    const f = falsos();
    await crearAvisarYonkes(f.deps)(DB, { ...TALLER, incluirOtrosEstados: true });
    expect(f.enviados.map((e) => e.token).sort()).toEqual(['tok-bc1-a', 'tok-bc1-b', 'tok-bc2']);
    expect(f.enviados[0].datos.etiqueta).toBe('mecanix-pedidos-talleres');
    expect(f.deps.yonkesOtrosEstados).not.toHaveBeenCalled();
  });
  it('un estado sin yonkes: no busca dispositivos', async () => {
    const f = falsos();
    expect((await crearAvisarYonkes(f.deps)(DB, { ...ALERTA, estado: 'colima' })).motivo).toBe('sinYonkes');
    expect(f.deps.dispositivosDe).not.toHaveBeenCalled();
  });
  it('solo cuenta el límite de yonkes que sí tienen dispositivos (YBC3 no tiene: no gasta escrituras)', async () => {
    const f = falsos();
    await crearAvisarYonkes(f.deps)(DB, ALERTA);
    expect(f.deps.contar.mock.calls.map(([, clave]) => clave.split('_')[1]).sort()).toEqual(['YBC1', 'YBC2']);
  });
});

describe('límite por yonke por hora', () => {
  it(`máximo ${MAX_AVISOS_PUSH_YONKE_HORA} avisos por yonke por hora`, async () => {
    expect(MAX_AVISOS_PUSH_YONKE_HORA).toBe(10);
    const f = falsos();
    const avisar = crearAvisarYonkes(f.deps);
    for (let i = 0; i < 12; i++) await avisar(DB, TALLER);
    expect(f.enviados.filter((e) => e.token === 'tok-bc2')).toHaveLength(10);
  });
  it('si el contador falla, a ese yonke no se le avisa (falla cerrada)', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const f = falsos({ contar: vi.fn(async () => { throw new Error('cuota'); }) });
    expect((await crearAvisarYonkes(f.deps)(DB, ALERTA)).enviados).toBe(0);
  });
});

describe('limpieza y errores', () => {
  it('token rechazado por Firebase: se borra ese dispositivo; error temporal: no se borra', async () => {
    const f = falsos({ cliente: (token) => (token === 'tok-bc1-b' ? 'invalido' : token === 'tok-bc2' ? 'error' : 'ok') });
    const r = await crearAvisarYonkes(f.deps)(DB, ALERTA);
    expect(r).toEqual({ enviados: 1, borrados: 1 });
    expect(f.borrados).toEqual(['YBC1_b']);
  });
  it('nunca lanza, aunque falle Firestore', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const f = falsos();
    f.deps.yonkesDelEstado = vi.fn(async () => { throw new Error('quota exceeded'); });
    expect(await crearAvisarYonkes(f.deps)(DB, ALERTA)).toEqual({ enviados: 0, motivo: 'error' });
  });
  it('si FCM se tarda demasiado, regresa a los 8 segundos sin trabar la ruta', async () => {
    vi.useFakeTimers();
    const f = falsos();
    f.deps.cliente = () => ({ enviar: () => new Promise(() => {}) });
    const promesa = crearAvisarYonkes(f.deps)(DB, ALERTA);
    await vi.advanceTimersByTimeAsync(8000);
    expect(await promesa).toEqual({ motivo: 'tiempo' });
    vi.useRealTimers();
  });
});
