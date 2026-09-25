import { describe, expect, it } from 'vitest';
import {
  INVENTORY_THRESHOLDS,
  getVehicleFreshness,
  getYonkeActivity,
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

  it(`día ${INVENTORY_THRESHOLDS.greenMaxDays} (borde) sigue siendo green`, () => {
    const r = getVehicleFreshness(hace(INVENTORY_THRESHOLDS.greenMaxDays), AHORA);
    expect(r.status).toBe('green');
    expect(r.days).toBe(30);
  });

  it(`día ${INVENTORY_THRESHOLDS.greenMaxDays + 1} (justo después del borde) ya es yellow`, () => {
    const r = getVehicleFreshness(hace(INVENTORY_THRESHOLDS.greenMaxDays + 1), AHORA);
    expect(r.status).toBe('yellow');
    expect(r.days).toBe(31);
  });

  it(`día ${INVENTORY_THRESHOLDS.yellowMaxDays} (borde) sigue siendo yellow`, () => {
    const r = getVehicleFreshness(hace(INVENTORY_THRESHOLDS.yellowMaxDays), AHORA);
    expect(r.status).toBe('yellow');
    expect(r.days).toBe(90);
  });

  it(`día ${INVENTORY_THRESHOLDS.yellowMaxDays + 1} (justo después del borde) ya es red`, () => {
    const r = getVehicleFreshness(hace(INVENTORY_THRESHOLDS.yellowMaxDays + 1), AHORA);
    expect(r.status).toBe('red');
    expect(r.days).toBe(91);
  });

  it('un vehículo muy viejo (200 días) es red', () => {
    expect(getVehicleFreshness(hace(200), AHORA).status).toBe('red');
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

  it(`mediana en el borde de ${INVENTORY_THRESHOLDS.greenMaxDays} días sigue siendo green`, () => {
    const vehiculos: YonkeVehicleInput[] = [
      { capturedAt: hace(INVENTORY_THRESHOLDS.greenMaxDays) },
    ];
    expect(getYonkeActivity(vehiculos, AHORA).status).toBe('green');
  });

  it(`mediana un día después del borde de ${INVENTORY_THRESHOLDS.greenMaxDays} ya es yellow`, () => {
    const vehiculos: YonkeVehicleInput[] = [
      { capturedAt: hace(INVENTORY_THRESHOLDS.greenMaxDays + 1) },
    ];
    expect(getYonkeActivity(vehiculos, AHORA).status).toBe('yellow');
  });

  it(`mediana en el borde de ${INVENTORY_THRESHOLDS.yellowMaxDays} días sigue siendo yellow`, () => {
    const vehiculos: YonkeVehicleInput[] = [
      { capturedAt: hace(INVENTORY_THRESHOLDS.yellowMaxDays) },
    ];
    expect(getYonkeActivity(vehiculos, AHORA).status).toBe('yellow');
  });

  it(`mediana un día después del borde de ${INVENTORY_THRESHOLDS.yellowMaxDays} ya es red`, () => {
    const vehiculos: YonkeVehicleInput[] = [
      { capturedAt: hace(INVENTORY_THRESHOLDS.yellowMaxDays + 1) },
    ];
    expect(getYonkeActivity(vehiculos, AHORA).status).toBe('red');
  });
});
