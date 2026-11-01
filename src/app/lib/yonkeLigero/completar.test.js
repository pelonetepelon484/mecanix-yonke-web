import { describe, expect, it, vi } from 'vitest';
import { MENSAJES_COMPLETAR, validarCompletarRegistro } from '../../../lib/yonkeLigero';
import { crearManejadorCompletar } from './completar';

const PASES = { 'pase-ligero': 'l1', 'pase-otro': 'l2', 'pase-yonke': 'c1', 'pase-taller': 't1', 'pase-ajeno': 'l3' };
const docs = {
  'usuarios/l1': { rol: 'yonkeLigero', yonkeId: 'YL' },
  'usuarios/l2': { rol: 'yonkeLigero', yonkeId: 'YJ' },
  'usuarios/l3': { rol: 'yonkeLigero', yonkeId: 'YL' }, // apunta a una ficha que no es suya
  'usuarios/c1': { rol: 'yonke', yonkeId: 'Y1' },
  'usuarios/t1': { rol: 'taller', tallerId: 'T1' },
  'yonkes/YL': { ownerUid: 'l1', nombre: 'Yonke Ligero', estado: 'baja-california', tipoRegistro: 'ligero' },
  'yonkes/YJ': { ownerUid: 'l2', nombre: 'Yonke Jalisco', estado: 'jalisco', tipoRegistro: 'ligero' },
  'yonkes/Y1': { ownerUid: 'c1', nombre: 'Completo', estado: 'baja-california' },
};
function crearFalsos(cambios = {}) {
  const deps = {
    uidDeToken: vi.fn(async (t) => PASES[t] ?? null),
    leerComoUsuario: vi.fn(async (_t, ruta) => docs[ruta] ?? null),
    obtenerDb: vi.fn(async () => ({ falso: true })),
    guardar: vi.fn(async () => {}),
    notificar: vi.fn(async () => {}),
    ...cambios,
  };
  return { deps, m: crearManejadorCompletar(deps) };
}
const bien = { ciudad: 'tijuana', direccion: 'Calle 1', telefono: '664 123 4567' };
const peticion = (cuerpo = bien, token = 'pase-ligero') => new Request('https://x.mx/api/yonkes/completar-registro', {
  method: 'POST', headers: token ? { authorization: `Bearer ${token}` } : {}, body: typeof cuerpo === 'string' ? cuerpo : JSON.stringify(cuerpo),
});

describe('validarCompletarRegistro', () => {
  it('en Baja California la ciudad debe ser de la lista; en otros estados es libre', () => {
    expect(validarCompletarRegistro(bien, 'baja-california').datos.ciudad).toBe('tijuana');
    expect(validarCompletarRegistro({ ...bien, ciudad: 'Guadalajara' }, 'baja-california').error).toBe(MENSAJES_COMPLETAR.ciudad);
    expect(validarCompletarRegistro({ ...bien, ciudad: 'Guadalajara' }, 'jalisco').datos.ciudad).toBe('Guadalajara');
    expect(validarCompletarRegistro({ ...bien, ciudad: '  ' }, 'jalisco').error).toBe(MENSAJES_COMPLETAR.ciudad);
  });
  it('dirección y teléfono obligatorios; correo opcional pero válido', () => {
    expect(validarCompletarRegistro({ ...bien, direccion: ' ' }, 'baja-california').error).toBe(MENSAJES_COMPLETAR.direccion);
    expect(validarCompletarRegistro({ ...bien, direccion: 'd'.repeat(301) }, 'baja-california').error).toBe(MENSAJES_COMPLETAR.direccion);
    expect(validarCompletarRegistro({ ...bien, telefono: '123' }, 'baja-california').error).toBe(MENSAJES_COMPLETAR.telefono);
    expect(validarCompletarRegistro({ ...bien, correo: 'malo' }, 'baja-california').error).toBe(MENSAJES_COMPLETAR.correo);
    expect(validarCompletarRegistro({ ...bien, correo: ' a@b.mx ' }, 'baja-california').datos.correo).toBe('a@b.mx');
    expect(validarCompletarRegistro(bien, 'baja-california').datos.correo).toBe('');
  });
});

describe('completar el registro', () => {
  it('guarda con su uid y su yonke, y avisa al admin', async () => {
    const f = crearFalsos();
    const r = await f.m(peticion({ ...bien, correo: 'a@b.mx' }));
    expect(await r.json()).toEqual({ ok: true });
    expect(f.deps.guardar.mock.calls[0][1]).toEqual({ uid: 'l1', yonkeId: 'YL', ciudad: 'tijuana', direccion: 'Calle 1', telefono: '664 123 4567', correo: 'a@b.mx' });
    expect(f.deps.notificar.mock.calls[0][0]).toContain('Yonke Ligero');
  });
  it('otro estado: ciudad libre, según SU ficha y no lo que mande', async () => {
    const f = crearFalsos();
    expect((await f.m(peticion({ ...bien, ciudad: 'Guadalajara', estado: 'baja-california' }, 'pase-otro'))).status).toBe(200);
    expect((await f.m(peticion({ ...bien, ciudad: 'Guadalajara', estado: 'jalisco' }))).status).toBe(400);
  });
  it('no se pueden colar otros datos', async () => {
    const f = crearFalsos();
    await f.m(peticion({ ...bien, nombre: 'Otro', whatsapp: '6649999999', estado: 'sonora', verificado: true, plan: 'premium', yonkeId: 'Y1', uid: 'c1' }));
    expect(Object.keys(f.deps.guardar.mock.calls[0][1]).sort()).toEqual(['ciudad', 'correo', 'direccion', 'telefono', 'uid', 'yonkeId']);
    expect(f.deps.guardar.mock.calls[0][1]).toMatchObject({ uid: 'l1', yonkeId: 'YL' });
  });
  it('sin sesión: 401; yonke completo, taller o ficha ajena: 403', async () => {
    const f = crearFalsos();
    expect((await f.m(peticion(bien, ''))).status).toBe(401);
    expect((await f.m(peticion(bien, 'pase-falso'))).status).toBe(401);
    for (const token of ['pase-yonke', 'pase-taller', 'pase-ajeno']) expect((await f.m(peticion(bien, token))).status).toBe(403);
    expect(f.deps.guardar).not.toHaveBeenCalled();
  });
  it('ya completado no repite: la ficha dejó de ser ligera', async () => {
    const f = crearFalsos({ leerComoUsuario: vi.fn(async (_t, ruta) => (ruta === 'yonkes/YL' ? { ...docs['yonkes/YL'], tipoRegistro: 'completo' } : docs[ruta])) });
    expect((await f.m(peticion())).status).toBe(403);
    expect(f.deps.guardar).not.toHaveBeenCalled();
  });
  it('cuerpo roto o datos inválidos: 400 sin guardar', async () => {
    const f = crearFalsos();
    expect((await f.m(peticion('{roto'))).status).toBe(400);
    expect((await f.m(peticion({ ...bien, direccion: '' }))).status).toBe(400);
    expect(f.deps.guardar).not.toHaveBeenCalled();
  });
  it('si guardar falla: 503 y sin aviso; si falla el aviso, sigue', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const f = crearFalsos({ guardar: vi.fn(async () => { throw new Error('x'); }) });
    expect((await f.m(peticion())).status).toBe(503);
    expect(f.deps.notificar).not.toHaveBeenCalled();
    const g = crearFalsos({ notificar: vi.fn(async () => { throw new Error('x'); }) });
    expect((await g.m(peticion())).status).toBe(200);
    vi.restoreAllMocks();
  });
});
