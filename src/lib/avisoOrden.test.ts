import { describe, expect, it } from 'vitest';
import textos from './textosLegalesTalleres.json';
import { EN_BLANCO, MARCADOR_PENDIENTE, VERSION_AVISO_ORDEN, armarAvisoOrden, avisoOrdenListo, datosClienteDisponibles } from './avisoOrden';

// Un aviso "final" de prueba (NO es texto legal: solo para probar el armado).
const listo = {
  version: 'aviso-orden-1',
  aviso: [{ tipo: 'parrafo', texto: 'Título de prueba' }, { tipo: 'parrafo', texto: 'Responsable: [Nombre del taller], [ciudad], [WhatsApp del taller]. Contacto: [medio de contacto del taller].' }],
  constancia: [{ tipo: 'parrafo', texto: 'Constancia de prueba' }, { tipo: 'parrafo', texto: 'Orden [folio] recibida el [fecha de recepción].' }, { tipo: 'parrafo', texto: 'Firma: ____' }],
};
const config = { datosClienteHabilitados: true, avisoOrdenVersion: 'aviso-orden-1' };

describe('aviso de privacidad de órdenes (falla cerrada)', () => {
  it('hoy el archivo trae el marcador "[TEXTO LEGAL PENDIENTE]" y la versión aviso-orden-1', () => {
    expect(MARCADOR_PENDIENTE).toBe('[TEXTO LEGAL PENDIENTE]');
    expect(VERSION_AVISO_ORDEN).toBe('aviso-orden-1');
    expect(JSON.stringify((textos as { avisoOrden: unknown }).avisoOrden)).toContain(MARCADOR_PENDIENTE);
  });
  it('con el marcador NO está listo: ni campos del cliente ni hoja de aviso', () => {
    expect(avisoOrdenListo()).toBe(false);
    expect(avisoOrdenListo('aviso-orden-1')).toBe(false);
    expect(datosClienteDisponibles(config)).toBe(false);
    expect(armarAvisoOrden({ nombre: 'T' }, {}, 'aviso-orden-1')).toBeNull();
  });
  it('si queda AUNQUE SEA un párrafo con el marcador, o una lista vacía, sigue cerrado', () => {
    expect(avisoOrdenListo(undefined, { ...listo, constancia: [{ texto: `Algo ${MARCADOR_PENDIENTE}` }] })).toBe(false);
    expect(avisoOrdenListo(undefined, { ...listo, aviso: [] })).toBe(false);
    expect(avisoOrdenListo(undefined, { ...listo, version: '' })).toBe(false);
  });
  it('con texto final: listo solo si la versión coincide', () => {
    expect(avisoOrdenListo(undefined, listo)).toBe(true);
    expect(avisoOrdenListo('aviso-orden-1', listo)).toBe(true);
    expect(avisoOrdenListo('aviso-orden-0', listo)).toBe(false);
  });
  it('datos del cliente: bandera + texto listo + versión de config + versión de la orden', () => {
    expect(datosClienteDisponibles(config, undefined, listo)).toBe(true);
    expect(datosClienteDisponibles(config, 'aviso-orden-1', listo)).toBe(true);
    expect(datosClienteDisponibles(config, 'aviso-orden-0', listo)).toBe(false); // orden vieja
    expect(datosClienteDisponibles({ ...config, datosClienteHabilitados: false }, undefined, listo)).toBe(false);
    expect(datosClienteDisponibles({ ...config, datosClienteHabilitados: 'true' }, undefined, listo)).toBe(false);
    expect(datosClienteDisponibles({ ...config, avisoOrdenVersion: 'aviso-orden-2' }, undefined, listo)).toBe(false);
    expect(datosClienteDisponibles(null, undefined, listo)).toBe(false);
  });
  it('arma las dos hojas con los datos del taller y de la orden; lo que falta queda en blanco', () => {
    const r = armarAvisoOrden({ nombre: 'Taller Peña', ciudad: 'Tijuana', whatsapp: '6641234567' }, { folio: 'O261011-7KQ4', creadoAt: new Date(2026, 9, 11) }, 'aviso-orden-1', listo);
    expect(r?.version).toBe('aviso-orden-1');
    expect(r?.aviso.titulo).toBe('Título de prueba');
    expect(r?.aviso.parrafos).toEqual(['Responsable: Taller Peña, Tijuana, 664 123 4567. Contacto: WhatsApp 664 123 4567.']);
    expect(r?.constancia.parrafos).toEqual(['Orden O261011-7KQ4 recibida el 11 de octubre de 2026.', 'Firma: ____']);
    const vacio = armarAvisoOrden(null, null, undefined, listo);
    expect(vacio?.aviso.parrafos[0]).toBe(`Responsable: ${EN_BLANCO}, ${EN_BLANCO}, ${EN_BLANCO}. Contacto: ${EN_BLANCO}.`);
    const todo = [...(vacio?.aviso.parrafos ?? []), ...(vacio?.constancia.parrafos ?? [])].join('\n');
    expect(todo).not.toMatch(/\[[^\]]+\]/); // ningún marcador sin llenar
  });
});
