import { describe, expect, it } from 'vitest';
import { cuantosYonkes, verboTener } from './textoYonkes';
import { TITULO_ALERTA_BUSQUEDA_INCOMPLETA, tituloAlertaProtagonista } from './alertaSiempre';

describe('singular y plural de yonkes (encabezados de resultados)', () => {
  it('1 yonke tiene / 3 yonkes tienen (sin "yonke(s)")', () => {
    expect(`${cuantosYonkes(1)} ${verboTener(1)} este vehículo`).toBe('1 yonke tiene este vehículo');
    expect(`${cuantosYonkes(3)} ${verboTener(3)} este vehículo`).toBe('3 yonkes tienen este vehículo');
    expect(`hay ${cuantosYonkes(1)} con años cercanos`).toBe('hay 1 yonke con años cercanos');
  });
});

describe('título del recuadro grande de la alerta', () => {
  it('número de parte, marca muy general y pieza sin vehículo: título propio (no "No tenemos ese vehículo todavía")', () => {
    for (const tipo of ['numero_de_parte', 'marca_muy_general', 'pieza_sin_vehiculo']) {
      expect(tituloAlertaProtagonista(tipo)).toBe(TITULO_ALERTA_BUSQUEDA_INCOMPLETA);
    }
    expect(TITULO_ALERTA_BUSQUEDA_INCOMPLETA).toBe('¿No encuentras la pieza? Consulta con los yonkes');
  });
  it('sin resultados de verdad: el título de siempre', () => {
    for (const tipo of ['sin_inventario', 'no_catalogado', 'sin_yonkes_estado', 'sin_en_tu_zona']) expect(tituloAlertaProtagonista(tipo)).toBeNull();
  });
});
