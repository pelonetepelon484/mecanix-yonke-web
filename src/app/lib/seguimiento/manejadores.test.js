import { describe, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { crearManejadoresSeguimiento, MAX_CONSULTAS_SEGUIMIENTO_MINUTO } from './manejadores';
import { MENSAJES_SEGUIMIENTO } from '../../../lib/seguimiento';

const AHORA = new Date('2026-10-22T12:00:00Z');
const TOKEN = 'T'.repeat(40) + 'a_-';
const HUELLA = createHash('sha256').update(TOKEN).digest('hex');
const ts = (d) => ({ toMillis: () => d.getTime(), toDate: () => d });
const DOC = {
  tallerId: 'T1', folio: 'O261020-ABCD', tallerNombre: 'Taller Peña', tallerWhatsapp: '6641234567',
  marca: 'Nissan', modelo: 'Sentra', anio: 2001, estado: 'reparacion', nota: 'Mañana queda',
  actualizadoAt: ts(AHORA), expiraAt: ts(new Date(AHORA.getTime() + 86400000)),
};

function armar(extra = {}) {
  const deps = {
    obtenerDb: vi.fn(async () => ({})),
    habilitado: vi.fn(async () => true),
    leerSeguimiento: vi.fn(async (_db, h) => (h === HUELLA ? DOC : null)),
    hashCodigo: (t) => createHash('sha256').update(t).digest('hex'),
    claveLimite: (tipo, valor, ventana) => `${tipo}_${valor}_${ventana}`,
    ahora: () => AHORA,
    ...extra,
  };
  return { deps, m: crearManejadoresSeguimiento(deps) };
}
const req = (ip = '1.1.1.1') => new Request('https://www.mecanixyonkevirtual.com/api/seguimiento/x', { headers: { 'x-forwarded-for': ip } });

describe('GET /api/seguimiento/{token}', () => {
  it('con el token correcto: solo la lista blanca, sin caché, noindex y sin referer', async () => {
    const { m, deps } = armar();
    const r = await m.consultar(req(), TOKEN);
    expect(r.status).toBe(200);
    expect(r.headers.get('Cache-Control')).toBe('no-store');
    expect(r.headers.get('X-Robots-Tag')).toBe('noindex');
    expect(r.headers.get('Referrer-Policy')).toBe('no-referrer');
    const cuerpo = await r.json();
    expect(Object.keys(cuerpo.seguimiento).sort()).toEqual(['actualizadoAt', 'anio', 'estado', 'estadoNombre', 'marca', 'modelo', 'nota', 'tallerNombre', 'tallerWhatsapp']);
    expect(JSON.stringify(cuerpo)).not.toMatch(/O261020|tallerId|folio|expiraAt/);
    expect(deps.leerSeguimiento).toHaveBeenCalledWith({}, HUELLA);
  });
  it('mal formado, no existe, vencido o documento raro: la MISMA respuesta "no encontrado"', async () => {
    const respuestas = [];
    for (const [token, extra] of [
      ['corto', {}],
      ['X'.repeat(43), {}],
      [TOKEN, { leerSeguimiento: async () => ({ ...DOC, expiraAt: ts(AHORA) }) }],
      [TOKEN, { leerSeguimiento: async () => ({ ...DOC, estado: 'otro' }) }],
    ]) {
      const r = await armar(extra).m.consultar(req(), token);
      respuestas.push([r.status, await r.text()]);
    }
    expect(respuestas.every(([s, t]) => s === 404 && t === respuestas[0][1])).toBe(true);
    expect(JSON.parse(respuestas[0][1])).toEqual({ ok: false, mensaje: MENSAJES_SEGUIMIENTO.noEncontrado });
  });
  it('un token mal formado no llega a Firestore', async () => {
    const { m, deps } = armar();
    await m.consultar(req(), '../config/ordenes');
    expect(deps.leerSeguimiento).not.toHaveBeenCalled();
  });
  it('bandera apagada, sin identidad de servicio o si la bandera no se puede leer: "no disponible" (503)', async () => {
    for (const extra of [{ habilitado: async () => false }, { obtenerDb: async () => null }, { habilitado: async () => { throw new Error('x'); } }]) {
      const { m, deps } = armar(extra);
      const r = await m.consultar(req(), TOKEN);
      expect(r.status).toBe(503);
      expect(deps.leerSeguimiento).not.toHaveBeenCalled();
    }
  });
  it(`límite: ${MAX_CONSULTAS_SEGUIMIENTO_MINUTO} consultas por minuto por IP; otra IP sigue`, async () => {
    const { m } = armar();
    for (let i = 0; i < MAX_CONSULTAS_SEGUIMIENTO_MINUTO; i++) expect((await m.consultar(req('9.9.9.9'), TOKEN)).status).toBe(200);
    const r = await m.consultar(req('9.9.9.9'), TOKEN);
    expect(r.status).toBe(429);
    expect((await r.json()).mensaje).toBe(MENSAJES_SEGUIMIENTO.limiteConsultas);
    expect((await m.consultar(req('8.8.8.8'), TOKEN)).status).toBe(200);
  });
  it('si Firestore falla al leer: 500 sin detalles', async () => {
    const { m } = armar({ leerSeguimiento: async () => { throw new Error('permiso'); } });
    const r = await m.consultar(req(), TOKEN);
    expect(r.status).toBe(500);
    expect(await r.json()).toEqual({ ok: false, mensaje: MENSAJES_SEGUIMIENTO.noDisponible });
  });
});
