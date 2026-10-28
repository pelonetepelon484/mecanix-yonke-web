import { describe, expect, it } from 'vitest';
import {
  MENSAJES_REFACCIONARIA, TEXTOS_PROVISIONALES, generarSlug, leerConfigRefaccionariasDe, municipiosDeTexto,
  HORARIO_INICIAL, PIEZAS_POR_PAGINA, formatoPrecio, paginaDeParametro, piezaPublica, piezasDePagina, refaccionariaVisible,
  totalPaginas, ubicacionPagina, validarHorario,
  DIAS_CONSERVAR_VENCIDA, estadoCuentaRefaccionaria, finPruebaDesde, refaccionariaAceptoTerminos, textoEstadoCuenta,
  validarRegistroRefaccionaria, zonaEntregaDe,
} from './refaccionarias';

const base = {
  nombre: 'Refacciones El Pistón', whatsapp: '664 123-4567', estado: 'baja-california', ciudad: 'Tijuana',
  zonaDescripcion: '', zonaMunicipios: '', email: 'piston@prueba.mx', password: 'abcdefgh', confirmarPassword: 'abcdefgh',
};
const ESTADOS = ['baja-california', 'sonora'];

describe('validarRegistroRefaccionaria', () => {
  it('datos válidos: limpia el WhatsApp y no guarda zona de entrega vacía', () => {
    const r = validarRegistroRefaccionaria(base, ESTADOS);
    expect(r).toEqual({ ok: true, datos: { nombre: 'Refacciones El Pistón', whatsapp: '6641234567', estado: 'baja-california', ciudad: 'Tijuana', zonaEntrega: null, email: 'piston@prueba.mx', password: 'abcdefgh' } });
  });
  it('zona de entrega opcional: descripción y municipios sin repetir', () => {
    const r = validarRegistroRefaccionaria({ ...base, zonaDescripcion: ' Centro y Otay ', zonaMunicipios: 'Tijuana, Rosarito,\nTijuana' }, ESTADOS);
    expect(r.ok && r.datos.zonaEntrega).toEqual({ descripcion: 'Centro y Otay', municipios: ['Tijuana', 'Rosarito'] });
  });
  it('rechaza lo que las reglas también rechazarían', () => {
    const casos: [Partial<typeof base>, string][] = [
      [{ nombre: '' }, MENSAJES_REFACCIONARIA.camposVacios],
      [{ nombre: 'A' }, MENSAJES_REFACCIONARIA.nombre],
      [{ whatsapp: '12345' }, MENSAJES_REFACCIONARIA.whatsapp],
      [{ estado: 'jalisco' }, MENSAJES_REFACCIONARIA.estado],
      [{ ciudad: 'X' }, MENSAJES_REFACCIONARIA.ciudad],
      [{ zonaDescripcion: 'x'.repeat(301) }, MENSAJES_REFACCIONARIA.zonaEntrega],
      [{ zonaMunicipios: Array.from({ length: 31 }, (_, i) => `M${i}`).join(',') }, MENSAJES_REFACCIONARIA.zonaEntrega],
      [{ email: 'sin-arroba' }, MENSAJES_REFACCIONARIA.correo],
      [{ password: 'corta', confirmarPassword: 'corta' }, MENSAJES_REFACCIONARIA.password],
      [{ confirmarPassword: 'otra-cosa' }, MENSAJES_REFACCIONARIA.passwordNoCoincide],
    ];
    for (const [cambio, mensaje] of casos) expect(validarRegistroRefaccionaria({ ...base, ...cambio }, ESTADOS)).toEqual({ ok: false, mensaje });
  });
  it('municipiosDeTexto y zonaEntregaDe', () => {
    expect(municipiosDeTexto(' , ,')).toEqual([]);
    expect(zonaEntregaDe('', '')).toBeNull();
    expect(zonaEntregaDe('', 'Tecate')).toEqual({ descripcion: '', municipios: ['Tecate'] });
  });
});

describe('generarSlug', () => {
  it('sin acentos ni símbolos, con 6 caracteres del id (formato de las reglas)', () => {
    expect(generarSlug('Refacciones El Pistón & Cía.', 'AbC123xyz')).toBe('refacciones-el-piston-cia-abc123');
    expect(generarSlug('!!!', 'Q9')).toBe('refaccionaria-q9');
    for (const s of [generarSlug('Ñandú  --  Autopartes', 'id1'), generarSlug('x'.repeat(100), 'zz')]) {
      expect(s).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
      expect(s.length).toBeLessThanOrEqual(80);
    }
  });
});

describe('config/refaccionarias', () => {
  it('sin documento o sin campos: apagada, sin versión, topes y vigencias en null (nada fijo en el código)', () => {
    for (const datos of [null, {}, { habilitado: 'true', topes: { piezas: -1, basico: 2000 }, vigencia: { ocultarBuscadorDias: '60' } }]) {
      expect(leerConfigRefaccionariasDe(datos)).toEqual({
        habilitado: false, paginaPublica: false, terminosVersion: '', resumenCambios: '',
        topes: { piezas: null },
        vigencia: { precioPorConfirmarDias: null, ocultarBuscadorDias: null, ocultarPaginaDias: null },
      });
    }
  });
  it('con todo: lo lee tal cual', () => {
    const c = leerConfigRefaccionariasDe({
      habilitado: true, terminosVersion: 'ref-1', resumenCambios: 'Texto',
      topes: { piezas: 20000 }, vigencia: { precioPorConfirmarDias: 30, ocultarBuscadorDias: 60, ocultarPaginaDias: 90 },
    });
    expect(c).toEqual({
      habilitado: true, paginaPublica: false, terminosVersion: 'ref-1', resumenCambios: 'Texto',
      topes: { piezas: 20000 }, vigencia: { precioPorConfirmarDias: 30, ocultarBuscadorDias: 60, ocultarPaginaDias: 90 },
    });
  });
  it('aceptación: sin versión vigente no se exige; con versión, debe coincidir', () => {
    const sin = leerConfigRefaccionariasDe({ habilitado: true });
    const con = leerConfigRefaccionariasDe({ habilitado: true, terminosVersion: 'ref-2' });
    expect(refaccionariaAceptoTerminos({ aceptacionVersion: '' }, sin)).toBe(true);
    expect(refaccionariaAceptoTerminos({ aceptacionVersion: 'ref-1' }, con)).toBe(false);
    expect(refaccionariaAceptoTerminos({ aceptacionVersion: 'ref-2' }, con)).toBe(true);
  });
});

describe('textos provisionales', () => {
  it('los textos legales provisionales van marcados [PROVISIONAL] para no publicarlos por error', () => {
    for (const clave of ['aceptacionRegistro', 'resumenCambiosRespaldo', 'tituloAvisoVersion', 'soloLectura', 'proximamenteInventarioDetalle', 'registroCerrado'] as const) {
      expect(TEXTOS_PROVISIONALES[clave].startsWith('[PROVISIONAL]')).toBe(true);
    }
  });
});

describe('estadoCuentaRefaccionaria', () => {
  const hoy = new Date('2026-10-27T12:00:00');
  const enDias = (n: number) => new Date(hoy.getTime() + n * 24 * 60 * 60 * 1000);
  const ts = (d: Date) => ({ toDate: () => d }); // como llega de Firestore

  it('sin pruebaHasta ni premiumHasta: sin activar', () => {
    for (const r of [null, {}, { pruebaHasta: null, premiumHasta: 'no es fecha' }]) {
      expect(estadoCuentaRefaccionaria(r, hoy)).toEqual({ estado: 'sin-activar', diasRestantes: null, venceEl: null, paraBorrado: false });
    }
  });
  it('prueba vigente con sus días restantes', () => {
    expect(estadoCuentaRefaccionaria({ pruebaHasta: ts(enDias(10)) }, hoy)).toMatchObject({ estado: 'prueba-vigente', diasRestantes: 10, paraBorrado: false });
    expect(estadoCuentaRefaccionaria({ pruebaHasta: ts(enDias(0.5)) }, hoy)).toMatchObject({ estado: 'prueba-vigente', diasRestantes: 1 });
  });
  it('pago vigente: manda sobre la prueba', () => {
    expect(estadoCuentaRefaccionaria({ pruebaHasta: ts(enDias(-5)), premiumHasta: ts(enDias(30)) }, hoy)).toMatchObject({ estado: 'pago-vigente', diasRestantes: 30 });
    expect(estadoCuentaRefaccionaria({ pruebaHasta: ts(enDias(5)), premiumHasta: ts(enDias(30)) }, hoy)).toMatchObject({ estado: 'pago-vigente', diasRestantes: 30 });
  });
  it('vencida (prueba o pago terminados): conserva sus datos 90 días, contados desde el fin más reciente', () => {
    expect(estadoCuentaRefaccionaria({ pruebaHasta: ts(enDias(-10)) }, hoy)).toMatchObject({ estado: 'vencida', diasRestantes: 80, paraBorrado: false });
    const pagoVencido = estadoCuentaRefaccionaria({ pruebaHasta: ts(enDias(-100)), premiumHasta: ts(enDias(-1)) }, hoy);
    expect(pagoVencido).toMatchObject({ estado: 'vencida', diasRestantes: DIAS_CONSERVAR_VENCIDA - 1, paraBorrado: false });
    expect(pagoVencido.venceEl).toEqual(enDias(-1));
  });
  it('vencida hace 90 días o más: marcada para borrado (solo la marca)', () => {
    expect(estadoCuentaRefaccionaria({ pruebaHasta: ts(enDias(-90)) }, hoy)).toMatchObject({ estado: 'vencida', diasRestantes: 0, paraBorrado: true });
    expect(estadoCuentaRefaccionaria({ premiumHasta: ts(enDias(-400)) }, hoy)).toMatchObject({ estado: 'vencida', diasRestantes: 0, paraBorrado: true });
    expect(estadoCuentaRefaccionaria({ pruebaHasta: ts(enDias(-89)) }, hoy)).toMatchObject({ paraBorrado: false, diasRestantes: 1 });
  });
  it('textos para el admin', () => {
    expect(textoEstadoCuenta(estadoCuentaRefaccionaria({ pruebaHasta: ts(enDias(1)) }, hoy))).toBe('🧪 Prueba vigente · quedan 1 día');
    expect(textoEstadoCuenta(estadoCuentaRefaccionaria({ premiumHasta: ts(enDias(30)) }, hoy))).toBe('⭐ Pago vigente · quedan 30 días');
    expect(textoEstadoCuenta(estadoCuentaRefaccionaria({}, hoy))).toBe('⏸️ Sin activar');
    expect(textoEstadoCuenta(estadoCuentaRefaccionaria({ pruebaHasta: ts(enDias(-10)) }, hoy))).toBe('⚠️ Vencida · se conservan sus datos 80 días más');
    expect(textoEstadoCuenta(estadoCuentaRefaccionaria({ pruebaHasta: ts(enDias(-100)) }, hoy))).toMatch(/para borrado/);
  });
  it('fin de la prueba: 3 meses después de hoy (o el último día del mes si no existe)', () => {
    expect(finPruebaDesde(new Date(2026, 9, 27))).toBe('2027-01-27');
    expect(finPruebaDesde(new Date(2026, 7, 31))).toBe('2026-11-30');
  });
});

describe('página pública (etapa 3)', () => {
  const hoy = new Date('2026-10-27T12:00:00');
  const en = (dias: number) => new Date(hoy.getTime() + dias * 24 * 60 * 60 * 1000);

  it('bandera paginaPublica: solo true exacto, aparte de habilitado', () => {
    expect(leerConfigRefaccionariasDe({ paginaPublica: true }).paginaPublica).toBe(true);
    expect(leerConfigRefaccionariasDe({ paginaPublica: true }).habilitado).toBe(false);
    for (const v of [false, 'true', 1, undefined]) expect(leerConfigRefaccionariasDe({ paginaPublica: v, habilitado: true }).paginaPublica).toBe(false);
  });
  it('visible solo activa y con prueba o pago vigente', () => {
    expect(refaccionariaVisible({ activo: true, pruebaHasta: en(5) }, hoy)).toBe(true);
    expect(refaccionariaVisible({ activo: true, premiumHasta: en(5), pruebaHasta: en(-50) }, hoy)).toBe(true);
    expect(refaccionariaVisible({ activo: false, pruebaHasta: en(5) }, hoy)).toBe(false);
    expect(refaccionariaVisible({ activo: true, pruebaHasta: en(-1) }, hoy)).toBe(false);
    expect(refaccionariaVisible({ activo: true }, hoy)).toBe(false);
    expect(refaccionariaVisible(null, hoy)).toBe(false);
  });
  it('paginación: 50 por página, cada página sale de un solo bloque', () => {
    expect(PIEZAS_POR_PAGINA).toBe(50);
    expect(totalPaginas(0)).toBe(0);
    expect(totalPaginas(20)).toBe(1);
    expect(totalPaginas(51)).toBe(2);
    expect(totalPaginas('100')).toBe(0);
    expect(ubicacionPagina(1)).toEqual({ bloque: 0, desde: 0, hasta: 50 });
    expect(ubicacionPagina(20)).toEqual({ bloque: 0, desde: 950, hasta: 1000 });
    expect(ubicacionPagina(21)).toEqual({ bloque: 1, desde: 0, hasta: 50 });
    for (const [v, n] of [[undefined, 1], ['3', 3], [['2'], 2], ['0', 1], ['-1', 1], ['abc', 1], ['2.5', 1]] as const) {
      expect(paginaDeParametro(v)).toBe(n);
    }
  });
  it('piezas de la página: solo las de su tramo y solo las válidas', () => {
    const piezas = Array.from({ length: 120 }, (_, i) => ({ numeroParte: `P-${i}`, descripcion: `Pieza ${i}`, marca: 'X', tipo: 'marca', precio: 100 + i, incluyeIva: true }));
    const pag2 = piezasDePagina({ piezas }, 2);
    expect(pag2).toHaveLength(50);
    expect(pag2[0].numeroParte).toBe('P-50');
    expect(piezasDePagina({ piezas }, 3)).toHaveLength(20);
    expect(piezasDePagina(null, 1)).toEqual([]);
    expect(piezaPublica({ numeroParte: '', precio: 10 })).toBeNull();
    expect(piezaPublica({ numeroParte: 'A', precio: 0 })).toBeNull();
    expect(piezaPublica({ numeroParte: 'A', precio: '10' })).toBeNull();
    expect(piezaPublica({ numeroParte: ' A-1 ', precio: 10, tipo: 'otro' })).toEqual({ numeroParte: 'A-1', descripcion: '', marca: '', tipo: 'generica', precio: 10, incluyeIva: false });
    expect(formatoPrecio(1450)).toMatch(/1,450\.00/);
  });
  it('horario: 7 días, HH:MM y cierre después de apertura', () => {
    expect(validarHorario(HORARIO_INICIAL)).toEqual({ ok: true, horario: HORARIO_INICIAL });
    expect(validarHorario({ ...HORARIO_INICIAL, lunes: { abierto: true, apertura: '9:00', cierre: '18:00' } }).ok).toBe(false);
    expect(validarHorario({ ...HORARIO_INICIAL, lunes: { abierto: true, apertura: '18:00', cierre: '09:00' } }).ok).toBe(false);
    // Cerrado: no importa el orden de las horas
    expect(validarHorario({ ...HORARIO_INICIAL, domingo: { abierto: false, apertura: '18:00', cierre: '09:00' } }).ok).toBe(true);
    const { martes, ...sinMartes } = HORARIO_INICIAL;
    expect(validarHorario(sinMartes).ok).toBe(false);
    expect(validarHorario(null).ok).toBe(false);
  });
});
