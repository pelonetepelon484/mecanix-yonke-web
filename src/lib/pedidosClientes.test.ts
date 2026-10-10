import { describe, expect, it } from 'vitest';
import {
  DIAS_VIGENCIA_PEDIDO, MAX_PEDIDOS_POR_WHATSAPP_DIA, MENSAJES_PEDIDO, calcularExpiraAtPedido, enlaceGuardarPorWhatsapp, enlaceMiPedido, esCodigo, esIdPedido, estaVencido,
  estadoVisible, mensajeAvisoAdmin, normalizarWhatsapp, ordenarRespuestas, pedidoPublico, respuestaParaCliente, resumenPedidos,
  validarPedidoCliente,
} from './pedidosClientes';
import { MENSAJES_SOLICITUD } from './solicitudesPiezas';

const ESTADOS = ['baja-california', 'sonora'];
const datos = (extra = {}) => ({
  vehiculo: { marca: 'Nissan', modelo: 'Sentra', anio: 2005 }, pieza: 'Alternador', estado: 'baja-california', whatsapp: '664 123 4567', ...extra,
});

describe('WhatsApp del cliente', () => {
  it('normaliza a 10 dígitos con espacios, guiones, +52, 52 y +521', () => {
    for (const w of ['6641234567', '664 123 4567', '664-123-4567', '+52 664 123 4567', '52 6641234567', '+521 664 123 4567']) {
      expect(normalizarWhatsapp(w)).toBe('6641234567');
    }
  });
  it('rechaza números incompletos, de más o que no son texto', () => {
    for (const w of ['', '664123456', '66412345678', 'hola', '+1 619 123 45678', null, 6641234567]) {
      expect(normalizarWhatsapp(w)).toBeNull();
    }
  });
});

describe('validar el pedido del cliente', () => {
  it('acepta un pedido completo', () => {
    expect(validarPedidoCliente(datos(), ESTADOS)).toBeNull();
  });
  it('reutiliza las validaciones de vehículo y pieza de solicitudesPiezas', () => {
    expect(validarPedidoCliente(datos({ vehiculo: { marca: '', modelo: 'Sentra', anio: 2005 } }), ESTADOS)).toBe(MENSAJES_SOLICITUD.vehiculo);
    expect(validarPedidoCliente(datos({ vehiculo: { marca: 'Nissan', modelo: 'Sentra', anio: Number.NaN } }), ESTADOS)).toBe(MENSAJES_SOLICITUD.anio);
    expect(validarPedidoCliente(datos({ pieza: '' }), ESTADOS)).toBe(MENSAJES_SOLICITUD.pieza);
    expect(validarPedidoCliente(datos({ pieza: 'x'.repeat(101) }), ESTADOS)).toBe(MENSAJES_SOLICITUD.pieza);
  });
  it('marca o modelo de más de 60 letras no pasan (mismo tope que la regla)', () => {
    expect(validarPedidoCliente(datos({ vehiculo: { marca: 'x'.repeat(61), modelo: 'Sentra', anio: 2005 } }), ESTADOS)).toBe(MENSAJES_PEDIDO.vehiculo);
  });
  it('exige un estado de la lista y un WhatsApp válido', () => {
    expect(validarPedidoCliente(datos({ estado: 'todos' }), ESTADOS)).toBe(MENSAJES_PEDIDO.estado);
    expect(validarPedidoCliente(datos({ estado: '' }), ESTADOS)).toBe(MENSAJES_PEDIDO.estado);
    expect(validarPedidoCliente(datos({ whatsapp: '123' }), ESTADOS)).toBe(MENSAJES_PEDIDO.whatsapp);
  });
});

describe('ids, código y vigencia', () => {
  it('id de pedido: 20 letras/números; código: 43 caracteres base64url', () => {
    expect(esIdPedido('abcDEF1234567890ghIJ')).toBe(true);
    expect(esIdPedido('../config/x')).toBe(false);
    expect(esIdPedido('corto')).toBe(false);
    expect(esCodigo('a'.repeat(43))).toBe(true);
    expect(esCodigo('a-_'.repeat(14) + 'b')).toBe(true);
    expect(esCodigo('a'.repeat(42))).toBe(false);
    expect(esCodigo(null)).toBe(false);
  });
  it('vence a los 5 días', () => {
    const desde = new Date('2026-10-08T12:00:00Z');
    expect(DIAS_VIGENCIA_PEDIDO).toBe(5);
    expect(calcularExpiraAtPedido(desde).toISOString()).toBe('2026-10-13T12:00:00.000Z');
    expect(estaVencido({ toDate: () => new Date('2026-10-13T12:00:00Z') }, new Date('2026-10-13T12:00:01Z'))).toBe(true);
    expect(estaVencido(new Date('2026-10-13T12:00:00Z'), desde)).toBe(false);
    expect(estaVencido(undefined, desde)).toBe(true);
  });
});

describe('lo que sale hacia afuera', () => {
  it('pedidoPublico solo trae id, vehículo, pieza, estado y fecha', () => {
    const p = pedidoPublico('ID', {
      vehiculo: { marca: 'Nissan', modelo: 'Sentra', anio: 2005 }, pieza: 'Alternador', estado: 'sonora', estadoPedido: 'abierta',
      creadoAt: { toDate: () => new Date('2026-10-08T00:00:00Z') }, expiraAt: null,
      // por si algún día se cuela algo en el documento:
      ...({ clienteWhatsapp: '6641234567' } as object),
    });
    expect(Object.keys(p).sort()).toEqual(['creadoAt', 'estado', 'id', 'pieza', 'vehiculo']);
    expect(JSON.stringify(p)).not.toContain('6641234567');
  });
  it('respuestaParaCliente: verificado en vivo, sin precio cuando no la tiene', () => {
    const r = { yonkeId: 'Y1', yonkeNombre: 'El Güero', tieneLaPieza: true, precio: 1500, nota: 'Original', whatsapp: '6641111111' };
    expect(respuestaParaCliente(r, { verificado: true })).toMatchObject({ yonkeNombre: 'El Güero', precio: 1500, verificado: true, whatsapp: '6641111111' });
    expect(respuestaParaCliente(r, null).verificado).toBe(false);
    expect(respuestaParaCliente(r, { verificado: 'sí' }).verificado).toBe(false);
    expect(respuestaParaCliente({ ...r, tieneLaPieza: false }, null).precio).toBeNull();
    expect(Object.keys(respuestaParaCliente(r, null))).not.toContain('yonkeId');
  });
  it('ordena: primero quienes la tienen, del más barato al más caro', () => {
    const lista = ordenarRespuestas([
      { tieneLaPieza: false, precio: null, n: 'a' }, { tieneLaPieza: true, precio: 900, n: 'b' }, { tieneLaPieza: true, precio: 500, n: 'c' },
    ]);
    expect(lista.map((x) => x.n)).toEqual(['c', 'b', 'a']);
  });
  it('enlaces: /mi-pedido con código y wa.me al propio número', () => {
    const enlace = enlaceMiPedido('https://mecanixyonkevirtual.com/', 'ID', 'COD');
    expect(enlace).toBe('https://mecanixyonkevirtual.com/mi-pedido/ID?c=COD');
    const wa = enlaceGuardarPorWhatsapp('+52 664 123 4567', enlace);
    expect(wa.startsWith('https://wa.me/526641234567?text=')).toBe(true);
    expect(decodeURIComponent(wa)).toContain(enlace);
    expect(decodeURIComponent(wa)).toContain(`text=Mi alerta de búsqueda en Mecanix (guárdalo para ver las respuestas de los yonkes): ${enlace}`);
  });
  it('mensajes de error que ve el cliente hablan de "alertas" y usan el límite real', () => {
    expect(MENSAJES_PEDIDO.limiteWhatsapp).toBe(`Ya enviaste ${MAX_PEDIDOS_POR_WHATSAPP_DIA} alertas hoy con este WhatsApp. Intenta mañana.`);
    expect(MENSAJES_PEDIDO.limiteWhatsapp).toBe('Ya enviaste 3 alertas hoy con este WhatsApp. Intenta mañana.');
    expect(MENSAJES_PEDIDO.limiteIp).toBe('Enviaste muchas alertas seguidas. Espera un rato y vuelve a intentar.');
    expect(MENSAJES_PEDIDO.guardarFallo).toBe('No pudimos enviar tu alerta. Revisa tu conexión e intenta de nuevo.');
  });
  it('contadores del panel admin: abiertos (sin vencidos), con y sin respuestas, cerrados en 7 días', () => {
    const ahora = new Date('2026-10-08T12:00:00Z');
    const en = (dias: number) => ({ toDate: () => new Date(ahora.getTime() + dias * 24 * 60 * 60 * 1000) });
    const pedidos = [
      { id: 'A', estadoPedido: 'abierta', expiraAt: en(3) },
      { id: 'B', estadoPedido: 'abierta', expiraAt: en(1) },
      { id: 'V', estadoPedido: 'abierta', expiraAt: en(-1) },
      { id: 'C', estadoPedido: 'cerrada', expiraAt: en(2), cerradoAt: en(-2) },
      { id: 'D', estadoPedido: 'cerrada', expiraAt: en(2), cerradoAt: en(-8) },
      { id: 'X', estadoPedido: 'cancelada', expiraAt: en(2), cerradoAt: en(-1) },
    ];
    expect(resumenPedidos(pedidos, { A: 2, V: 5 }, ahora)).toEqual({ abiertos: 2, conRespuesta: 1, sinRespuesta: 1, cerrados7Dias: 1 });
    expect(estadoVisible(pedidos[2], ahora)).toBe('vencido');
    expect(estadoVisible(pedidos[0], ahora)).toBe('abierta');
    expect(estadoVisible(pedidos[5], ahora)).toBe('cancelada');
  });
  it('el aviso al admin no lleva el WhatsApp del cliente', () => {
    const m = mensajeAvisoAdmin({ vehiculo: { marca: 'Nissan', modelo: 'Sentra', anio: 2005 }, pieza: 'Alternador' }, 'Baja California');
    expect(m).toContain('Alternador');
    expect(m).toContain('Nissan Sentra 2005');
    expect(m).toContain('Baja California');
    expect(m).not.toMatch(/[0-9]{10}/);
  });
});
