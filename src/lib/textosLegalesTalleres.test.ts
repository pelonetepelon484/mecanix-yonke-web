import { describe, expect, it } from 'vitest';
import textos from './textosLegalesTalleres.json';

describe('textos legales de talleres (texto final aprobado por el abogado el 11 de octubre de 2026)', () => {
  it('versión y fecha visibles', () => {
    expect(textos.version).toBe('talleres-2026-10-4');
    expect(textos.fecha).toBe('21 de octubre de 2026');
  });
  it('términos: 13 subtítulos (1.1 a 1.13) y 41 párrafos', () => {
    const subtitulos = textos.terminos.filter((i) => i.tipo === 'subtitulo');
    expect(subtitulos.map((s) => s.texto.split(' ')[0])).toEqual(['1.1', '1.2', '1.3', '1.4', '1.5', '1.6', '1.7', '1.8', '1.9', '1.10', '1.11', '1.12', '1.13']);
    expect(subtitulos.at(-4)?.texto).toBe('1.10 Documentos y expediente propio del Taller');
    expect(subtitulos.at(-3)?.texto).toBe('1.11 Planes y funciones de pago');
    expect(subtitulos.at(-2)?.texto).toBe('1.12 Módulo de Historial de Servicios y Recordatorios (Plan Premium)');
    expect(subtitulos.at(-1)?.texto).toBe('1.13 Responsabilidad sobre el contenido y la información registrada');
    expect(textos.terminos.filter((i) => i.tipo === 'parrafo')).toHaveLength(41);
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
  it('privacidad: 28 elementos (encabezado de responsable, 2.1 a 2.8)', () => {
    expect(textos.privacidad).toHaveLength(28);
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

  it('1.12 historial y recordatorios (Premium) y 1.13 responsabilidad sobre la información', () => {
    const t = textos.terminos.map((i) => i.texto).join('\n');
    expect(t).toContain('Descripción y funcionamiento. El Módulo de Historial de Servicios y Recordatorios forma parte del plan Premium');
    expect(t).toContain('El historial se genera a partir de las órdenes de servicio que el Taller registra como entregadas en la Plataforma.');
    expect(t).toContain('No está destinado a almacenar nombres, números telefónicos, correos electrónicos ni otros datos de contacto del Cliente final, ni los precios de los servicios.');
    expect(t).toContain('no significa que Mecanix envíe mensajes por cuenta propia. Los recordatorios del módulo son avisos internos dirigidos al Taller.');
    expect(t).toContain('incluso si su plan Premium ha vencido o está pendiente la aceptación de una nueva versión de estos Términos.');
    expect(t).toContain('Cuando un vehículo permanezca más de 18 meses sin que el Taller incorpore a su Historial Digital una nueva orden de servicio registrada como entregada');
    expect(t).toContain('El Taller recibirá un aviso en su panel con al menos 30 días de anticipación.');
    expect(t).toContain('se tomará como referencia la fecha en que el Taller incorpore al historial una nueva orden de servicio registrada como entregada. La entrega de una orden que no se incorpore al historial no reiniciará el plazo.');
    expect(t).toContain('mediante la función «Descargar mi historial» disponible en la Plataforma. Esta función estará disponible aunque el plan Premium haya vencido');
    expect(t).toContain('La descarga no restablece ni amplía el plazo de conservación del historial');
    expect(t).toContain('el Taller se obliga a no registrar nombres, números telefónicos, correos electrónicos ni otros datos personales en los campos destinados al Historial Digital de Servicios.');
    expect(t).toContain('Estas advertencias son una medida de apoyo y no sustituyen la obligación del Taller de revisar la información que registra.');
    expect(t).toContain('Ninguna disposición de esta cláusula exime a alguna de las partes');
  });
  it('2.8 privacidad: el Taller responsable y Mecanix encargado del historial; plazo de 18 meses', () => {
    const p = textos.privacidad.map((i) => i.texto).join('\n');
    expect(p).toContain('2.8 Tratamiento de datos por cuenta de los Talleres (Historial de vehículos)');
    expect(p).toContain('en determinadas circunstancias puede permitir identificar a una persona, directa o indirectamente.');
    expect(p).toContain('el Taller determina las finalidades del tratamiento y actúa como responsable, mientras que Mecanix actúa como encargado');
    expect(p).toContain('Los recordatorios están dirigidos al Taller y no implican que Mecanix contacte directamente a sus clientes.');
    expect(p).toContain('cuando transcurran más de 18 meses sin que el Taller incorpore al Historial Digital una nueva orden de servicio registrada como entregada para el vehículo, el historial se eliminará automáticamente.');
    expect(p).toContain('así como la modificación de notas, datos o recordatorios, no reiniciará el plazo.');
    expect(p).toContain('podrá descargar una copia de su historial mediante la función «Descargar mi historial»');
    expect(p).toContain('Mecanix colaborará con el Taller cuando sea necesario localizar, corregir, exportar o eliminar registros dentro de la Plataforma.');
  });
});
