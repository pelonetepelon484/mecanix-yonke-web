import { describe, expect, it } from 'vitest';
import { aniosCercanos, aniosCercanosAnteriores, normalizarRango, ordenarPorCercania, rangoDeConfig } from './rangoAnios';

describe('rango de años (config/buscador)', () => {
  it('bandera: solo true exacto; sin rangoAnios vale 2; de 1 a 4', () => {
    expect(rangoDeConfig(null)).toBeNull();
    expect(rangoDeConfig({ rangoAniosCorto: false, rangoAnios: 2 })).toBeNull();
    expect(rangoDeConfig({ rangoAniosCorto: 'true' })).toBeNull();
    expect(rangoDeConfig({ rangoAniosCorto: true })).toBe(2);
    expect(rangoDeConfig({ rangoAniosCorto: true, rangoAnios: 1 })).toBe(1);
    expect(rangoDeConfig({ rangoAniosCorto: true, rangoAnios: 4 })).toBe(4);
    for (const malo of [0, 5, 2.5, '3', null]) expect(normalizarRango(malo)).toBe(2);
  });

  it('años cercanos de 2016 con ±2: 2015, 2017, 2014, 2018 (anterior primero en empate)', () => {
    expect(aniosCercanos(2016, 2)).toEqual([2015, 2017, 2014, 2018]);
    expect(aniosCercanos(2016, 1)).toEqual([2015, 2017]);
    // Bandera apagada: los mismos ±4 de siempre.
    expect(aniosCercanosAnteriores(2016)).toEqual([2015, 2017, 2014, 2018, 2013, 2019, 2012, 2020]);
  });

  it('orden: distancia, en empate el año anterior, y dentro del año Premium primero', () => {
    const r = (id, ano, plan = 'freemium') => ({ id, plan, vehiculo: { ano } });
    const lista = [r('a', 2018), r('b', 2017, 'premium'), r('c', 2014), r('d', 2015), r('e', 2017), r('f', 2016), r('g', 2015, 'premium')];
    expect(ordenarPorCercania(lista, 2016).map((x) => x.id)).toEqual(['f', 'g', 'd', 'b', 'e', 'c', 'a']);
    // Motores: el año está en r.motor.ano.
    expect(ordenarPorCercania([{ id: 'm1', motor: { ano: 2018 } }, { id: 'm2', motor: { ano: '2015' } }], 2016).map((x) => x.id)).toEqual(['m2', 'm1']);
  });
});
