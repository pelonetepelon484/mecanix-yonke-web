import { describe, expect, it } from 'vitest';
import {
  MENSAJES_UBICACION, MINUTOS_ESTANCIA, distanciaKm, dentroDeZona, enlaceAqui, esHuellaValida, esSecretoValido, proveedoresEnMapa,
  textoDistancia, textoHasta, textoMinutos, ubicacionVigente, validarCheckin,
} from './ubicacionAsistencia';

const AHORA = new Date(2026, 10, 6, 14, 0).getTime();
const TIJUANA = { lat: 32.5149, lng: -117.0382 };
const ROSARITO = { lat: 32.3661, lng: -117.0618 };

describe('validarCheckin', () => {
  it('redondea a unos 300 m y calcula hasta cuándo', () => {
    const r = validarCheckin({ lat: 32.51493, lng: -117.03821, minutos: 90 }, AHORA);
    expect(r).toEqual({ ok: true, datos: { lat: 32.514, lng: -117.039, hastaMs: AHORA + 90 * 60000 } });
  });
  it('solo los tiempos de la lista (30 min a 3 horas)', () => {
    expect(MINUTOS_ESTANCIA).toEqual([30, 45, 60, 90, 120, 180]);
    for (const m of [0, 15, 240, '60', undefined]) {
      expect(validarCheckin({ ...TIJUANA, minutos: m }, AHORA)).toEqual({ ok: false, mensaje: MENSAJES_UBICACION.tiempo });
    }
  });
  it('rechaza coordenadas inválidas o fuera de Baja California', () => {
    expect(validarCheckin({ lat: NaN, lng: -117, minutos: 30 })).toEqual({ ok: false, mensaje: MENSAJES_UBICACION.sinGps });
    expect(validarCheckin({ lat: 19.43, lng: -99.13, minutos: 30 })).toEqual({ ok: false, mensaje: MENSAJES_UBICACION.fueraDeZona });
    expect(dentroDeZona(30.55, -115.94)).toBe(true); // San Quintín
  });
});

describe('ubicacionVigente', () => {
  const u = { ...TIJUANA, hastaAt: new Date(AHORA + 30 * 60000) };
  it('vigente mientras no pase su hora', () => {
    expect(ubicacionVigente(u, AHORA)).toBe(true);
    expect(ubicacionVigente({ ...u, hastaAt: new Date(AHORA - 1) }, AHORA)).toBe(false);
    expect(ubicacionVigente({ ...u, hastaAt: { toMillis: () => AHORA + 60000 } }, AHORA)).toBe(true);
  });
  it('ignora una hora absurda (más del tope) o sin coordenadas', () => {
    expect(ubicacionVigente({ ...u, hastaAt: new Date(AHORA + 10 * 3600000) }, AHORA)).toBe(false);
    expect(ubicacionVigente({ hastaAt: new Date(AHORA + 60000) }, AHORA)).toBe(false);
  });
});

describe('distancias y textos', () => {
  it('Tijuana a Rosarito ~16.6 km', () => {
    expect(distanciaKm(TIJUANA, ROSARITO)).toBeGreaterThan(16);
    expect(distanciaKm(TIJUANA, ROSARITO)).toBeLessThan(17.5);
  });
  it('textos', () => {
    expect(textoDistancia(0.4)).toBe('a menos de 1 km');
    expect(textoDistancia(2.44)).toBe('a 2.4 km');
    expect(textoDistancia(35.6)).toBe('a 36 km');
    expect(textoHasta(new Date(2026, 10, 6, 16, 30).getTime())).toBe('Aquí hasta las 4:30 p. m.');
    expect(MINUTOS_ESTANCIA.map(textoMinutos)).toEqual(['30 min', '45 min', '1 hora', '1 h 30 min', '2 horas', '3 horas']);
  });
  it('secreto, huella y enlace', () => {
    expect(esSecretoValido('a'.repeat(43))).toBe(true);
    expect(esSecretoValido('a'.repeat(42))).toBe(false);
    expect(esSecretoValido(`${'a'.repeat(42)}/`)).toBe(false);
    expect(esHuellaValida('0f'.repeat(32))).toBe(true);
    expect(esHuellaValida('0F'.repeat(32))).toBe(false);
    expect(enlaceAqui('https://x.mx', 'abc')).toBe('https://x.mx/asistencia-vial/aqui#abc');
  });
});

describe('proveedoresEnMapa', () => {
  const proveedores = [{ id: 'A', nombre: 'Grúas A' }, { id: 'B', nombre: 'Grúas B' }, { id: 'C', nombre: 'Sin ubicación' }];
  const ubicaciones = [
    { proveedorId: 'A', ...ROSARITO, hastaAt: new Date(AHORA + 60000), actualizadoAt: new Date(AHORA - 120000) },
    { proveedorId: 'B', ...TIJUANA, hastaAt: new Date(AHORA + 60000), actualizadoAt: new Date(AHORA - 60000) },
    { proveedorId: 'X', ...TIJUANA, hastaAt: new Date(AHORA + 60000) }, // proveedor inactivo o borrado
    { proveedorId: 'C', ...TIJUANA, hastaAt: new Date(AHORA - 1) }, // ya venció
  ];
  it('con ubicación del cliente: del más cercano al más lejano', () => {
    const r = proveedoresEnMapa(proveedores, ubicaciones, { lat: 32.52, lng: -117.04 }, AHORA);
    expect(r.map((x) => x.proveedor.id)).toEqual(['B', 'A']);
    expect(r[0].km).toBeLessThan(1);
  });
  it('sin ubicación del cliente: el check-in más reciente primero', () => {
    const r = proveedoresEnMapa(proveedores, ubicaciones, null, AHORA);
    expect(r.map((x) => x.proveedor.id)).toEqual(['B', 'A']);
    expect(r[0].km).toBeNull();
  });
});
