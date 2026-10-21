import { describe, expect, it } from 'vitest';
import textos from './textosLegalesTalleres.json';

describe('textos legales de talleres (texto final aprobado por el abogado el 11 de octubre de 2026)', () => {
  it('versión y fecha visibles', () => {
    expect(textos.version).toBe('talleres-2026-10-4');
    expect(textos.fecha).toBe('21 de octubre de 2026');
  });
  it('términos: 13 subtítulos (1.1 a 1.13) y 24 párrafos', () => {
    const subtitulos = textos.terminos.filter((i) => i.tipo === 'subtitulo');
    expect(subtitulos.map((s) => s.texto.split(' ')[0])).toEqual(['1.1', '1.2', '1.3', '1.4', '1.5', '1.6', '1.7', '1.8', '1.9', '1.10', '1.11', '1.12', '1.13']);
    expect(subtitulos.at(-4)?.texto).toBe('1.10 Documentos y expediente propio del Taller');
    expect(subtitulos.at(-3)?.texto).toBe('1.11 Planes y funciones de pago');
    expect(subtitulos.at(-2)?.texto).toBe('1.12 Módulo de Historial de Servicios y Recordatorios (Plan Premium)');
    expect(subtitulos.at(-1)?.texto).toBe('1.13 Responsabilidad del contenido y captura de información');
    expect(textos.terminos.filter((i) => i.tipo === 'parrafo')).toHaveLength(24);
  });
  it('1.4 vigente (quitar datos y eliminar con la versión aceptada), 1.6 con ACEPTO y 1.8.2 con los topes de los planes', () => {
    const t = textos.terminos.map((i) => i.texto).join('\n');
    expect(t).toContain('La Plataforma incluye la función «Quitar datos del cliente», mediante la cual el Taller activo que haya aceptado la versión vigente de los Términos puede eliminar nombre, teléfono y placas de una cotización o de una orden de servicio.');
    expect(t).toContain('escribiendo la palabra «ACEPTO»');
    expect(t).toContain('limitada a un monto fijo máximo. Mientras el servicio de talleres sea gratuito, el tope máximo de responsabilidad será de $5,000.00 MXN. Si el Taller contrata un plan de pago, el tope será el del plan contratado al momento del evento: plan Básico hasta $5,000.00 MXN y plan Premium hasta $15,000.00 MXN.');
    expect(t).not.toContain('Plan Pro');
    expect(t).not.toContain('Plan Empresarial');
  });
  it('1.2 con CallMeBot y 1.11 con el precio del plan Premium', () => {
    const t = textos.terminos.map((i) => i.texto).join('\n');
    expect(t).toContain('Google LLC (Firebase / Google Cloud), Vercel Inc. y CallMeBot.');
    expect(t).toContain('un plan Premium, de pago, con un precio de $398.00 MXN al mes más IVA.');
  });
  it('1.9: solicitudes de piezas a yonkes, sin datos del Cliente del Taller', () => {
    const t = textos.terminos.map((i) => i.texto).join('\n');
    expect(t).toContain('1.9 Solicitudes de piezas a yonkes');
    expect(t).toContain('sin incluir datos personales del Cliente del Taller');
    expect(t).toContain('no garantiza que algún yonke tenga la pieza, su estado, su precio ni su disponibilidad');
    expect(t).toContain('Los yonkes que tienen la pieza responden en la Plataforma con su precio.');
    expect(t).not.toContain('El primer yonke que confirme');
  });
  it('privacidad: 17 párrafos (encabezado de responsable, 2.1 a 2.8)', () => {
    expect(textos.privacidad).toHaveLength(17);
    expect(textos.privacidad.filter((i) => i.tipo === 'subtitulo').map((s) => s.texto.split(' ')[0])).toEqual(['2.1', '2.2', '2.3', '2.4', '2.5', '2.6', '2.7', '2.8']);
    expect(textos.privacidad[0].texto.startsWith('Responsable de los datos de la cuenta del Taller')).toBe(true);
  });
  it('2.6: comparte con yonkes los datos de la solicitud, nunca los del Cliente del Taller', () => {
    const p = textos.privacidad.map((i) => i.texto).join('\n');
    expect(p).toContain('2.6 Solicitudes de piezas a yonkes');
    expect(p).toContain('Mecanix no comparte con los yonkes datos personales del Cliente del Taller.');
    expect(p).toContain('El WhatsApp del Taller solo se muestra al yonke que el Taller elige');
  });
  it('avisos de la cotización por versión: aviso-taller-1 y aviso-taller-2, en ese orden', () => {
    expect(textos.avisosTaller.map((a) => a.version)).toEqual(['aviso-taller-1', 'aviso-taller-2']);
  });
  it('plantilla aviso-taller-1 completa, intacta y con sus marcadores sin llenar', () => {
    const v1 = textos.avisosTaller[0];
    expect(v1.plantilla).toHaveLength(9);
    expect(v1.plantilla.map((p) => p.texto).join('\n')).toContain('[Nombre del taller]');
    expect(v1.plantilla[4].texto).toBe('Plazo. Sus datos se eliminan de la plataforma a los 90 días de elaborada la cotización y pueden permanecer en copias de seguridad por un periodo adicional de hasta seis meses. Si usted no acepta la cotización, esta se elimina de inmediato.');
    expect(v1.plantilla[8].texto).toBe('Versión del aviso: aviso-taller-1');
  });
  it('aviso-taller-2: igual a aviso-taller-1 salvo el párrafo "Plazo" y la versión al pie', () => {
    const [v1, v2] = textos.avisosTaller;
    expect(v2.plantilla).toHaveLength(9);
    v2.plantilla.forEach((p, i) => {
      if (i === 4 || i === 8) return;
      expect(p).toEqual(v1.plantilla[i]);
    });
    expect(v2.plantilla[4].texto).toBe('Plazo. Si usted aprueba la cotización, esta se convierte en una orden de trabajo y la cotización se elimina de la plataforma para ahorrar espacio de almacenamiento; [nombre del taller] puede imprimirla o conservarla para su contabilidad, lo cual ya no compete a Mecanix. Si usted no la aprueba, esta se elimina de inmediato. En cualquier caso, sus datos se eliminan de la plataforma a más tardar a los 90 días de elaborada la cotización y pueden permanecer en copias de seguridad por un periodo adicional de hasta seis meses.');
    expect(v2.plantilla[8].texto).toBe('Versión del aviso: aviso-taller-2');
  });
  it('aviso de cambios: el texto aprobado, sin comillas «» alrededor (solo las de «ACEPTO»)', () => {
    expect(textos.resumenCambios.startsWith('Actualizamos los Términos y Condiciones y el Aviso de Privacidad para incluir el Historial de Servicios y Recordatorios del plan Premium.')).toBe(true);
    expect(textos.resumenCambios.endsWith('solo podrás visualizar, reimprimir y descargar tus documentos anteriores.')).toBe(true);
    expect(textos.resumenCambios.replace('«ACEPTO»', '')).not.toMatch(/[«»]/);
  });
  it('enlaces a la sección de talleres', () => {
    expect(textos.urls.terminosTalleres).toBe('https://mecanixyonkevirtual.com/terminos#talleres');
    expect(textos.urls.privacidadTalleres).toBe('https://mecanixyonkevirtual.com/privacidad#talleres');
  });
  it('no publica las secciones internas del documento (decisiones y pendientes)', () => {
    const todo = JSON.stringify(textos);
    expect(todo).not.toContain('Decisiones del abogado');
    expect(todo).not.toContain('Pendientes del abogado');
  });

  it('1.12 historial y recordatorios (Premium) y 1.13 responsabilidad del contenido', () => {
    const t = textos.terminos.map((i) => i.texto).join('\n');
    expect(t).toContain('El historial se nutre exclusivamente de las órdenes de servicio que el Taller registra como entregadas.');
    expect(t).toContain('placas, marca, modelo, año, fecha de entrega, kilometraje, descripción técnica de los trabajos realizados y de las piezas');
    expect(t).toContain('recordatorios internos que el Taller configure (tipo de servicio, fecha, anticipación del aviso y estado)');
    expect(t).toContain('Mecanix no almacena en el historial nombres, números telefónicos ni otros datos de contacto del Cliente final, ni precios.');
    expect(t).toContain('únicamente mientras esa orden exista en la Plataforma. Mecanix jamás contacta al Cliente final del Taller');
    expect(t).toContain('aun cuando su plan Premium haya vencido o tenga pendiente aceptar una nueva versión de estos Términos');
    expect(t).toContain('por más de 18 meses se eliminan de forma automática e irreversible; la Plataforma muestra un aviso en el panel del Taller 30 días antes');
    expect(t).toContain('Los datos del historial son propiedad operativa del Taller. Mecanix actúa únicamente como proveedor tecnológico');
    expect(t).toContain('se obliga a no escribir en esos campos nombres, teléfonos, correos electrónicos ni otros datos personales de sus Clientes');
    expect(t).toContain('es solo una medida de auxilio y no exime al Taller de esta obligación. Mecanix podrá eliminar los registros que contravengan');
  });
  it('2.8 privacidad: Mecanix como encargado del historial; placas como dato personal indirecto', () => {
    const p = textos.privacidad.map((i) => i.texto).join('\n');
    expect(p).toContain('2.8 Tratamiento de datos por cuenta de talleres (módulo Historial de vehículos)');
    expect(p).toContain('Mecanix actúa como encargado, por cuenta del Taller, que es el responsable.');
    expect(p).toContain('Las placas, junto con la marca, el modelo y el año, pueden constituir datos personales de forma indirecta.');
    expect(p).toContain('únicamente para proveer el historial y las alertas internas del Taller; no recopila datos de contacto del Cliente final dentro del historial, no contacta a los Clientes de los Talleres y elimina automáticamente los registros tras 18 meses de inactividad.');
  });
});
