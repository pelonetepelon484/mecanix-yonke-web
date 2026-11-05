import { describe, expect, it } from 'vitest';
import {
  AVISO_ASISTENCIA, enlaceLlamar, enlaceWhatsappAsistencia, estadoDocumentos, mesAnio, ordenarProveedores, proveedorParaPagina,
  textoSello, validarProveedor,
} from './asistenciaVial';

const AHORA = Date.UTC(2026, 10, 5, 18); // 5 de noviembre de 2026
const hace = (meses) => { const f = new Date(AHORA); f.setMonth(f.getMonth() - meses); return f.getTime(); };
const p = (id, extra = {}) => ({
  id, nombre: id, servicios: ['grua'], tiposGrua: [], ciudades: ['tijuana'], atiende24h: false, horario: '9 a 6', telefono: '6641234567',
  whatsapp: '6641234567', descripcion: '', logoUrl: '', activo: true, documentosEnRegla: false, fechaRevisionMs: null, ...extra,
});

describe('documentos en regla', () => {
  it('sello solo si está marcado y la revisión tiene menos de 12 meses', () => {
    expect(estadoDocumentos(p('a'), AHORA)).toBe('sin_revisar');
    expect(estadoDocumentos(p('a', { documentosEnRegla: true, fechaRevisionMs: hace(11) }), AHORA)).toBe('en_regla');
    expect(estadoDocumentos(p('a', { documentosEnRegla: true, fechaRevisionMs: hace(12) }), AHORA)).toBe('por_renovar');
    expect(estadoDocumentos(p('a', { documentosEnRegla: true, fechaRevisionMs: null }), AHORA)).toBe('por_renovar');
  });
  it('texto del sello con mes y año, sin la palabra "Verificado"', () => {
    const t = textoSello({ fechaRevisionMs: Date.UTC(2026, 10, 1, 12) });
    expect(t).toBe('Documentos en regla · revisado en noviembre 2026');
    expect(t).not.toMatch(/verificad/i);
    expect(mesAnio(Date.UTC(2026, 0, 1, 12))).toBe('enero 2026');
  });
});

describe('orden y filtros', () => {
  const lista = [
    p('Sin nada'),
    p('Solo 24h', { atiende24h: true }),
    p('24h y docs', { atiende24h: true, documentosEnRegla: true, fechaRevisionMs: hace(1) }),
    p('Solo docs', { documentosEnRegla: true, fechaRevisionMs: hace(1) }),
    p('Rosarito', { ciudades: ['rosarito'], atiende24h: true, documentosEnRegla: true, fechaRevisionMs: hace(1) }),
    p('Mexicali', { ciudades: ['mexicali'] }),
    p('Inactivo', { activo: false }),
    p('Llantera', { servicios: ['llantera'] }),
  ];
  it('con ciudad: primero 24h + documentos, luego 24h, luego documentos; aparte los cercanos por cercanía', () => {
    const { enCiudad, cercanos } = ordenarProveedores(lista, { ciudad: 'tijuana' }, AHORA);
    expect(enCiudad.map((x) => x.id)).toEqual(['24h y docs', 'Solo 24h', 'Solo docs', 'Llantera', 'Sin nada']);
    expect(cercanos.map((x) => x.id)).toEqual(['Rosarito', 'Mexicali']);
  });
  it('nunca muestra inactivos; filtra por servicio y por 24 horas', () => {
    const todos = ordenarProveedores(lista, {}, AHORA);
    expect(todos.enCiudad.map((x) => x.id)).not.toContain('Inactivo');
    expect(ordenarProveedores(lista, { ciudad: 'tijuana', servicio: 'llantera' }, AHORA).enCiudad.map((x) => x.id)).toEqual(['Llantera']);
    expect(ordenarProveedores(lista, { ciudad: 'tijuana', solo24h: true }, AHORA).enCiudad.map((x) => x.id)).toEqual(['24h y docs', 'Solo 24h']);
  });
  it('un documento caducado pierde su lugar de prioridad', () => {
    const viejo = p('Viejo', { atiende24h: true, documentosEnRegla: true, fechaRevisionMs: hace(13) });
    const nuevo = p('Nuevo', { atiende24h: true, documentosEnRegla: true, fechaRevisionMs: hace(1) });
    expect(ordenarProveedores([viejo, nuevo], { ciudad: 'tijuana' }, AHORA).enCiudad.map((x) => x.id)).toEqual(['Nuevo', 'Viejo']);
  });
});

describe('datos y enlaces', () => {
  it('solo pasa campos públicos y descarta claves desconocidas', () => {
    const d = proveedorParaPagina('X', { nombre: 'Grúas', servicios: ['grua', 'volar'], ciudades: ['tijuana', 'marte'], notasInternas: 'secreto', activo: true });
    expect(d.servicios).toEqual(['grua']);
    expect(d.ciudades).toEqual(['tijuana']);
    expect(JSON.stringify(d)).not.toContain('secreto');
  });
  it('Llamar y WhatsApp con el mensaje ya escrito', () => {
    expect(enlaceLlamar('664 123 4567')).toBe('tel:+526641234567');
    expect(enlaceWhatsappAsistencia('6641234567')).toBe(`https://wa.me/526641234567?text=${encodeURIComponent('Hola, vi tu servicio en Red Mecanix y necesito ayuda con: ')}`);
  });
  it('el aviso dice que Red Mecanix solo conecta', () => {
    expect(AVISO_ASISTENCIA).toMatch(/^Red Mecanix solo te pone en contacto con el proveedor\./);
  });
  it('validación del formulario del admin', () => {
    const ok = { nombre: 'Grúas', servicios: ['grua'], ciudades: ['tijuana'], telefono: '6641234567', whatsapp: '', atiende24h: true, horario: '' };
    expect(validarProveedor(ok)).toBeNull();
    expect(validarProveedor({ ...ok, telefono: '12' })).toMatch(/10 dígitos/);
    expect(validarProveedor({ ...ok, atiende24h: false })).toMatch(/horario/);
    expect(validarProveedor({ ...ok, documentosEnRegla: true })).toMatch(/fecha/);
  });
});
