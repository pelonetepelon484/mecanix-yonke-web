import { describe, expect, it } from 'vitest';
import textos from './textosLegalesTalleres.json';

describe('textos legales de talleres (publicados tal cual del documento del abogado)', () => {
  it('versión y fecha visibles', () => {
    expect(textos.version).toBe('talleres-2026-10-1');
    expect(textos.fecha).toBe('6 de octubre de 2026');
  });
  it('términos: 8 subtítulos (1.1 a 1.8) y 12 párrafos', () => {
    const subtitulos = textos.terminos.filter((i) => i.tipo === 'subtitulo');
    expect(subtitulos.map((s) => s.texto.slice(0, 3))).toEqual(['1.1', '1.2', '1.3', '1.4', '1.5', '1.6', '1.7', '1.8']);
    expect(textos.terminos.filter((i) => i.tipo === 'parrafo')).toHaveLength(12);
  });
  it('cláusula 1.4 en futuro y 1.8.2 con el tope del Plan Básico', () => {
    const t = textos.terminos.map((i) => i.texto).join('\n');
    expect(t).toContain('Cuando se active la captura de datos personales del Cliente, la Plataforma incluirá la función «Quitar datos del cliente»');
    expect(t).toContain('Mientras el servicio de talleres sea gratuito, el tope máximo de responsabilidad será de $5,000.00 MXN.');
  });
  it('privacidad: 11 párrafos (encabezado de responsable, 2.1 a 2.5)', () => {
    expect(textos.privacidad).toHaveLength(11);
    expect(textos.privacidad[0].texto.startsWith('Responsable de los datos de la cuenta del Taller')).toBe(true);
  });
  it('plantilla aviso-taller-1 completa y con sus marcadores sin llenar', () => {
    expect(textos.avisoTaller.version).toBe('aviso-taller-1');
    expect(textos.avisoTaller.plantilla).toHaveLength(9);
    expect(textos.avisoTaller.plantilla.map((p) => p.texto).join('\n')).toContain('[Nombre del taller]');
  });
  it('aviso de cambios sin las comillas «» del documento', () => {
    expect(textos.resumenCambios.startsWith('Actualizamos los Términos y Condiciones')).toBe(true);
    expect(textos.resumenCambios).not.toContain('«');
    expect(textos.resumenCambios).not.toContain('»');
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
