import { describe, expect, it } from 'vitest';
import {
  INVENTORY_THRESHOLDS,
  getVehicleFreshness,
  getItemFreshness,
  getItemFreshnessOrNull,
  YONKE_ACTIVIDAD_THRESHOLDS,
  YONKE_ACTIVIDAD_REFRESCO_HORAS,
  getYonkeActividad,
  debeRegistrarActividad,
  toMillis,
  type ItemCategory,
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

describe('getYonkeActividad', () => {
  it('umbrales 30 / 90', () => {
    expect(YONKE_ACTIVIDAD_THRESHOLDS).toEqual({ greenMaxDays: 30, yellowMaxDays: 90 });
  });

  it('actividad justo ahora -> green', () => {
    expect(getYonkeActividad(AHORA, AHORA)).toBe('green');
  });

  it('borde exacto 30 días -> green; 31 días -> yellow', () => {
    expect(getYonkeActividad(hace(30), AHORA)).toBe('green');
    expect(getYonkeActividad(hace(31), AHORA)).toBe('yellow');
  });

  it('borde exacto 90 días -> yellow; 91 días -> red', () => {
    expect(getYonkeActividad(hace(90), AHORA)).toBe('yellow');
    expect(getYonkeActividad(hace(91), AHORA)).toBe('red');
  });

  it('cuenta días completos (30 días y 23 h sigue green)', () => {
    const casi31 = new Date(hace(30).getTime() - 23 * 60 * 60 * 1000);
    expect(getYonkeActividad(casi31, AHORA)).toBe('green');
  });

  it('sin fecha -> null', () => {
    expect(getYonkeActividad(null, AHORA)).toBeNull();
    expect(getYonkeActividad(undefined, AHORA)).toBeNull();
  });

  it('fecha inválida -> null', () => {
    expect(getYonkeActividad(new Date('no-es-fecha'), AHORA)).toBeNull();
    expect(getYonkeActividad(NaN, AHORA)).toBeNull();
  });

  it('fecha futura -> green', () => {
    expect(getYonkeActividad(new Date(AHORA.getTime() + 10 * 24 * 60 * 60 * 1000), AHORA)).toBe('green');
  });

  it('acepta milisegundos (lo que cruza servidor -> cliente)', () => {
    expect(getYonkeActividad(hace(100).getTime(), AHORA)).toBe('red');
    expect(getYonkeActividad(hace(10).getTime(), AHORA.getTime())).toBe('green');
  });
});

describe('debeRegistrarActividad', () => {
  const horasAtras = (h: number) => new Date(AHORA.getTime() - h * 60 * 60 * 1000);

  it('umbral de refresco = 12 horas', () => {
    expect(YONKE_ACTIVIDAD_REFRESCO_HORAS).toBe(12);
  });
  it('sin valor previo (yonke nunca registrado) -> escribe', () => {
    expect(debeRegistrarActividad(null, AHORA)).toBe(true);
    expect(debeRegistrarActividad(undefined, AHORA)).toBe(true);
  });
  it('valor inválido -> escribe (se repara)', () => {
    expect(debeRegistrarActividad('basura', AHORA)).toBe(true);
  });
  it('menos de 12 h -> no escribe', () => {
    expect(debeRegistrarActividad(horasAtras(1), AHORA)).toBe(false);
    expect(debeRegistrarActividad(horasAtras(11.9), AHORA)).toBe(false);
  });
  it('exactamente 12 h -> no escribe (debe ser MÁS de 12)', () => {
    expect(debeRegistrarActividad(horasAtras(12), AHORA)).toBe(false);
  });
  it('más de 12 h -> escribe', () => {
    expect(debeRegistrarActividad(horasAtras(12.01), AHORA)).toBe(true);
    expect(debeRegistrarActividad(horasAtras(24 * 60), AHORA)).toBe(true);
  });
  it('acepta Timestamp-like de Firestore', () => {
    expect(debeRegistrarActividad({ toMillis: () => horasAtras(20).getTime() }, AHORA)).toBe(true);
    expect(debeRegistrarActividad({ toMillis: () => horasAtras(2).getTime() }, AHORA)).toBe(false);
  });
  it('fecha futura (dato corrupto) -> no escribe', () => {
    expect(debeRegistrarActividad(new Date(AHORA.getTime() + 3600_000), AHORA)).toBe(false);
  });
});

describe('toMillis', () => {
  it('Date, número, Timestamp-like y {seconds}', () => {
    expect(toMillis(AHORA)).toBe(AHORA.getTime());
    expect(toMillis(1234)).toBe(1234);
    expect(toMillis({ toMillis: () => 555 })).toBe(555);
    expect(toMillis({ toDate: () => new Date(777) })).toBe(777);
    expect(toMillis({ seconds: 2, nanoseconds: 500_000_000 })).toBe(2500);
  });
  it('null/inválido -> null', () => {
    expect(toMillis(null)).toBeNull();
    expect(toMillis(undefined)).toBeNull();
    expect(toMillis('2026-01-01')).toBeNull();
    expect(toMillis({})).toBeNull();
    expect(toMillis(NaN)).toBeNull();
    expect(toMillis(new Date('x'))).toBeNull();
  });
});
