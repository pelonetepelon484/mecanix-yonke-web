import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import textos from './textosLegalesTalleres.json';
import { VERSIONES_AVISO_ORDEN, VERSIONES_CON_SEGUIMIENTO, ordenConSeguimiento } from './avisoOrden';

// La lista de las reglas (avisosConSeguimiento) y la del JSON ("seguimiento": true) deben decir lo
// mismo. Mientras el texto de una versión nueva no esté en el JSON, va en PENDIENTES_DE_TEXTO (hoy
// ninguna: aviso-orden-3 ya trae su texto y su marca). Si se agrega al JSON SIN marcarla, falla.
const PENDIENTES_DE_TEXTO: string[] = [];

const reglas = readFileSync(new URL('../../firestore.rules', import.meta.url), 'utf8');
function listaDeReglas(): string[] {
  const m = reglas.match(/function avisosConSeguimiento\(\)\s*\{\s*return\s*\[([^\]]*)\]/);
  if (!m) throw new Error('No se encontró avisosConSeguimiento() en firestore.rules');
  return m[1].split(',').map((s) => s.trim().replace(/^'|'$/g, '')).filter(Boolean);
}

describe('versiones del aviso con seguimiento: reglas = JSON', () => {
  it('reglas = versiones marcadas en el JSON + las pendientes de texto', () => {
    expect([...listaDeReglas()].sort()).toEqual([...VERSIONES_CON_SEGUIMIENTO, ...PENDIENTES_DE_TEXTO].sort());
  });
  it('una versión pendiente de texto todavía no está en el JSON', () => {
    for (const v of PENDIENTES_DE_TEXTO) expect(VERSIONES_AVISO_ORDEN).not.toContain(v);
  });
  it('solo aviso-orden-3 tiene seguimiento; aviso-orden-1 y aviso-orden-2, no', () => {
    expect(ordenConSeguimiento('aviso-orden-1')).toBe(false);
    expect(ordenConSeguimiento('aviso-orden-2')).toBe(false);
    expect(ordenConSeguimiento('aviso-orden-3')).toBe(true);
    const marcadas = (textos as unknown as { avisosOrden: { version: string; seguimiento?: boolean }[] }).avisosOrden.filter((a) => a.seguimiento);
    expect(marcadas.map((a) => a.version)).toEqual(['aviso-orden-3']);
  });
  it('ordenConSeguimiento con una lista dada (las pantallas la usan así en las pruebas)', () => {
    expect(ordenConSeguimiento('aviso-orden-3', ['aviso-orden-3'])).toBe(true);
    expect(ordenConSeguimiento(undefined, ['aviso-orden-3'])).toBe(false);
  });
});
