import { describe, expect, it } from 'vitest';
import {
  ameritaSugerencia, idSugerencia, leerRespuestaIA, limpiarFuentes, notaDesdeSugerencia, parsearPartes, validarEquivalencia,
} from './equivalencias';

describe('equivalencias de piezas', () => {
  it('parsearPartes: separa, limpia guiones y quita repetidos', () => {
    expect(parsearPartes('12605843, 19210736\n12-615-418 / 12605843')).toEqual({ partes: ['12605843', '19210736', '12615418'], invalidas: [] });
    expect(parsearPartes('ab, 12605843').invalidas).toEqual(['ab']);
    expect(parsearPartes(null)).toEqual({ partes: [], invalidas: [] });
  });

  it('validarEquivalencia: al menos dos números, tipo de la lista y nota corta', () => {
    expect(validarEquivalencia({ tipoPieza: 'computadora', textoPartes: '12605843, 19210736', nota: ' GM E69 ' })).toEqual({
      ok: true, datos: { clase: 'equivalencia', tipoPieza: 'computadora', partes: ['12605843', '19210736'], nota: 'GM E69' },
    });
    expect(validarEquivalencia({ textoPartes: '12605843, 19210736' }).datos).toEqual({ clase: 'equivalencia', partes: ['12605843', '19210736'] });
    expect(validarEquivalencia({ textoPartes: '12605843' }).ok).toBe(false);
    expect(validarEquivalencia({ textoPartes: '12605843, 12-605-843' }).ok).toBe(false);
    expect(validarEquivalencia({ tipoPieza: 'frenos', textoPartes: '12605843, 19210736' }).ok).toBe(false);
    expect(validarEquivalencia({ textoPartes: '12605843, 19210736', nota: 'x'.repeat(501) }).ok).toBe(false);
    const muchos = (n) => Array.from({ length: n }, (_, i) => `AL3Z12A650${String(i).padStart(3, '0')}`).join(', ');
    expect(validarEquivalencia({ textoPartes: muchos(100) }).ok).toBe(true);
    expect(validarEquivalencia({ textoPartes: muchos(101) })).toEqual({ ok: false, mensaje: 'Máximo 100 números por registro.' });
  });

  it('idSugerencia: la misma pareja en cualquier orden da el mismo ID', () => {
    expect(idSugerencia('computadora', '19210736', '12-605-843')).toBe('computadora_12605843_19210736');
    expect(idSugerencia('computadora', '12605843', '19210736')).toBe('computadora_12605843_19210736');
  });

  it('ameritaSugerencia: solo dos números distintos, sin registro y sin resultado', () => {
    const base = { parteA: 'A123', parteB: 'B456', registros: { equivalentes: false }, resultadoKey: 'indeterminado' };
    expect(ameritaSugerencia(base)).toBe(true);
    expect(ameritaSugerencia({ ...base, parteB: 'A123' })).toBe(false);
    expect(ameritaSugerencia({ ...base, parteB: '' })).toBe(false);
    expect(ameritaSugerencia({ ...base, registros: { equivalentes: true } })).toBe(false);
    expect(ameritaSugerencia({ ...base, resultadoKey: 'compatible' })).toBe(false);
  });

  it('leerRespuestaIA: toma el JSON del texto y desconfía de lo raro', () => {
    const r = leerRespuestaIA('Listo:\n{"equivalentes": true, "confianza": "alta", "resumen": "19210736 reemplaza a 12605843.", "partesRelacionadas": ["12-615-418", "x", "12615418"]}');
    expect(r).toEqual({ equivalentes: true, confianza: 'alta', resumen: '19210736 reemplaza a 12605843.', partesRelacionadas: ['12615418'] });
    expect(leerRespuestaIA('no sé')).toMatchObject({ equivalentes: null, confianza: 'baja' });
    expect(leerRespuestaIA('{"equivalentes": "sí", "confianza": "total"}')).toMatchObject({ equivalentes: null, confianza: 'baja' });
  });

  it('limpiarFuentes: solo http(s), sin repetidos y máximo 5', () => {
    const lista = [{ url: 'javascript:alert(1)' }, { url: 'https://a.com/1', titulo: 'A' }, { url: 'https://a.com/1' },
      ...[2, 3, 4, 5, 6, 7].map((n) => ({ url: `https://a.com/${n}` }))];
    const r = limpiarFuentes(lista);
    expect(r).toHaveLength(5);
    expect(r[0]).toEqual({ url: 'https://a.com/1', titulo: 'A' });
    expect(r.every((f) => f.url.startsWith('https://'))).toBe(true);
  });

  it('notaDesdeSugerencia: dice de dónde salió', () => {
    expect(notaDesdeSugerencia({ fuentes: [{ url: 'https://gm.com/x' }] })).toBe('Aprobada desde sugerencia automática. Fuente: https://gm.com/x');
    expect(notaDesdeSugerencia({})).toBe('Aprobada desde sugerencia automática.');
  });
});
