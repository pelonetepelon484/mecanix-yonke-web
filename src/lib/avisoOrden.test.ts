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
  it('el archivo ya trae el texto final aviso-orden-2 (sin el marcador "[TEXTO LEGAL PENDIENTE]")', () => {
    expect(MARCADOR_PENDIENTE).toBe('[TEXTO LEGAL PENDIENTE]');
    expect(VERSION_AVISO_ORDEN).toBe('aviso-orden-2');
    expect(JSON.stringify((textos as { avisoOrden: unknown }).avisoOrden)).not.toContain(MARCADOR_PENDIENTE);
    expect(avisoOrdenListo()).toBe(true);
    expect(avisoOrdenListo('aviso-orden-2')).toBe(true);
    // La versión anterior ya no es la del archivo: no se imprime un aviso que no corresponde.
    expect(avisoOrdenListo('aviso-orden-1')).toBe(false);
    expect(avisoOrdenListo('aviso-orden-0')).toBe(false);
  });
  it('texto final: títulos, primer y último párrafo de cada hoja', () => {
    const { aviso, constancia } = (textos as { avisoOrden: { aviso: { texto: string }[]; constancia: { texto: string }[] } }).avisoOrden;
    expect(aviso).toHaveLength(9);
    expect(aviso[0].texto).toBe('Aviso de privacidad de la orden de servicio');
    expect(aviso[1].texto.startsWith('Responsable. [Nombre del taller], con domicilio en [ciudad]')).toBe(true);
    expect(aviso.at(-1)?.texto).toBe('Versión del aviso: aviso-orden-2');
    // Párrafo del Historial Digital (texto exacto), justo después de "Plazo".
    expect(aviso[4].texto.startsWith('Plazo.')).toBe(true);
    expect(aviso[5].texto).toBe('Asimismo, le informamos que los datos de su vehículo (placas, marca, modelo, año, el registro técnico de los servicios realizados y el kilometraje) se incorporarán a nuestro Historial Digital de Servicios para dar seguimiento a la garantía, mantener un expediente de mantenimiento preventivo y recordarnos sus próximos servicios recomendados. Sus datos de contacto no se incorporan al Historial Digital; se conservan únicamente en su orden de servicio por el plazo señalado en este aviso. Usted puede solicitar al taller, en cualquier momento, que elimine su vehículo del Historial Digital.');
    expect(constancia).toHaveLength(6);
    expect(constancia[0].texto).toBe('Constancia de recepción del vehículo');
    expect(constancia[1].texto).toBe('Orden de servicio [folio]. Fecha de recepción: [fecha de recepción].');
    expect(constancia.at(-1)?.texto).toBe('Nombre y firma del cliente: ______________________________ Fecha: ______________');
  });
  it('los datos del cliente siguen apagados mientras config/ordenes no los encienda (interruptor de la consola)', () => {
    expect(datosClienteDisponibles(null)).toBe(false);
    expect(datosClienteDisponibles({ datosClienteHabilitados: false, avisoOrdenVersion: 'aviso-orden-2' })).toBe(false);
    expect(datosClienteDisponibles({ datosClienteHabilitados: true, avisoOrdenVersion: 'aviso-orden-0' })).toBe(false);
    expect(datosClienteDisponibles({ datosClienteHabilitados: true, avisoOrdenVersion: 'aviso-orden-2' })).toBe(true);
    // Con la consola todavía en aviso-orden-1 (texto nuevo publicado antes de cambiarla): apagados.
    expect(datosClienteDisponibles({ datosClienteHabilitados: true, avisoOrdenVersion: 'aviso-orden-1' })).toBe(false);
  });
  it('armado con el texto real: llena los datos, no deja marcadores y no repite la versión (va al pie)', () => {
    const r = armarAvisoOrden({ nombre: 'Taller Peña', ciudad: 'Tijuana', whatsapp: '6641234567' }, { folio: 'O261011-7KQ4', creadoAt: new Date(2026, 9, 11) }, 'aviso-orden-2');
    expect(r?.aviso.titulo).toBe('Aviso de privacidad de la orden de servicio');
    expect(r?.aviso.parrafos[0]).toBe('Responsable. Taller Peña, con domicilio en Tijuana y contacto en 664 123 4567, es el responsable de los datos personales que usted proporciona para recibir su vehículo y para elaborar y dar seguimiento a la orden de servicio O261011-7KQ4.');
    expect(r?.aviso.parrafos.some((p) => p.startsWith('Versión del aviso'))).toBe(false);
    expect(r?.constancia.parrafos[0]).toBe('Orden de servicio O261011-7KQ4. Fecha de recepción: 11 de octubre de 2026.');
    const todo = [...(r?.aviso.parrafos ?? []), ...(r?.constancia.parrafos ?? [])].join('\n');
    expect(todo).not.toMatch(/\[[^\]]+\]/);
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
