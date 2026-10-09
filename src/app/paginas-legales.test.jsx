// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import Privacidad from './privacidad/page.js';
import Terminos from './terminos/page.js';
import { VERSION_LEGAL } from '../lib/versionesLegales';

// Texto de "Avisar a los yonkes" aprobado por el abogado tal cual (legal-pedido-clientes-para-abogado.md):
// la sección 2 va al Aviso de Privacidad y la 3 a los Términos. Las frases con [POR CONFIRMAR]
// quedan fuera hasta que el abogado las resuelva; todo lo demás debe aparecer sin cambios.
const md = readFileSync(join(process.cwd(), 'legal-pedido-clientes-para-abogado.md'), 'utf8');

function seccion(numero) {
  const inicio = md.indexOf(`## ${numero}. `);
  const fin = md.indexOf('\n## ', inicio + 1);
  return md.slice(inicio, fin === -1 ? undefined : fin).split('\n').slice(1);
}

// Líneas que deben publicarse: sin encabezados de ubicación ("### Para los ..."), sin notas en
// cursiva, sin separadores, y sin las frases que llevan [POR CONFIRMAR].
function lineasPublicables(lineas) {
  return lineas
    .filter((l) => l.trim() && l.trim() !== '---' && !/^\*[^*]/.test(l.trim()) && !/^### Para los /.test(l))
    .map((l) => l.replace(/^### /, '').replace(/^- /, ''))
    .map((l) => l.split(/(?<=\.)\s+(?=\*\*|[A-ZÁÉÍÓÚÑ])/).filter((frase) => !frase.includes('POR CONFIRMAR')).join(' '))
    .map((l) => l.replace(/\*\*/g, '').trim())
    .filter(Boolean);
}

const textoDe = (Pagina) => render(<Pagina />).container.textContent.replace(/\s+/g, ' ');

afterEach(() => cleanup());

describe('textos legales de "Avisar a los yonkes"', () => {
  it('el Aviso de Privacidad trae la sección 14 completa, tal cual se aprobó, y Contacto pasa a 15', () => {
    const texto = textoDe(Privacidad);
    const lineas = lineasPublicables(seccion(2));
    expect(lineas.length).toBeGreaterThan(15);
    for (const linea of lineas) expect(texto).toContain(linea);
    expect(texto).toContain('14. Clientes que piden una pieza a los yonkes ("Avisar a los yonkes")');
    expect(texto).toContain('15. Contacto');
    expect(texto).toContain('13. Talleres y cotizaciones');
  });
  it('los Términos traen lo de clientes en la sección 8 y lo de yonkes en la 6, tal cual se aprobó', () => {
    const texto = textoDe(Terminos);
    const lineas = lineasPublicables(seccion(3));
    expect(lineas.length).toBeGreaterThan(10);
    for (const linea of lineas) expect(texto).toContain(linea);
    const s6 = texto.indexOf('6. Responsabilidades del yonke');
    const s7 = texto.indexOf('7. Datos de terceros');
    const s8 = texto.indexOf('8. Responsabilidades del cliente');
    const s9 = texto.indexOf('9. Insignias y distintivos');
    expect(texto.indexOf('Respuestas a pedidos de Clientes.')).toBeGreaterThan(s6);
    expect(texto.indexOf('Respuestas a pedidos de Clientes.')).toBeLessThan(s7);
    expect(texto.indexOf('Pedidos de piezas a los yonkes.')).toBeGreaterThan(s8);
    expect(texto.indexOf('Pedidos de piezas a los yonkes.')).toBeLessThan(s9);
    expect(texto).toContain('23. Contacto');
  });
  it('ninguna página publica un [POR CONFIRMAR] ni las frases que dependen de él', () => {
    for (const Pagina of [Privacidad, Terminos]) {
      const texto = textoDe(Pagina);
      expect(texto).not.toContain('POR CONFIRMAR');
      expect(texto).not.toContain('El sistema de borrado automático puede tardar');
      cleanup();
    }
  });
  it('fecha de última actualización y VERSION_LEGAL de hoy', () => {
    expect(VERSION_LEGAL).toBe('2026-10-08');
    expect(textoDe(Privacidad)).toContain('Última actualización: 8 de octubre de 2026');
    cleanup();
    expect(textoDe(Terminos)).toContain('Última actualización: 8 de octubre de 2026');
  });
});
