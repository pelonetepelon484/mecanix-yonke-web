import { describe, expect, it } from 'vitest';
import {
  LIMITE_CONTACTOS_BASICO, MENSAJES_CONTACTO, RANURAS_BASICO, camposContacto, coincide, enlaceWhatsappContacto, esRanuraBasico, expiraContacto,
  idParaNuevoContacto, mensajeWhatsappContacto, normalizarPlacasContacto, normalizarTelefonoContacto, primeraRanuraLibre, textoBusqueda,
  textoLugares, tipoBusqueda, validarContacto,
} from './contactosTaller';

describe('lugares del plan Básico', () => {
  it('son 25, de c01 a c25', () => {
    expect(LIMITE_CONTACTOS_BASICO).toBe(25);
    expect(RANURAS_BASICO).toHaveLength(25);
    expect(RANURAS_BASICO[0]).toBe('c01');
    expect(RANURAS_BASICO[24]).toBe('c25');
    expect(esRanuraBasico('c07')).toBe(true);
    expect(esRanuraBasico('c26')).toBe(false);
  });
  it('el nuevo contacto toma el primer lugar libre, en cualquier plan', () => {
    expect(primeraRanuraLibre([])).toBe('c01');
    expect(primeraRanuraLibre(['c01', 'c02', 'c04'])).toBe('c03');
    expect(idParaNuevoContacto(['c01'], true, () => 'AUTO')).toEqual({ id: 'c02' });
    expect(idParaNuevoContacto(['c01'], false, () => 'AUTO')).toEqual({ id: 'c02' });
  });
  it('con los 25 ocupados: Premium usa ID automático y Básico queda lleno', () => {
    expect(primeraRanuraLibre(RANURAS_BASICO)).toBeNull();
    expect(idParaNuevoContacto(RANURAS_BASICO, true, () => 'abcdefghij0123456789')).toEqual({ id: 'abcdefghij0123456789' });
    expect(idParaNuevoContacto(RANURAS_BASICO, false, () => 'X')).toEqual({ lleno: true });
    expect(MENSAJES_CONTACTO.lleno).toContain('Llegaste a 25 contactos del plan Básico. Con Premium no tienes límite.');
  });
  it('texto de lugares', () => {
    expect(textoLugares(12)).toBe('Usas 12 de 25 lugares del plan Básico.');
    expect(textoLugares(30)).toBe('Usas 25 de 25 lugares del plan Básico.');
  });
});

describe('validar contacto', () => {
  it('limpia nombre, teléfono, placas y descarta renglones vacíos', () => {
    const r = validarContacto({
      nombre: '  Juan   Pérez ', telefono: '+52 664-123-4567', nota: ' Cliente de flotilla ',
      vehiculos: [{ marca: 'Nissan', modelo: 'Versa', anio: '2018', placas: 'abc 123' }, { marca: '', modelo: '', anio: '', placas: '' }],
    });
    expect(r).toEqual({ ok: true, datos: { nombre: 'Juan Pérez', telefono: '6641234567', nota: 'Cliente de flotilla', vehiculos: [{ marca: 'Nissan', modelo: 'Versa', anio: 2018, placas: 'ABC123' }] } });
  });
  it('teléfono vacío está permitido', () => {
    expect(validarContacto({ nombre: 'Ana', telefono: '' })).toMatchObject({ ok: true, datos: { telefono: '', vehiculos: [] } });
  });
  it('errores en español, en orden', () => {
    expect(validarContacto({ nombre: ' ' })).toEqual({ ok: false, mensaje: MENSAJES_CONTACTO.nombre });
    expect(validarContacto({ nombre: 'x'.repeat(101) })).toEqual({ ok: false, mensaje: MENSAJES_CONTACTO.nombre });
    expect(validarContacto({ nombre: 'Ana', telefono: '123' })).toEqual({ ok: false, mensaje: MENSAJES_CONTACTO.telefono });
    expect(validarContacto({ nombre: 'Ana', nota: 'x'.repeat(201) })).toEqual({ ok: false, mensaje: MENSAJES_CONTACTO.nota });
    expect(validarContacto({ nombre: 'Ana', vehiculos: [{ marca: 'Nissan' }] })).toEqual({ ok: false, mensaje: MENSAJES_CONTACTO.vehiculo });
    expect(validarContacto({ nombre: 'Ana', vehiculos: [{ marca: 'Nissan', modelo: 'Versa', anio: '18' }] })).toEqual({ ok: false, mensaje: MENSAJES_CONTACTO.anio });
    expect(validarContacto({ nombre: 'Ana', vehiculos: [{ marca: 'Nissan', modelo: 'Versa', placas: 'AB#1' }] })).toEqual({ ok: false, mensaje: MENSAJES_CONTACTO.placas });
    const cuatro = Array.from({ length: 4 }, () => ({ marca: 'A', modelo: 'B' }));
    expect(validarContacto({ nombre: 'Ana', vehiculos: cuatro })).toEqual({ ok: false, mensaje: MENSAJES_CONTACTO.demasiadosVehiculos });
  });
});

describe('normalizar', () => {
  it('teléfono', () => {
    expect(normalizarTelefonoContacto('664 123 4567')).toBe('6641234567');
    expect(normalizarTelefonoContacto('5216641234567')).toBe('6641234567');
    expect(normalizarTelefonoContacto('')).toBe('');
    expect(normalizarTelefonoContacto('12345')).toBeNull();
  });
  it('placas y texto de búsqueda', () => {
    expect(normalizarPlacasContacto(' ab-12 3 ')).toBe('AB-123');
    expect(normalizarPlacasContacto('ñ1')).toBeNull();
    expect(textoBusqueda('  José  ÁLVAREZ ')).toBe('jose alvarez');
  });
});

describe('guardar y buscar', () => {
  it('campos derivados para buscar', () => {
    const c = camposContacto({ nombre: 'José Ruiz', telefono: '6641234567', nota: '', vehiculos: [{ marca: 'A', modelo: 'B', placas: 'X1' }, { marca: 'C', modelo: 'D' }] });
    expect(c).toEqual({ nombre: 'José Ruiz', nombreBusqueda: 'jose ruiz', telefono: '6641234567', nota: '', vehiculos: [{ marca: 'A', modelo: 'B', placas: 'X1' }, { marca: 'C', modelo: 'D' }], placasLista: ['X1'] });
  });
  it('se borra 548 días (18 meses) después', () => {
    expect(expiraContacto(0).getTime()).toBe(548 * 24 * 60 * 60 * 1000);
  });
  it('tipo de búsqueda en Firestore', () => {
    expect(tipoBusqueda('664 123 4567')).toEqual({ campo: 'telefono', valor: '6641234567' });
    expect(tipoBusqueda('abc-123')).toEqual({ campo: 'placasLista', valor: 'ABC-123' });
    expect(tipoBusqueda('José')).toEqual({ campo: 'nombreBusqueda', valor: 'jose' });
    expect(tipoBusqueda('  ')).toBeNull();
  });
  it('filtro en pantalla por nombre, teléfono o placas', () => {
    const c = { nombre: 'José Ruiz', telefono: '6641234567', vehiculos: [{ marca: 'A', modelo: 'B', placas: 'ABC123' }] };
    expect(coincide(c, 'jose')).toBe(true);
    expect(coincide(c, '1234')).toBe(true);
    expect(coincide(c, 'abc')).toBe(true);
    expect(coincide(c, 'maria')).toBe(false);
    expect(coincide(c, '')).toBe(true);
  });
});

describe('WhatsApp', () => {
  it('mensaje con el primer nombre y el taller', () => {
    expect(mensajeWhatsappContacto('Taller Ruiz', 'Juan Pérez')).toBe('Hola Juan, le escribimos de Taller Ruiz.');
    expect(enlaceWhatsappContacto('6641234567', 'Taller Ruiz', 'Juan')).toBe(`https://wa.me/526641234567?text=${encodeURIComponent('Hola Juan, le escribimos de Taller Ruiz.')}`);
    expect(enlaceWhatsappContacto('', 'Taller Ruiz', 'Juan')).toBeNull();
  });
});

describe('integración: vehiculoDesdeTexto, contactoDesdeDatos, sugerenciasDe', () => {
  it('separa marca, modelo y año del texto', async () => {
    const { vehiculoDesdeTexto, textoVehiculoSinPlacas } = await import('./contactosTaller');
    expect(vehiculoDesdeTexto('Nissan Versa 2018', 'abc 123')).toEqual({ marca: 'Nissan', modelo: 'Versa', anio: 2018, placas: 'ABC123' });
    expect(vehiculoDesdeTexto('  Chevrolet   Aveo  LT ')).toEqual({ marca: 'Chevrolet', modelo: 'Aveo LT' });
    expect(vehiculoDesdeTexto('Ford 2015')).toEqual({ marca: 'Ford', modelo: '2015' });
    expect(vehiculoDesdeTexto('Tsuru')).toBeNull();
    expect(vehiculoDesdeTexto('')).toBeNull();
    expect(textoVehiculoSinPlacas({ marca: 'Nissan', modelo: 'Versa', anio: 2018, placas: 'X' })).toBe('Nissan Versa 2018');
  });
  it('arma el contacto desde una orden o cotización', async () => {
    const { contactoDesdeDatos, validarContacto } = await import('./contactosTaller');
    const c = contactoDesdeDatos({ nombre: ' Juan ', telefono: '664 123 4567', vehiculo: { marca: 'Nissan', modelo: 'Versa', anio: 2018, placas: 'abc123' } });
    expect(c).toEqual({ nombre: 'Juan', telefono: '6641234567', nota: '', vehiculos: [{ marca: 'Nissan', modelo: 'Versa', anio: '2018', placas: 'ABC123' }] });
    expect(validarContacto(c).ok).toBe(true);
    expect(contactoDesdeDatos({ nombre: 'Ana', telefono: '123', vehiculo: { marca: 'Nissan', modelo: '' } })).toEqual({ nombre: 'Ana', telefono: '', nota: '', vehiculos: [] });
  });
  it('una sugerencia por vehículo', async () => {
    const { sugerenciasDe } = await import('./contactosTaller');
    expect(sugerenciasDe({ id: 'c01', vehiculos: [] }).map((s) => s.clave)).toEqual(['c01-0']);
    const dos = sugerenciasDe({ id: 'c02', vehiculos: [{ marca: 'A', modelo: 'B' }, { marca: 'C', modelo: 'D' }] });
    expect(dos.map((s) => s.vehiculo?.marca)).toEqual(['A', 'C']);
  });
});
