import { describe, expect, it } from 'vitest';
import {
  INVENTORY_THRESHOLDS,
  getVehicleFreshness,
  getItemFreshness,
  getItemFreshnessOrNull,
  getYonkeActivity,
  type ItemCategory,
  type YonkeVehicleInput,
} from './inventoryStatus';

const AHORA = new Date('2026-09-24T12:00:00.000Z');

function hace(dias: number): Date {
  return new Date(AHORA.getTime() - dias * 24 * 60 * 60 * 1000);
}

describe('getVehicleFreshness', () => {
  it('devuelve 0 días y green cuando se captura justo ahora', () => {
    expect(getVehicleFreshness(AHORA, AHORA)).toEqual({ status: 'green', days: 0 });
  });

  it('trata una fecha de captura en el futuro como 0 días (nunca negativo)', () => {
    const enElFuturo = new Date(AHORA.getTime() + 5 * 24 * 60 * 60 * 1000);
    expect(getVehicleFreshness(enElFuturo, AHORA)).toEqual({ status: 'green', days: 0 });
  });

  it(`día ${INVENTORY_THRESHOLDS.vehiculos.greenMaxDays} (borde) sigue siendo green`, () => {
    const r = getVehicleFreshness(hace(INVENTORY_THRESHOLDS.vehiculos.greenMaxDays), AHORA);
    expect(r.status).toBe('green');
    expect(r.days).toBe(30);
  });

  it(`día ${INVENTORY_THRESHOLDS.vehiculos.greenMaxDays + 1} (justo después del borde) ya es yellow`, () => {
    const r = getVehicleFreshness(hace(INVENTORY_THRESHOLDS.vehiculos.greenMaxDays + 1), AHORA);
    expect(r.status).toBe('yellow');
    expect(r.days).toBe(31);
  });

  it(`día ${INVENTORY_THRESHOLDS.vehiculos.yellowMaxDays} (borde) sigue siendo yellow`, () => {
    const r = getVehicleFreshness(hace(INVENTORY_THRESHOLDS.vehiculos.yellowMaxDays), AHORA);
    expect(r.status).toBe('yellow');
    expect(r.days).toBe(90);
  });

  it(`día ${INVENTORY_THRESHOLDS.vehiculos.yellowMaxDays + 1} (justo después del borde) ya es red`, () => {
    const r = getVehicleFreshness(hace(INVENTORY_THRESHOLDS.vehiculos.yellowMaxDays + 1), AHORA);
    expect(r.status).toBe('red');
    expect(r.days).toBe(91);
  });

  it('un vehículo muy viejo (200 días) es red', () => {
    expect(getVehicleFreshness(hace(200), AHORA).status).toBe('red');
  });
});

// Bordes exactos por categoría — motores y transmisiones comparten umbrales con vehículos
// (30/90), piezasSueltas tiene los suyos propios (15/45). Se prueban las 4 explícitamente en vez
// de asumir que "comparten número" == "se comportan igual": cada categoría pasa por su propia
// entrada del Record, así que un typo en INVENTORY_THRESHOLDS para una categoría específica sí
// se detectaría aquí.
const CATEGORIAS: ItemCategory[] = ['vehiculos', 'motores', 'transmisiones', 'piezasSueltas'];

describe('getItemFreshness por categoría', () => {
  for (const categoria of CATEGORIAS) {
    const { greenMaxDays, yellowMaxDays } = INVENTORY_THRESHOLDS[categoria];

    it(`${categoria}: día ${greenMaxDays} (borde green) sigue siendo green`, () => {
      const r = getItemFreshness(categoria, hace(greenMaxDays), AHORA);
      expect(r.status).toBe('green');
      expect(r.days).toBe(greenMaxDays);
    });

    it(`${categoria}: día ${greenMaxDays + 1} (justo después) ya es yellow`, () => {
      expect(getItemFreshness(categoria, hace(greenMaxDays + 1), AHORA).status).toBe('yellow');
    });

    it(`${categoria}: día ${yellowMaxDays} (borde yellow) sigue siendo yellow`, () => {
      const r = getItemFreshness(categoria, hace(yellowMaxDays), AHORA);
      expect(r.status).toBe('yellow');
      expect(r.days).toBe(yellowMaxDays);
    });

    it(`${categoria}: día ${yellowMaxDays + 1} (justo después) ya es red`, () => {
      expect(getItemFreshness(categoria, hace(yellowMaxDays + 1), AHORA).status).toBe('red');
    });
  }

  it('piezasSueltas usa umbrales distintos a vehiculos/motores/transmisiones (15/45, no 30/90)', () => {
    // Día 20: para piezasSueltas (yellowMax 45, greenMax 15) es 'yellow'; para vehiculos
    // (greenMax 30) sigue siendo 'green' — confirma que son tablas de umbrales independientes,
    // no la misma constante reusada por accidente.
    expect(getItemFreshness('piezasSueltas', hace(20), AHORA).status).toBe('yellow');
    expect(getItemFreshness('vehiculos', hace(20), AHORA).status).toBe('green');
  });
});

describe('getItemFreshnessOrNull', () => {
  it('devuelve null si no hay fecha de captura (undefined)', () => {
    expect(getItemFreshnessOrNull('motores', undefined, true, AHORA)).toBeNull();
  });

  it('devuelve null si no hay fecha de captura (null)', () => {
    expect(getItemFreshnessOrNull('piezasSueltas', null, true, AHORA)).toBeNull();
  });

  it('devuelve null si disponible === false, aunque sí haya fecha', () => {
    expect(getItemFreshnessOrNull('motores', hace(1), false, AHORA)).toBeNull();
  });

  it('disponible undefined (ausente) SÍ cuenta como disponible y calcula normal', () => {
    expect(getItemFreshnessOrNull('transmisiones', hace(1), undefined, AHORA)).toEqual({ status: 'green', days: 1 });
  });

  it('con fecha y disponible=true calcula normal, respetando la categoría', () => {
    expect(getItemFreshnessOrNull('piezasSueltas', hace(20), true, AHORA)).toEqual({ status: 'yellow', days: 20 });
  });
});

describe('getYonkeActivity', () => {
  it('lista vacía => none, medianDays null', () => {
    expect(getYonkeActivity([], AHORA)).toEqual({ status: 'none', medianDays: null });
  });

  it('todos los vehículos vendidos (disponible: false) => none, medianDays null', () => {
    const vehiculos: YonkeVehicleInput[] = [
      { capturedAt: hace(5), disponible: false },
      { capturedAt: hace(10), disponible: false },
    ];
    expect(getYonkeActivity(vehiculos, AHORA)).toEqual({ status: 'none', medianDays: null });
  });

  it('excluye vendidos del cálculo aunque haya activos mezclados', () => {
    const vehiculos: YonkeVehicleInput[] = [
      { capturedAt: hace(200), disponible: false }, // excluido — si contara, sería 'red'
      { capturedAt: hace(5) }, // disponible ausente = activo
      { capturedAt: hace(10), disponible: true },
    ];
    const r = getYonkeActivity(vehiculos, AHORA);
    expect(r.status).toBe('green');
    expect(r.medianDays).toBe(7.5); // mediana de [5, 10]
  });

  it('mediana con cantidad impar de activos toma el valor central', () => {
    const vehiculos: YonkeVehicleInput[] = [
      { capturedAt: hace(5) },
      { capturedAt: hace(50) },
      { capturedAt: hace(500) },
    ];
    expect(getYonkeActivity(vehiculos, AHORA).medianDays).toBe(50);
  });

  it(`mediana en el borde de ${INVENTORY_THRESHOLDS.vehiculos.greenMaxDays} días sigue siendo green`, () => {
    const vehiculos: YonkeVehicleInput[] = [
      { capturedAt: hace(INVENTORY_THRESHOLDS.vehiculos.greenMaxDays) },
    ];
    expect(getYonkeActivity(vehiculos, AHORA).status).toBe('green');
  });

  it(`mediana un día después del borde de ${INVENTORY_THRESHOLDS.vehiculos.greenMaxDays} ya es yellow`, () => {
    const vehiculos: YonkeVehicleInput[] = [
      { capturedAt: hace(INVENTORY_THRESHOLDS.vehiculos.greenMaxDays + 1) },
    ];
    expect(getYonkeActivity(vehiculos, AHORA).status).toBe('yellow');
  });

  it(`mediana en el borde de ${INVENTORY_THRESHOLDS.vehiculos.yellowMaxDays} días sigue siendo yellow`, () => {
    const vehiculos: YonkeVehicleInput[] = [
      { capturedAt: hace(INVENTORY_THRESHOLDS.vehiculos.yellowMaxDays) },
    ];
    expect(getYonkeActivity(vehiculos, AHORA).status).toBe('yellow');
  });

  it(`mediana un día después del borde de ${INVENTORY_THRESHOLDS.vehiculos.yellowMaxDays} ya es red`, () => {
    const vehiculos: YonkeVehicleInput[] = [
      { capturedAt: hace(INVENTORY_THRESHOLDS.vehiculos.yellowMaxDays + 1) },
    ];
    expect(getYonkeActivity(vehiculos, AHORA).status).toBe('red');
  });
});
