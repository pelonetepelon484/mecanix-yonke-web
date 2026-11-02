import { describe, expect, it } from 'vitest';
import { calcularExpiraEvidencia, evidenciaCompleta, nombreMedio, textoBusquedaEvidencia } from './evidenciaSugerir';

const ahora = new Date('2026-11-01T12:00:00Z');
const base = { medio: 'whatsapp', mensaje: ' Sí autorizo ', recibido: '2026-11-01T11:00:00Z', autorizacionConfirmada: true };

describe('evidenciaCompleta', () => {
  it('limpia el mensaje y convierte la fecha', () => {
    expect(evidenciaCompleta(base, ahora)).toEqual({ medio: 'whatsapp', mensaje: 'Sí autorizo', recibidoAt: new Date('2026-11-01T11:00:00Z') });
  });
  it('rechaza si falta algo, con medio oral, mensaje vacío o largo, fecha futura o sin casilla', () => {
    for (const cambio of [
      { medio: '' }, { medio: 'llamada' }, { mensaje: '   ' }, { mensaje: 'x'.repeat(2001) }, { recibido: '' },
      { recibido: '2026-11-01T13:00:00Z' }, { autorizacionConfirmada: false },
    ]) expect(evidenciaCompleta({ ...base, ...cambio }, ahora)).toBeNull();
  });
});

describe('datos de la evidencia', () => {
  it('vence a los 30 días', () => {
    expect(calcularExpiraEvidencia(ahora)).toEqual(new Date('2026-12-01T12:00:00Z'));
  });
  it('la búsqueda se lee sin el pedido', () => {
    expect(textoBusquedaEvidencia({ pieza: 'Faro', vehiculo: { marca: 'Ford', modelo: 'Focus', anio: 2012 } })).toBe('Faro · Ford Focus 2012');
    expect(textoBusquedaEvidencia({ pieza: 'Faro' })).toBe('Faro');
  });
  it('nombre del medio', () => {
    expect(nombreMedio('sms')).toBe('Mensaje de texto');
  });
});
