import { describe, expect, it } from 'vitest';
import { MENSAJE_AVISO_SIN_ANIO_EXACTO, debeOfrecerAvisoSinAnioExacto, tituloAvisoSinAnioExacto } from './avisoSinAnioExacto';

const base = { tipoBusqueda: 'vehiculo', tipoResultado: 'cercano', hayResultados: true, anio: '2015' };

describe('cuándo se ofrece "Avisar a los yonkes" arriba de los resultados', () => {
  it('sí: resultados de años cercanos o de cualquier año, con el año que escribió el cliente', () => {
    expect(debeOfrecerAvisoSinAnioExacto(base)).toBe(true);
    expect(debeOfrecerAvisoSinAnioExacto({ ...base, tipoResultado: 'cualquierAno' })).toBe(true);
    expect(debeOfrecerAvisoSinAnioExacto({ ...base, anio: 2015 })).toBe(true);
  });
  it('no: con año exacto todo queda igual que hoy', () => {
    expect(debeOfrecerAvisoSinAnioExacto({ ...base, tipoResultado: 'exacto' })).toBe(false);
  });
  it('no: sin año en la búsqueda, sin resultados, o en las pestañas de motor/transmisión', () => {
    expect(debeOfrecerAvisoSinAnioExacto({ ...base, tipoResultado: 'cualquierAno', anio: '' })).toBe(false);
    expect(debeOfrecerAvisoSinAnioExacto({ ...base, anio: null })).toBe(false);
    expect(debeOfrecerAvisoSinAnioExacto({ ...base, hayResultados: false })).toBe(false);
    expect(debeOfrecerAvisoSinAnioExacto({ ...base, tipoBusqueda: 'motor' })).toBe(false);
    expect(debeOfrecerAvisoSinAnioExacto({ ...base, tipoBusqueda: 'transmision' })).toBe(false);
  });
});

describe('texto del recuadro', () => {
  it('lleva marca, modelo y año que buscó el cliente', () => {
    expect(tituloAvisoSinAnioExacto({ marca: 'Toyota', modelo: 'Tacoma', anio: '2015' }))
      .toBe('No encontramos tu Toyota Tacoma 2015 exacta.');
    expect(MENSAJE_AVISO_SIN_ANIO_EXACTO)
      .toBe('Activaremos una alerta de búsqueda con la pieza que necesitas para que los yonkes te contacten cuando la encuentren.');
  });
  it('si falta el modelo no deja huecos', () => {
    expect(tituloAvisoSinAnioExacto({ marca: 'Toyota', modelo: '', anio: 2015 }))
      .toBe('No encontramos tu Toyota 2015 exacta.');
  });
});
