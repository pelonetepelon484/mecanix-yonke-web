import { describe, expect, it, vi } from 'vitest';
import { crearManejadorComparador, diaDe } from './manejador';
import { decodificarVpic } from './vpic';
import { aplicaA } from './servicio';
import { MENSAJES_COMPARADOR, RESULTADOS } from '../../../lib/comparadorPiezas';
import { banderasComparador } from '../../../lib/configComparador';

vi.mock('../firebase-server', () => ({ dbServer: {} }));
vi.mock('../pedidosClientes/servicio', () => ({ obtenerDbServicio: async () => null }));

const AHORA = new Date('2026-11-07T20:00:00Z');
const VIN_A = '3N1CN7AP5FL812345';
const VIN_B = '3N1CN7AP7FL899999';
const FILA = { Make: 'NISSAN', Model: 'Versa', ModelYear: '2015', DisplacementL: '1.6', EngineCylinders: '4', FuelTypePrimary: 'Gasoline', DriveType: 'FWD' };

function peticion({ ip = '1.2.3.4', token = null } = {}) {
  const h = new Map([['x-forwarded-for', `${ip}, 10.0.0.1`]]);
  if (token) h.set('authorization', `Bearer ${token}`);
  return { headers: { get: (k) => h.get(k.toLowerCase()) ?? null } };
}

function armar(cambios = {}, config = { habilitado: true }) {
  const cuentas = {};
  const deps = {
    leerConfig: vi.fn(async () => banderasComparador(config)),
    obtenerDb: vi.fn(async () => ({})),
    uidDeToken: vi.fn(async (t) => (t === 'pase-taller' ? 'U1' : null)),
    leerRol: vi.fn(async () => 'taller'),
    hash: vi.fn((t) => `h(${t})`),
    contarLimite: vi.fn(async (_db, id, max) => { cuentas[id] = (cuentas[id] || 0) + 1; return cuentas[id] <= max; }),
    devolverLimite: vi.fn(async (_db, id) => { cuentas[id] -= 1; }),
    leerCacheVin: vi.fn(async () => null),
    guardarCacheVin: vi.fn(async () => {}),
    decodificar: vi.fn(async () => ({ estado: 'ok', fila: FILA })),
    buscarRegistros: vi.fn(async () => ({ equivalentes: false, aplicacion: false })),
    sumarUso: vi.fn(async () => {}),
    sugerirEquivalencia: vi.fn(async () => {}),
    enSegundoPlano: vi.fn((tarea) => tarea()),
    ahora: () => AHORA,
    ...cambios,
  };
  return { deps, cuentas, atender: crearManejadorComparador(deps) };
}

const cuerpo = (extra = {}) => ({ tipo: 'motor', vinA: VIN_A, vinB: VIN_B, dispositivo: 'disp-1234567890abcdef', ...extra });

describe('api/comparador', () => {
  it('bandera apagada: 404 sin tocar nada', async () => {
    const { deps, atender } = armar({}, { habilitado: false });
    expect((await atender(peticion(), cuerpo())).status).toBe(404);
    expect(deps.obtenerDb).not.toHaveBeenCalled();
    expect(deps.decodificar).not.toHaveBeenCalled();
  });

  it('compara dos VIN: manda a vPIC la clave sin número de serie, guarda el caché y cuenta el uso', async () => {
    const { deps, atender } = armar();
    const r = await atender(peticion(), cuerpo());
    expect(r.status).toBe(200);
    expect(deps.decodificar).toHaveBeenCalledWith('3N1CN7AP*FL');
    expect(deps.decodificar).toHaveBeenCalledTimes(2);
    expect(JSON.stringify(deps.decodificar.mock.calls)).not.toMatch(/812345|899999/);
    expect(deps.guardarCacheVin).toHaveBeenCalledWith({}, '3N1CN7AP*FL', expect.objectContaining({ marca: 'NISSAN', sinDatos: false }));
    expect(r.json.resultado).toBe(RESULTADOS.probable);
    expect(r.json.vehiculoA).toMatchObject({ vin: '3N1CN7AP5FL••••••', estado: 'ok' });
    expect(JSON.stringify(r.json)).not.toMatch(/812345|899999/);
    expect(r.json.comparacion.porcentaje).toBeGreaterThan(0);
    expect(deps.sumarUso).toHaveBeenCalledWith({}, '2026-11-07', { consultas: 1, vinNuevos: 2, vinCache: 0, vinFallos: 0 });
  });

  it('VIN en caché: no llama a vPIC', async () => {
    const { deps, atender } = armar({ leerCacheVin: async () => ({ marca: 'NISSAN', anio: '2015', cilindrada: '1.6', cilindros: '4', sinDatos: false }) });
    await atender(peticion(), cuerpo());
    expect(deps.decodificar).not.toHaveBeenCalled();
    expect(deps.sumarUso.mock.calls[0][2]).toMatchObject({ vinCache: 2, vinNuevos: 0 });
  });

  it('VIN sin datos: "sin datos" (se guarda para no repetir) y no se puede determinar', async () => {
    const { deps, atender } = armar({ decodificar: async () => ({ estado: 'ok', fila: { Make: '', ModelYear: '' } }) });
    const r = await atender(peticion(), cuerpo());
    expect(r.status).toBe(200);
    expect(r.json.vehiculoA.estado).toBe('sin_datos');
    expect(r.json.vehiculoA.datos).toBeNull();
    expect(r.json.resultado).toBe(RESULTADOS.indeterminado);
    expect(deps.guardarCacheVin.mock.calls[0][2].sinDatos).toBe(true);
  });

  it('si vPIC no responde: sin datos, no se guarda en caché y la consulta se devuelve', async () => {
    const { deps, cuentas, atender } = armar({ decodificar: async () => ({ estado: 'fallo' }) });
    const r = await atender(peticion(), cuerpo());
    expect(r.status).toBe(200);
    expect(r.json.vehiculoA.estado).toBe('sin_datos');
    expect(deps.guardarCacheVin).not.toHaveBeenCalled();
    expect(Object.values(cuentas).every((n) => n === 0)).toBe(true);
  });

  it('sin cuenta: 5 al día por IP y por navegador (hash, nunca la IP); al sexto, mensaje amable', async () => {
    const { deps, atender } = armar();
    for (let i = 0; i < 5; i += 1) expect((await atender(peticion(), cuerpo())).status).toBe(200);
    const r = await atender(peticion(), cuerpo());
    expect(r).toEqual({ status: 429, json: { error: MENSAJES_COMPARADOR.limite, limite: true, conCuenta: false } });
    expect(deps.sumarUso).toHaveBeenLastCalledWith({}, '2026-11-07', { limiteAlcanzado: 1 });
    const ids = deps.contarLimite.mock.calls.map((c) => c[1]);
    expect(ids).toContain('ip_h(1.2.3.4)_2026-11-07');
    expect(ids).toContain('disp_h(disp-1234567890abcdef)_2026-11-07');
    // Otro navegador desde la misma IP también se detiene (límite por IP).
    expect((await atender(peticion(), cuerpo({ dispositivo: 'otro-dispositivo-123456' }))).status).toBe(429);
    // Otra IP con el mismo navegador, también (límite por navegador).
    expect((await atender(peticion({ ip: '5.6.7.8' }), cuerpo())).status).toBe(429);
  });

  it('el límite se lee de config/comparador (sin publicar de nuevo)', async () => {
    const { atender } = armar({}, { habilitado: true, limiteDiarioIp: 1 });
    expect((await atender(peticion(), cuerpo())).status).toBe(200);
    expect((await atender(peticion(), cuerpo())).status).toBe(429);
  });

  it('con sesión de yonke o taller: 20 al día por cuenta; otros roles cuentan como sin cuenta', async () => {
    const { deps, atender } = armar();
    for (let i = 0; i < 20; i += 1) expect((await atender(peticion({ token: 'pase-taller' }), cuerpo())).status).toBe(200);
    const r = await atender(peticion({ token: 'pase-taller' }), cuerpo());
    expect(r.json).toEqual({ error: MENSAJES_COMPARADOR.limiteCuenta, limite: true, conCuenta: true });
    expect(deps.contarLimite.mock.calls[0][1]).toBe('cuenta_h(U1)_2026-11-07');

    const otro = armar({ leerRol: async () => 'yonkeLigero' });
    await otro.atender(peticion({ token: 'pase-taller' }), cuerpo());
    expect(otro.deps.contarLimite.mock.calls[0][1]).toMatch(/^ip_/);
  });

  it('requerir login: sin sesión válida, 401; con sesión de taller, sí', async () => {
    const config = { habilitado: true, requiereLogin: true };
    const { deps, atender } = armar({}, config);
    expect(await atender(peticion(), cuerpo())).toEqual({ status: 401, json: { error: MENSAJES_COMPARADOR.login, requiereLogin: true } });
    expect((await atender(peticion({ token: 'pase-falso' }), cuerpo())).status).toBe(401);
    expect(deps.decodificar).not.toHaveBeenCalled();
    expect((await atender(peticion({ token: 'pase-taller' }), cuerpo())).status).toBe(200);
  });

  it('falla cerrada: sin usuario de servicio (503) o si falla el contador (503)', async () => {
    expect((await armar({ obtenerDb: async () => null }).atender(peticion(), cuerpo())).status).toBe(503);
    const roto = armar({ contarLimite: async () => { throw new Error('x'); } });
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect((await roto.atender(peticion(), cuerpo())).status).toBe(503);
    expect(roto.deps.decodificar).not.toHaveBeenCalled();
    error.mockRestore();
  });

  it('entrada inválida: 400 sin contar', async () => {
    const { deps, atender } = armar();
    expect((await atender(peticion(), { tipo: 'motor', vinA: 'corto', vinB: VIN_B })).status).toBe(400);
    expect(deps.contarLimite).not.toHaveBeenCalled();
  });

  it('números de parte: pasan normalizados a los registros', async () => {
    const { deps, atender } = armar({ buscarRegistros: vi.fn(async () => ({ equivalentes: true, aplicacion: false })) });
    const r = await atender(peticion(), { tipo: 'bcm', parteA: 'ab-123', parteB: 'xy 789' });
    expect(deps.buscarRegistros.mock.calls[0][1]).toMatchObject({ parteA: 'AB123', parteB: 'XY789', claveA: null, claveB: null });
    expect(r.json.resultado).toBe(RESULTADOS.registros);
    expect(deps.decodificar).not.toHaveBeenCalled();
  });

  it('día en hora de Tijuana', () => {
    expect(diaDe(new Date('2026-11-08T05:00:00Z'))).toBe('2026-11-07');
    expect(diaDe(new Date('2026-11-08T09:00:00Z'))).toBe('2026-11-08');
  });
});

describe('vPIC', () => {
  it('ok, fallo de red y respuesta rara', async () => {
    const ok = vi.fn(async () => ({ ok: true, json: async () => ({ Results: [FILA] }) }));
    expect(await decodificarVpic('3N1CN7AP*FL', ok)).toEqual({ estado: 'ok', fila: FILA });
    expect(ok.mock.calls[0][0]).toBe('https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues/3N1CN7AP*FL?format=json');
    const aviso = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(await decodificarVpic('3N1CN7AP*FL', async () => { throw new Error('red'); })).toEqual({ estado: 'fallo' });
    aviso.mockRestore();
    expect(await decodificarVpic('3N1CN7AP*FL', async () => ({ ok: false }))).toEqual({ estado: 'fallo' });
    expect(await decodificarVpic('3N1CN7AP*FL', async () => ({ ok: true, json: async () => ({}) }))).toEqual({ estado: 'fallo' });
    expect(await decodificarVpic('3N1CN7AP5FL812345', ok)).toEqual({ estado: 'sin_datos' });
  });
});

describe('registros "aplicacion"', () => {
  it('por clave de VIN o por marca, modelo y rango de años', () => {
    const veh = { marca: 'NISSAN', modelo: 'Versa', anio: '2015', sinDatos: false };
    expect(aplicaA({ claveVin: '3N1CN7AP*FL' }, '3N1CN7AP*FL', null)).toBe(true);
    expect(aplicaA({ marca: 'nissan', modelo: 'versa', anioDesde: 2012, anioHasta: 2019 }, null, veh)).toBe(true);
    expect(aplicaA({ marca: 'NISSAN', modelo: 'Versa', anioDesde: 2016, anioHasta: 2019 }, null, veh)).toBe(false);
    expect(aplicaA({ marca: 'NISSAN', modelo: 'Versa' }, null, veh)).toBe(false);
  });

  describe('búsqueda automática de equivalencias', () => {
    const partes = (extra = {}) => ({ tipo: 'computadora', parteA: '12605843', parteB: '19210736', dispositivo: 'disp-1234567890abcdef', ...extra });

    it('apagada por defecto: no busca aunque los números sean distintos', async () => {
      const { deps, atender } = armar();
      const r = await atender(peticion(), partes());
      expect(r.json.resultado.key).toBe('indeterminado');
      expect(deps.enSegundoPlano).not.toHaveBeenCalled();
      expect(deps.sugerirEquivalencia).not.toHaveBeenCalled();
    });

    it('encendida: busca la pareja después de responder, con el límite diario de la config', async () => {
      const { deps, atender } = armar({}, { habilitado: true, sugerenciasIA: true, limiteDiarioIA: 7 });
      const r = await atender(peticion(), partes());
      expect(r.status).toBe(200);
      expect(r.json.resultado.key).toBe('indeterminado');
      expect(JSON.stringify(r.json)).not.toMatch(/sugerencia/i);
      expect(deps.sugerirEquivalencia).toHaveBeenCalledWith({}, { tipo: 'computadora', parteA: '12605843', parteB: '19210736', dia: '2026-11-07', limiteDiario: 7 });
    });

    it('encendida: no busca si ya hay registro, si los números son iguales o si es por VIN', async () => {
      const conRegistro = armar({ buscarRegistros: vi.fn(async () => ({ equivalentes: true, aplicacion: false })) }, { habilitado: true, sugerenciasIA: true });
      await conRegistro.atender(peticion(), partes());
      expect(conRegistro.deps.sugerirEquivalencia).not.toHaveBeenCalled();

      const iguales = armar({}, { habilitado: true, sugerenciasIA: true });
      await iguales.atender(peticion(), partes({ parteB: '12605843' }));
      expect(iguales.deps.sugerirEquivalencia).not.toHaveBeenCalled();

      const porVin = armar({}, { habilitado: true, sugerenciasIA: true });
      await porVin.atender(peticion(), cuerpo());
      expect(porVin.deps.sugerirEquivalencia).not.toHaveBeenCalled();
    });
  });
});
