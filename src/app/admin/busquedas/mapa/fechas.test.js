import { describe, expect, it } from 'vitest';
import { esDeLasUltimas24Horas, formatearFechaTijuana } from './fechas';

describe('fechas del mapa de búsquedas (horario de Tijuana)', () => {
  it('muestra día, mes, año y hora de Tijuana, con o sin horario de verano', () => {
    // Octubre: horario de verano (UTC-7). Enero: horario normal (UTC-8).
    expect(formatearFechaTijuana(new Date('2026-10-09T21:35:00Z'))).toBe('9 oct 2026, 2:35 p.m.');
    expect(formatearFechaTijuana(new Date('2026-01-15T21:35:00Z'))).toBe('15 ene 2026, 1:35 p.m.');
    // El día también es el de Tijuana: 3 a.m. UTC del 10 de oct todavía es 9 de oct allá.
    expect(formatearFechaTijuana(new Date('2026-10-10T03:00:00Z'))).toBe('9 oct 2026, 8:00 p.m.');
  });
  it('acepta el Timestamp de Firestore y no truena sin fecha', () => {
    const ts = { toDate: () => new Date('2026-10-09T21:35:00Z') };
    expect(formatearFechaTijuana(ts)).toBe('9 oct 2026, 2:35 p.m.');
    expect(formatearFechaTijuana(null)).toBe('—');
    expect(formatearFechaTijuana('no es fecha')).toBe('—');
  });
  it('marca como reciente solo lo de las últimas 24 horas', () => {
    const ahora = new Date('2026-10-09T12:00:00Z').getTime();
    const hace = (horas) => new Date(ahora - horas * 60 * 60 * 1000);
    expect(esDeLasUltimas24Horas(hace(1), ahora)).toBe(true);
    expect(esDeLasUltimas24Horas(hace(23.9), ahora)).toBe(true);
    expect(esDeLasUltimas24Horas(hace(24), ahora)).toBe(false);
    expect(esDeLasUltimas24Horas(hace(72), ahora)).toBe(false);
    expect(esDeLasUltimas24Horas(null, ahora)).toBe(false);
  });
});
