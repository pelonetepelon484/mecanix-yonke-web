import { describe, expect, it, vi } from 'vitest';
import { crearManejadorAqui } from './aqui';
import { MENSAJES_UBICACION } from '../../../lib/ubicacionAsistencia';

const AHORA = new Date(2026, 10, 6, 14, 0).getTime();
const SECRETO = 'A'.repeat(43);
const ts = (ms) => ({ toMillis: () => ms });

function armar(cambios = {}) {
  const deps = {
    leerBanderas: vi.fn(async () => ({ asistenciaVialActiva: true, asistenciaVialMapa: true })),
    obtenerDb: vi.fn(async () => ({})),
    hash: vi.fn(() => 'HUELLA'),
    leerCheckin: vi.fn(async () => ({ proveedorId: 'P1' })),
    leerProveedor: vi.fn(async () => ({ nombre: 'Grúas El Güero', activo: true })),
    leerUbicacion: vi.fn(async () => null),
    guardarUbicacion: vi.fn(async () => {}),
    borrarUbicacion: vi.fn(async () => {}),
    ahora: () => AHORA,
    ...cambios,
  };
  return { deps, atender: crearManejadorAqui(deps) };
}

describe('api/asistencia-vial/aqui', () => {
  it('llegué: guarda la ubicación redondeada hasta la hora escogida', async () => {
    const { deps, atender } = armar();
    const r = await atender({ secreto: SECRETO, accion: 'llegue', lat: 32.51493, lng: -117.03821, minutos: 45 });
    expect(r).toEqual({ status: 200, json: { ok: true, hastaMs: AHORA + 45 * 60000 } });
    expect(deps.hash).toHaveBeenCalledWith(SECRETO);
    expect(deps.leerCheckin).toHaveBeenCalledWith({}, 'HUELLA');
    expect(deps.guardarUbicacion).toHaveBeenCalledWith({}, 'P1', { lat: 32.514, lng: -117.039, hastaMs: AHORA + 45 * 60000 });
  });
  it('estado: nombre y hasta cuándo (si sigue vigente)', async () => {
    const { atender } = armar({ leerUbicacion: async () => ({ lat: 32.5, lng: -117, hastaAt: ts(AHORA + 60000), actualizadoAt: ts(AHORA - 60000) }) });
    expect(await atender({ secreto: SECRETO, accion: 'estado' })).toEqual({ status: 200, json: { nombre: 'Grúas El Güero', hastaMs: AHORA + 60000 } });
    const vencida = armar({ leerUbicacion: async () => ({ lat: 32.5, lng: -117, hastaAt: ts(AHORA - 1) }) });
    expect((await vencida.atender({ secreto: SECRETO, accion: 'estado' })).json.hastaMs).toBeNull();
  });
  it('me fui: se quita del mapa', async () => {
    const { deps, atender } = armar();
    expect(await atender({ secreto: SECRETO, accion: 'me-fui' })).toEqual({ status: 200, json: { ok: true, hastaMs: null } });
    expect(deps.borrarUbicacion).toHaveBeenCalledWith({}, 'P1');
  });
  it('secreto o acción inválidos: no consulta nada', async () => {
    const { deps, atender } = armar();
    for (const body of [null, {}, { secreto: 'corto', accion: 'estado' }, { secreto: SECRETO, accion: 'borrar-todo' }]) {
      expect((await atender(body)).status).toBe(400);
    }
    expect(deps.leerBanderas).not.toHaveBeenCalled();
  });
  it('falla cerrada: sin banderas, sin usuario de servicio, enlace desconocido o proveedor inactivo', async () => {
    const casos = [
      [{ leerBanderas: async () => ({ asistenciaVialActiva: true, asistenciaVialMapa: false }) }, 404, MENSAJES_UBICACION.noDisponible],
      [{ leerBanderas: async () => ({ asistenciaVialActiva: false, asistenciaVialMapa: true }) }, 404, MENSAJES_UBICACION.noDisponible],
      [{ obtenerDb: async () => null }, 503, MENSAJES_UBICACION.noDisponible],
      [{ leerCheckin: async () => null }, 404, MENSAJES_UBICACION.enlaceInvalido],
      [{ leerProveedor: async () => ({ activo: false }) }, 404, MENSAJES_UBICACION.enlaceInvalido],
    ];
    for (const [cambio, status, error] of casos) {
      const { deps, atender } = armar(cambio);
      expect(await atender({ secreto: SECRETO, accion: 'llegue', lat: 32.5, lng: -117, minutos: 30 })).toEqual({ status, json: { error } });
      expect(deps.guardarUbicacion).not.toHaveBeenCalled();
    }
  });
  it('valida tiempo y zona, y pide esperar si tocó hace unos segundos', async () => {
    const { atender } = armar();
    expect((await atender({ secreto: SECRETO, accion: 'llegue', lat: 32.5, lng: -117, minutos: 240 })).json.error).toBe(MENSAJES_UBICACION.tiempo);
    expect((await atender({ secreto: SECRETO, accion: 'llegue', lat: 19.4, lng: -99.1, minutos: 30 })).json.error).toBe(MENSAJES_UBICACION.fueraDeZona);
    const reciente = armar({ leerUbicacion: async () => ({ actualizadoAt: ts(AHORA - 5000) }) });
    expect((await reciente.atender({ secreto: SECRETO, accion: 'llegue', lat: 32.5, lng: -117, minutos: 30 })).status).toBe(429);
  });
  it('si Firestore falla: 500 con mensaje en español, sin el secreto en el registro', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { atender } = armar({ guardarUbicacion: async () => { throw Object.assign(new Error('x'), { code: 'permission-denied' }); } });
    expect(await atender({ secreto: SECRETO, accion: 'llegue', lat: 32.5, lng: -117, minutos: 30 })).toEqual({ status: 500, json: { error: MENSAJES_UBICACION.fallo } });
    expect(JSON.stringify(error.mock.calls)).not.toContain(SECRETO);
    error.mockRestore();
  });
});
