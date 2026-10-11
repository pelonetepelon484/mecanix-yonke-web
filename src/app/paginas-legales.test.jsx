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
    // Ajuste de forma aprobado: "cliente" en minúscula en el texto publicado (salvo al inicio de un título).
    .map((l) => l.replace(/Cliente/g, (m, i) => (i === 0 ? m : 'cliente')))
    // Cambios aprobados por el abogado después de ese documento (ver CAMBIOS_2026_10_10).
    .map((l) => CAMBIOS_2026_10_10[l] ?? l)
    .filter(Boolean);
}

// Alertas a yonkes de otros estados (aprobado por el abogado el 10 de octubre de 2026): la línea
// de los Términos que decía que el cliente avisa "únicamente" a los yonkes de su estado.
const CASILLA = 'Acepto que me contacten yonkes de otros estados que hagan envíos';
const TERMINOS_OTROS_ESTADOS = 'Mecanix permite que el cliente avise a los yonkes de su estado que busca una pieza, y que vea sus respuestas. Si el cliente activa la casilla correspondiente, acepta que su alerta de pedido también pueda mostrarse a los yonkes Verificados que tengan activada la opción de Envíos nacionales, en los demás estados, identificados con su insignia.';
const CAMBIOS_2026_10_10 = {
  'Mecanix únicamente permite que el cliente avise a los yonkes de su estado que busca una pieza, y que vea sus respuestas.': TERMINOS_OTROS_ESTADOS,
};
const PRIVACIDAD_A = `(a) Mostrar tu pedido, sin tus datos de contacto, a los yonkes de tu estado para que te respondan. Si marcas la casilla "${CASILLA}", estarás aprobando que tu alerta se muestre también a yonkes de otros estados del país, pero únicamente a los yonkes Verificados que tengan activada la opción de Envíos nacionales (lo verás indicado con su insignia). Solo se muestra la alerta (el vehículo, la pieza, el estado y la fecha); tus datos de contacto siguen protegidos y no se comparten con los yonkes hasta que la alerta se elimine.`;
const PRIVACIDAD_B = 'Asimismo, cuando el usuario utiliza la función de Alerta de Búsqueda, la información de la autoparte o refacción solicitada en dicha alerta es compartida con los yonkes y yonkeros afiliados para atender la disponibilidad del pedido dentro de la alerta autorizada por el cliente.';

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
    expect(texto.indexOf('Respuestas a pedidos de clientes.')).toBeGreaterThan(s6);
    expect(texto.indexOf('Respuestas a pedidos de clientes.')).toBeLessThan(s7);
    expect(texto.indexOf('Pedidos de piezas a los yonkes.')).toBeGreaterThan(s8);
    expect(texto.indexOf('Pedidos de piezas a los yonkes.')).toBeLessThan(s9);
    expect(texto).toContain('23. Contacto');
  });
  it('el texto nuevo escribe "cliente" en minúscula; el texto de talleres ("Cliente del Taller") no cambia', () => {
    const terminos = textoDe(Terminos);
    for (const frase of [
      'Respuestas a pedidos de clientes.', 'aclarar al cliente cualquier diferencia', 'los datos que el cliente le proporcione',
      'permite que el cliente avise', 'El cliente debe confirmar directamente', 'El cliente se obliga a proporcionar',
    ]) {
      expect(terminos).toContain(frase);
      expect(terminos).not.toContain(frase.replace('clientes', 'Clientes').replace('cliente', 'Cliente'));
    }
    expect(terminos).toContain('Cliente del Taller');
    cleanup();
    expect(textoDe(Privacidad)).toContain('14. Clientes que piden una pieza a los yonkes');
  });
  it('la sección 7 de Privacidad remite a la 14 para los pedidos de "Avisar a los yonkes"', () => {
    const texto = textoDe(Privacidad);
    const s7 = texto.indexOf('7. Conservación y eliminación');
    const s8 = texto.indexOf('8. Cookies');
    const referencia = texto.indexOf('Para los pedidos de "Avisar a los yonkes", consulta también la sección 14.');
    expect(referencia).toBeGreaterThan(s7);
    expect(referencia).toBeLessThan(s8);
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
    expect(VERSION_LEGAL).toBe('2026-10-10');
    expect(textoDe(Privacidad)).toContain('Última actualización: 10 de octubre de 2026');
    cleanup();
    expect(textoDe(Terminos)).toContain('Última actualización: 10 de octubre de 2026');
  });
});

describe('alertas a yonkes de otros estados (aprobado el 10 de octubre de 2026)', () => {
  it('Privacidad, sección 14: el inciso (a) nombra la casilla con su texto exacto del formulario', () => {
    const texto = textoDe(Privacidad);
    expect(texto).toContain(PRIVACIDAD_A);
    const a = texto.indexOf(PRIVACIDAD_A);
    expect(a).toBeGreaterThan(texto.indexOf('Para qué los usamos.'));
    expect(a).toBeLessThan(texto.indexOf('(b) Mostrarte, en tu enlace privado'));
  });
  it('Privacidad, sección 14: la frase B va justo después del renglón de "Yonkes"', () => {
    const texto = textoDe(Privacidad);
    const yonkes = 'Yonkes: solo ven el vehículo, la pieza, el estado y la fecha del pedido. Nunca ven tu número de WhatsApp.';
    const y = texto.indexOf(yonkes);
    expect(y).toBeGreaterThan(-1);
    // Párrafo propio, inmediatamente después del renglón de Yonkes y antes de "Proveedores".
    expect(texto.indexOf(PRIVACIDAD_B)).toBe(y + yonkes.length);
    expect(texto.indexOf('• Proveedores de infraestructura')).toBe(y + yonkes.length + PRIVACIDAD_B.length);
  });
  it('Términos, sección 8: la línea nueva reemplaza a la de "únicamente ... de su estado"', () => {
    const texto = textoDe(Terminos);
    expect(texto).toContain(TERMINOS_OTROS_ESTADOS);
    expect(texto).not.toContain('Mecanix únicamente permite que el cliente avise');
  });
  it('la sección 13 de talleres y su versión no cambian', () => {
    expect(textoDe(Privacidad)).toContain('13. Talleres y cotizaciones');
    expect(textoDe(Privacidad)).toContain('Versión: talleres-2026-10-2');
  });
});
