import { describe, expect, it } from 'vitest';
import textos from './textosLegalesTalleres.json';
import { EN_BLANCO, MARCADOR_PENDIENTE, VERSION_AVISO_ORDEN, VERSIONES_AVISO_ORDEN, armarAvisoOrden, avisoOrdenListo, datosClienteDisponibles } from './avisoOrden';

// Un aviso "final" de prueba (NO es texto legal: solo para probar el armado).
const listo = {
  version: 'aviso-orden-1',
  aviso: [{ tipo: 'parrafo', texto: 'Título de prueba' }, { tipo: 'parrafo', texto: 'Responsable: [Nombre del taller], [ciudad], [WhatsApp del taller]. Contacto: [medio de contacto del taller].' }],
  constancia: [{ tipo: 'parrafo', texto: 'Constancia de prueba' }, { tipo: 'parrafo', texto: 'Orden [folio] recibida el [fecha de recepción].' }, { tipo: 'parrafo', texto: 'Firma: ____' }],
};
const config = { datosClienteHabilitados: true, avisoOrdenVersion: 'aviso-orden-1' };

describe('aviso de privacidad de órdenes (falla cerrada)', () => {
  type Hoja = { version: string; aviso: { texto: string }[]; constancia: { texto: string }[] };
  const avisos = (textos as unknown as { avisosOrden: Hoja[] }).avisosOrden;
  const HISTORIAL = 'Historial Digital de Servicios y recordatorios de mantenimiento. Para conservar un registro de los trabajos realizados en su vehículo, dar seguimiento a las garantías relacionadas con dichos trabajos y facilitar la planificación de futuros mantenimientos, el Taller podrá incorporar al Historial Digital de Servicios los datos del vehículo, incluidas las placas, marca, modelo, año, kilometraje y los registros técnicos de los servicios realizados.';

  it('el archivo trae las DOS versiones (aviso-orden-1 y aviso-orden-2), sin el marcador "[TEXTO LEGAL PENDIENTE]"', () => {
    expect(MARCADOR_PENDIENTE).toBe('[TEXTO LEGAL PENDIENTE]');
    expect(avisos.map((a) => a.version)).toEqual(['aviso-orden-1', 'aviso-orden-2']);
    expect(VERSIONES_AVISO_ORDEN).toEqual(['aviso-orden-1', 'aviso-orden-2']);
    expect(VERSION_AVISO_ORDEN).toBe('aviso-orden-2');
    expect(JSON.stringify(avisos)).not.toContain(MARCADOR_PENDIENTE);
    expect(avisoOrdenListo()).toBe(true);
    expect(avisoOrdenListo('aviso-orden-1')).toBe(true);
    expect(avisoOrdenListo('aviso-orden-2')).toBe(true);
    expect(avisoOrdenListo('aviso-orden-0')).toBe(false);
    expect(avisoOrdenListo('aviso-orden-9')).toBe(false);
  });
  it('aviso-orden-1: su texto original (8 párrafos, sin el párrafo del Historial Digital)', () => {
    const v1 = avisos[0];
    expect(v1.aviso).toHaveLength(8);
    expect(v1.aviso[0].texto).toBe('Aviso de privacidad de la orden de servicio');
    expect(v1.aviso[4].texto.startsWith('Plazo.')).toBe(true);
    expect(v1.aviso[5].texto.startsWith('Sus derechos.')).toBe(true);
    expect(v1.aviso.at(-1)?.texto).toBe('Versión del aviso: aviso-orden-1');
    expect(v1.aviso.map((p) => p.texto)).not.toContain(HISTORIAL);
    expect(v1.constancia).toHaveLength(6);
  });
  it('aviso-orden-2: igual a aviso-orden-1 más el bloque del Historial Digital (6 párrafos, texto del abogado) después de "Plazo", y su versión al pie', () => {
    const [v1, v2] = avisos;
    expect(v2.aviso).toHaveLength(14);
    expect(v2.aviso[5].texto).toBe(HISTORIAL);
    const bloque = v2.aviso.slice(5, 11).map((p) => p.texto).join('\n');
    expect(bloque).toContain('el Taller podrá utilizar el número telefónico que usted proporcionó en su orden de servicio para contactarle por WhatsApp');
    expect(bloque).toContain('Mecanix no envía estos mensajes directamente por medio de los recordatorios internos.');
    expect(bloque).toContain('cuando transcurran más de 18 meses sin que el Taller incorpore a dicho historial una nueva orden de servicio registrada como entregada');
    expect(bloque).toContain('no modifica por sí mismo el plazo de conservación de la orden de servicio original');
    // La orden solo pide nombre y teléfono: el aviso no menciona correo.
    expect(bloque).toContain('Los datos de contacto, como su nombre y número telefónico, no se incorporan al Historial Digital por esta función.');
    expect([...v2.aviso, ...v2.constancia].map((p) => p.texto).join('\n')).not.toMatch(/correo/i);
    expect(v2.aviso[10].texto.startsWith('Si desea solicitar la eliminación del historial de su vehículo o dejar de recibir recordatorios por WhatsApp')).toBe(true);
    expect([...v2.aviso.slice(0, 5), ...v2.aviso.slice(11, 13)]).toEqual(v1.aviso.slice(0, 7));
    expect(v2.aviso.at(-1)?.texto).toBe('Versión del aviso: aviso-orden-2');
    expect(v2.constancia).toEqual(v1.constancia);
  });
  it('datos del cliente: orden nueva con la versión de la consola; orden existente con la SUYA', () => {
    expect(datosClienteDisponibles(null)).toBe(false);
    expect(datosClienteDisponibles({ datosClienteHabilitados: false, avisoOrdenVersion: 'aviso-orden-2' })).toBe(false);
    expect(datosClienteDisponibles({ datosClienteHabilitados: true, avisoOrdenVersion: 'aviso-orden-0' })).toBe(false);
    // Orden nueva: consola en aviso-orden-1 (hoy) o en aviso-orden-2.
    expect(datosClienteDisponibles({ datosClienteHabilitados: true, avisoOrdenVersion: 'aviso-orden-1' })).toBe(true);
    expect(datosClienteDisponibles({ datosClienteHabilitados: true, avisoOrdenVersion: 'aviso-orden-2' })).toBe(true);
    // Orden existente aviso-orden-1 con la consola ya en aviso-orden-2: conserva sus datos.
    expect(datosClienteDisponibles({ datosClienteHabilitados: true, avisoOrdenVersion: 'aviso-orden-2' }, 'aviso-orden-1')).toBe(true);
    // Orden sin aviso (aviso-orden-0): nunca.
    expect(datosClienteDisponibles({ datosClienteHabilitados: true, avisoOrdenVersion: 'aviso-orden-2' }, 'aviso-orden-0')).toBe(false);
  });
  it('el PDF arma cada orden con el texto de SU versión; una versión que no existe, nada', () => {
    const t = { nombre: 'Taller Peña', ciudad: 'Tijuana', whatsapp: '6641234567' };
    const o = { folio: 'O261011-7KQ4', creadoAt: new Date(2026, 9, 11) };
    expect(armarAvisoOrden(t, o, 'aviso-orden-1')?.aviso.parrafos).not.toContain(HISTORIAL);
    expect(armarAvisoOrden(t, o, 'aviso-orden-1')?.version).toBe('aviso-orden-1');
    expect(armarAvisoOrden(t, o, 'aviso-orden-2')?.aviso.parrafos).toContain(HISTORIAL);
    expect(armarAvisoOrden(t, o, 'aviso-orden-2')?.version).toBe('aviso-orden-2');
    expect(armarAvisoOrden(t, o, 'aviso-orden-0')).toBeNull();
    expect(armarAvisoOrden(t, o, 'aviso-orden-9')).toBeNull();
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
