import { describe, expect, it } from 'vitest';
import { PARAMETROS_PERMITIDOS, RUTA_NUEVA_SOLICITUD, enlacePedirPieza, limpiarTexto, prefillDesdeParametros } from './pedirPiezaDesdeCotizacion';
import { PIEZA_MAX, validarSolicitud } from './solicitudesPiezas';

const CATALOGO = { Nissan: ['Sentra', 'Tsuru'], 'Mercedes-Benz': ['Clase C'], Chevrolet: ['Aveo'] };
const params = (texto: string) => new URLSearchParams(texto);

describe('enlace desde la cotización', () => {
  it('lleva solo marca, modelo, año y pieza', () => {
    const url = enlacePedirPieza({ vehiculo: { marca: 'Nissan', modelo: 'Sentra', anio: '2010' }, descripcion: 'Alternador' });
    expect(url).toBe(`${RUTA_NUEVA_SOLICITUD}?marca=Nissan&modelo=Sentra&anio=2010&pieza=Alternador`);
  });
  it('aunque le pasen la cotización completa, no viaja ningún dato del cliente, placas, observaciones ni precios', () => {
    const cotizacion = {
      marca: 'Nissan', modelo: 'Sentra', anio: 2010, placas: 'ABC1234', kilometraje: 150000,
      cliente: { nombre: 'Juan Pérez', telefono: '6649998877' }, observaciones: 'Le urge', precioUnitario: 1500,
    };
    const url = enlacePedirPieza({ vehiculo: cotizacion, descripcion: 'Alternador' });
    const claves = [...new URL(url, 'https://x.mx').searchParams.keys()];
    expect(claves.every((c) => (PARAMETROS_PERMITIDOS as readonly string[]).includes(c))).toBe(true);
    for (const dato of ['ABC1234', '150000', 'Juan', '6649998877', 'urge', '1500']) expect(decodeURIComponent(url)).not.toContain(dato);
  });
  it('omite lo vacío y recorta la descripción al máximo del pedido', () => {
    expect(enlacePedirPieza({ vehiculo: {}, descripcion: '' })).toBe(RUTA_NUEVA_SOLICITUD);
    const url = enlacePedirPieza({ vehiculo: { marca: 'Nissan' }, descripcion: 'x'.repeat(300) });
    expect(new URL(url, 'https://x.mx').searchParams.get('pieza')).toHaveLength(PIEZA_MAX);
  });
});

describe('datos que llegan por la URL (pedido de piezas)', () => {
  it('prellena marca, modelo, año y pieza válidos; ignora cualquier otro parámetro', () => {
    const p = prefillDesdeParametros(params('marca=Nissan&modelo=Sentra&anio=2010&pieza=Alternador&nombre=Juan&telefono=664&placas=ABC'), CATALOGO);
    expect(p).toEqual({ marca: 'Nissan', modelo: 'Sentra', anio: '2010', pieza: 'Alternador' });
    expect(validarSolicitud({ vehiculo: { marca: p.marca, modelo: p.modelo, anio: Number(p.anio) }, pieza: p.pieza, nota: '' })).toBeNull();
  });
  it('mapea marca y modelo sin importar mayúsculas ni acentos', () => {
    expect(prefillDesdeParametros(params('marca=nissan&modelo=SENTRA'), CATALOGO)).toMatchObject({ marca: 'Nissan', modelo: 'Sentra' });
    expect(prefillDesdeParametros(params('marca=mercedes-benz&modelo=clase c'), CATALOGO)).toMatchObject({ marca: 'Mercedes-Benz', modelo: 'Clase C' });
  });
  it('sin coincidencia clara deja el campo vacío en lugar de adivinar', () => {
    expect(prefillDesdeParametros(params('marca=Nisan&modelo=Sentra'), CATALOGO)).toMatchObject({ marca: '', modelo: '' });
    expect(prefillDesdeParametros(params('marca=Nissan&modelo=Versa'), CATALOGO)).toMatchObject({ marca: 'Nissan', modelo: '' });
    expect(prefillDesdeParametros(params('modelo=Sentra'), CATALOGO)).toMatchObject({ marca: '', modelo: '' });
  });
  it('año: solo 4 dígitos dentro del rango del formulario', () => {
    for (const malo of ['20x0', '1800', '2101', '2010.5', '-2010', '10', '']) {
      expect(prefillDesdeParametros(params(`anio=${encodeURIComponent(malo)}`), CATALOGO).anio).toBe('');
    }
    expect(prefillDesdeParametros(params('anio=1950'), CATALOGO).anio).toBe('1950');
  });
  it('pieza: texto plano de una línea, recortada al máximo; el HTML queda como texto', () => {
    expect(prefillDesdeParametros(params(`pieza=${'a'.repeat(300)}`), CATALOGO).pieza).toHaveLength(PIEZA_MAX);
    expect(prefillDesdeParametros(params(`pieza=${encodeURIComponent('Faro\nderecho\t ')}`), CATALOGO).pieza).toBe('Faro derecho');
    expect(prefillDesdeParametros(params(`pieza=${encodeURIComponent('<script>alert(1)</script>')}`), CATALOGO).pieza).toBe('<script>alert(1)</script>');
    expect(prefillDesdeParametros(params('pieza=%20%20'), CATALOGO).pieza).toBe('');
  });
  it('sin parámetros (o null): todo vacío, como hoy', () => {
    expect(prefillDesdeParametros(params(''), CATALOGO)).toEqual({ marca: '', modelo: '', anio: '', pieza: '' });
    expect(prefillDesdeParametros(null, CATALOGO)).toEqual({ marca: '', modelo: '', anio: '', pieza: '' });
  });
  it('limpiarTexto ignora tipos raros', () => {
    expect(limpiarTexto({ a: 1 }, 10)).toBe('');
    expect(limpiarTexto(2010, 4)).toBe('2010');
  });
});
