import { describe, expect, it } from 'vitest';
import { MAX_RENGLONES_TABLA, parsearTabla } from './equivalencias';

// La tabla de Nissan tal como David la copió (columnas separadas por tabulación).
const NISSAN = [
  'Modelo Nissan\tAños\tMotor / Transmisión\tNúmero de Parte Base\tEquivalencias / Reemplazos',
  'Nissan Versa / March\t2012 - 2019\t1.6L (HR16DE) / Automático\t23710-3HC0A\t23710-3HC0B, 23710-3HC0C, MEC940-310',
  'Nissan Sentra (B16)\t2007 - 2012\t2.0L (MR20DE) / CVT\t23710-ET00A\t23710-ET00B, 23710-ET00C, 23710-ET00D',
  'Nissan Sentra (B17)\t2013 - 2019\t1.8L (MRA8DE) / CVT\t23710-3SR0A\t23710-3SR0B, 23710-3SR0C, 23710-4AF0A',
  'Nissan NP300 / Frontier\t2008 - 2015\t2.4L (KA24DE) / Manual\t23710-VK500\t23710-VK50A, 23710-JR70A',
  'Nissan Altima (L33)\t2013 - 2018\t2.5L (QR25DE) / CVT\t23710-3TA0A\t23710-3TA0B, 23710-3TA0C, 23710-3TA0D',
].join('\n');

describe('pegar tabla de equivalencias', () => {
  it('la tabla de Nissan: ignora los títulos y arma 5 registros con su nota', () => {
    const { renglones, demasiados } = parsearTabla(NISSAN, { tipoPieza: 'computadora' });
    expect(demasiados).toBe(false);
    expect(renglones[0]).toMatchObject({ estado: 'ignorado' });
    const ok = renglones.filter((r) => r.estado === 'ok');
    expect(ok).toHaveLength(5);
    expect(ok[0].datos).toEqual({
      clase: 'equivalencia', tipoPieza: 'computadora',
      partes: ['237103HC0A', '237103HC0B', '237103HC0C', 'MEC940310'],
      nota: 'Nissan Versa / March · 2012 - 2019 · 1.6L (HR16DE) / Automático',
    });
    expect(ok[3].datos.partes).toEqual(['23710VK500', '23710VK50A', '23710JR70A']);
  });

  it('avisa lo que ya estaba registrado (del mismo tipo) y lo repetido dentro de la tabla', () => {
    const existentes = [{ tipoPieza: 'computadora', partes: ['237103HC0A', '237103HC0B', '237103HC0C', 'MEC940310'] }];
    const r = parsearTabla(NISSAN, { tipoPieza: 'computadora', existentes }).renglones;
    expect(r[1].estado).toBe('repetido');
    expect(parsearTabla(NISSAN, { tipoPieza: 'tcm', existentes }).renglones[1].estado).toBe('ok');
    const doble = parsearTabla('A\t11111-AA\t22222-BB\nB\t22222-BB, 11111-AA', {}).renglones;
    expect(doble.map((x) => x.estado)).toEqual(['ok', 'repetido']);
  });

  it('tabla con "|" (de texto) y renglón con un solo número', () => {
    const t = '| Modelo | Base | Reemplazo |\n|---|---|---|\n| Saturn Outlook 2007 | 12605843 | 19210736 |\n| Otro | 12345678 | |';
    const r = parsearTabla(t, { tipoPieza: 'computadora' }).renglones.filter((x) => x.estado !== 'ignorado');
    expect(r[0]).toMatchObject({ estado: 'ok', partes: ['12605843', '19210736'], nota: 'Saturn Outlook 2007' });
    expect(r[1]).toMatchObject({ estado: 'error' });
  });

  it('un año suelto en su columna no se toma como número de parte', () => {
    const r = parsearTabla('Versa\t2015\t23710-3HC0A\t23710-3HC0B', {}).renglones[0];
    expect(r.partes).toEqual(['237103HC0A', '237103HC0B']);
    expect(r.nota).toBe('Versa · 2015');
  });

  it(`más de ${MAX_RENGLONES_TABLA} renglones: pide partirla`, () => {
    const t = Array.from({ length: MAX_RENGLONES_TABLA + 1 }, (_, i) => `M\t${10000 + i}-A\t${20000 + i}-B`).join('\n');
    expect(parsearTabla(t, {}).demasiados).toBe(true);
  });
});
