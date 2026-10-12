import { describe, expect, it } from 'vitest';
import textos from './textosLegalesTalleres.json';

describe('textos legales de talleres (texto final aprobado por el abogado el 11 de octubre de 2026)', () => {
  it('versión y fecha visibles', () => {
    expect(textos.version).toBe('talleres-2026-10-3');
    expect(textos.fecha).toBe('12 de octubre de 2026');
  });
  it('términos: 11 subtítulos (1.1 a 1.11) y 19 párrafos', () => {
    const subtitulos = textos.terminos.filter((i) => i.tipo === 'subtitulo');
    expect(subtitulos.map((s) => s.texto.split(' ')[0])).toEqual(['1.1', '1.2', '1.3', '1.4', '1.5', '1.6', '1.7', '1.8', '1.9', '1.10', '1.11']);
    expect(subtitulos.at(-2)?.texto).toBe('1.10 Documentos y expediente propio del Taller');
    expect(subtitulos.at(-1)?.texto).toBe('1.11 Planes y funciones de pago');
    expect(textos.terminos.filter((i) => i.tipo === 'parrafo')).toHaveLength(19);
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
  it('privacidad: 15 párrafos (encabezado de responsable, 2.1 a 2.7)', () => {
    expect(textos.privacidad).toHaveLength(15);
    expect(textos.privacidad.filter((i) => i.tipo === 'subtitulo').map((s) => s.texto.split(' ')[0])).toEqual(['2.1', '2.2', '2.3', '2.4', '2.5', '2.6', '2.7']);
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
    expect(textos.resumenCambios.startsWith('Actualizamos los Términos y Condiciones y el Aviso de Privacidad para incluir las órdenes de servicio.')).toBe(true);
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
});
