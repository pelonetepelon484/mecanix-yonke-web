import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  ADVERTENCIA_ENLACE_SEGUIMIENTO, ADVERTENCIA_NOTA_SEGUIMIENTO, AVISO_ENTREGA_SEGUIMIENTO, MENSAJES_SEGUIMIENTO, URL_BASE_SEGUIMIENTO,
  documentoSeguimiento, enlaceCompartirSeguimiento, enlaceSeguimiento, enlaceWhatsappAlTaller, esTokenSeguimiento,
  generarTokenSeguimiento, huellaSeguimiento, seguimientoPublico, tokenDeEnlace, validarNotaSeguimiento, venceSeguimiento,
} from './seguimiento';

const DIA = 86400000;
const AHORA = new Date('2026-10-22T12:00:00Z');
const ts = (d: Date) => ({ toMillis: () => d.getTime(), toDate: () => d });

describe('token, huella y enlace', () => {
  it('token: 32 bytes al azar en base64url (43 caracteres), distinto cada vez', () => {
    const tokens = new Set(Array.from({ length: 200 }, () => generarTokenSeguimiento()));
    expect(tokens.size).toBe(200);
    for (const t of tokens) expect(esTokenSeguimiento(t)).toBe(true);
  });
  it('mismo resultado que base64url de Node con los mismos bytes', () => {
    const bytes = new Uint8Array(32).map((_, i) => (i * 37 + 250) % 256);
    expect(generarTokenSeguimiento(() => bytes)).toBe(Buffer.from(bytes).toString('base64url'));
  });
  it('huella = SHA-256 hex en minúsculas (igual que las reglas y que hashCodigo del servidor)', async () => {
    const t = generarTokenSeguimiento();
    expect(await huellaSeguimiento(t)).toBe(createHash('sha256').update(t).digest('hex'));
  });
  it('el enlace SIEMPRE usa el dominio principal con www', () => {
    expect(URL_BASE_SEGUIMIENTO).toBe('https://www.mecanixyonkevirtual.com/seguimiento/');
    expect(enlaceSeguimiento('A'.repeat(43))).toBe(`https://www.mecanixyonkevirtual.com/seguimiento/${'A'.repeat(43)}`);
  });
  it('tokenDeEnlace: del enlace completo o del token solo; lo demás, null', () => {
    const t = generarTokenSeguimiento();
    expect(tokenDeEnlace(enlaceSeguimiento(t))).toBe(t);
    expect(tokenDeEnlace(`  ${enlaceSeguimiento(t)}?utm=x  `)).toBe(t);
    expect(tokenDeEnlace(t)).toBe(t);
    for (const malo of ['', 'hola', `${URL_BASE_SEGUIMIENTO}corto`, `${URL_BASE_SEGUIMIENTO}${t}x`, null, 42]) expect(tokenDeEnlace(malo)).toBeNull();
  });
});

describe('nota pública', () => {
  it('textos fijos aprobados', () => {
    expect(ADVERTENCIA_NOTA_SEGUIMIENTO).toBe('No escribas nombres ni teléfonos de clientes');
    expect(ADVERTENCIA_ENLACE_SEGUIMIENTO).toBe('Cualquier persona que tenga este enlace puede ver el estado de la orden, el vehículo y la nota. Compártelo solo con tu cliente. Si lo compartiste por error, desactívalo.');
    expect(AVISO_ENTREGA_SEGUIMIENTO).toBe('El enlace de seguimiento dejará de abrir 30 días después de hoy');
  });
  it('acepta notas normales (con números cortos)', () => {
    for (const ok of ['', 'Listo para recoger a las 5', 'Cambio de aceite 5W30 y filtro', 'Llantas 205/55 R16', 'Km 150000', 'x'.repeat(200)]) {
      expect(validarNotaSeguimiento(ok)).toBeNull();
    }
  });
  it('rechaza 10 o más dígitos seguidos, aunque vengan separados como teléfono', () => {
    for (const malo of ['Llámale al 6641234567', '664 123 4567', '(664) 123-4567', '664.123.45.67', '+52 664 123 4567']) {
      expect(validarNotaSeguimiento(malo)).toBe(MENSAJES_SEGUIMIENTO.notaTelefono);
    }
  });
  it('rechaza «@» y más de 200 caracteres', () => {
    expect(validarNotaSeguimiento('escribe a juan@correo.com')).toBe(MENSAJES_SEGUIMIENTO.notaCorreo);
    expect(validarNotaSeguimiento('x'.repeat(201))).toBe(MENSAJES_SEGUIMIENTO.notaLarga);
  });
});

describe('vencimiento del enlace', () => {
  it('sin entregar: el mismo que la orden', () => {
    const orden = new Date(AHORA.getTime() + 88 * DIA);
    expect(venceSeguimiento(orden, null, AHORA)?.getTime()).toBe(orden.getTime());
  });
  it('entregada: lo más temprano entre la orden y la primera entrega + 30 días', () => {
    const entrega = new Date(AHORA.getTime() - 5 * DIA);
    expect(venceSeguimiento(ts(new Date(entrega.getTime() + 98 * DIA)), ts(entrega), AHORA)?.getTime()).toBe(entrega.getTime() + 30 * DIA);
    expect(venceSeguimiento(ts(new Date(entrega.getTime() + 8 * DIA)), ts(entrega), AHORA)?.getTime()).toBe(entrega.getTime() + 8 * DIA);
  });
  it('entrega AHORA: 30 días menos 10 minutos de margen por el reloj', () => {
    const orden = new Date(AHORA.getTime() + 373 * DIA);
    expect(venceSeguimiento(orden, 'ahora', AHORA)?.getTime()).toBe(AHORA.getTime() + 30 * DIA - 10 * 60000);
  });
  it('sin vencimiento de la orden: null', () => {
    expect(venceSeguimiento(undefined, null, AHORA)).toBeNull();
  });
});

describe('documento y lista blanca', () => {
  const orden = { estado: 'reparacion', vehiculo: { marca: 'Nissan', modelo: 'Sentra', anio: 2001, placas: 'ABC1234', kilometraje: 5 }, cliente: { nombre: 'Juan', telefono: '6641112233' }, notaSeguimiento: 'Hoy', totalCentavos: 9 };
  it('documentoSeguimiento: solo los campos que exigen las reglas (sin placas ni datos del cliente)', () => {
    const d = documentoSeguimiento({ tallerId: 'T1', folio: 'O1', orden, taller: { nombre: 'Taller', whatsapp: '6641234567' }, expiraAt: AHORA });
    expect(Object.keys(d).sort()).toEqual(['anio', 'estado', 'expiraAt', 'folio', 'marca', 'modelo', 'nota', 'tallerId', 'tallerNombre', 'tallerWhatsapp']);
    expect(JSON.stringify(d)).not.toMatch(/ABC1234|Juan|6641112233/);
  });
  it('seguimientoPublico: EXACTAMENTE estos campos; nunca folio, tallerId, expiraAt ni nada extra', () => {
    const doc = {
      tallerId: 'T1', folio: 'O261020-ABCD', tallerNombre: 'Taller Peña', tallerWhatsapp: '6641234567', marca: 'Nissan', modelo: 'Sentra', anio: 2001,
      estado: 'listo', nota: 'Pase hoy', actualizadoAt: ts(AHORA), expiraAt: ts(new Date(AHORA.getTime() + DIA)),
      placas: 'ABC1234', cliente: { nombre: 'Juan' }, totalCentavos: 100, otro: 'x',
    };
    const p = seguimientoPublico(doc, AHORA);
    expect(Object.keys(p ?? {}).sort()).toEqual(['actualizadoAt', 'anio', 'estado', 'estadoNombre', 'marca', 'modelo', 'nota', 'tallerNombre', 'tallerWhatsapp']);
    expect(p).toMatchObject({ estado: 'listo', estadoNombre: 'Listo', nota: 'Pase hoy', actualizadoAt: AHORA.toISOString() });
    expect(JSON.stringify(p)).not.toMatch(/O261020|T1"|ABC1234|Juan|totalCentavos/);
  });
  it('vencido, sin vencimiento, estado raro o no-objeto: null', () => {
    const base = { estado: 'listo', expiraAt: ts(new Date(AHORA.getTime() + DIA)) };
    expect(seguimientoPublico({ ...base, expiraAt: ts(AHORA) }, AHORA)).toBeNull();
    expect(seguimientoPublico({ estado: 'listo' }, AHORA)).toBeNull();
    expect(seguimientoPublico({ ...base, estado: 'cancelada' }, AHORA)).toBeNull();
    expect(seguimientoPublico(null, AHORA)).toBeNull();
    expect(seguimientoPublico('x', AHORA)).toBeNull();
  });
});

describe('WhatsApp', () => {
  const enlace = enlaceSeguimiento('A'.repeat(43));
  it('compartir: con el teléfono de la orden, wa.me con el número y el enlace en el mensaje', () => {
    const href = enlaceCompartirSeguimiento('664 111 2233', 'Taller Peña', { marca: 'Nissan', modelo: 'Sentra', anio: 2001 }, enlace);
    expect(href.startsWith('https://wa.me/526641112233?text=')).toBe(true);
    expect(decodeURIComponent(href.split('text=')[1])).toBe(`Hola, le escribimos de Taller Peña. Puede ver el avance de su Nissan Sentra 2001 aquí: ${enlace}`);
  });
  it('compartir sin teléfono: wa.me sin número para elegir el contacto', () => {
    expect(enlaceCompartirSeguimiento(undefined, 'Taller', {}, enlace).startsWith('https://wa.me/?text=')).toBe(true);
  });
  it('al taller (página pública): con su WhatsApp; inválido -> null', () => {
    expect(enlaceWhatsappAlTaller({ tallerWhatsapp: '6641234567', marca: 'Nissan', modelo: 'Sentra', anio: 2001 })).toBe(`https://wa.me/526641234567?text=${encodeURIComponent('Hola, pregunto por mi Nissan Sentra 2001.')}`);
    expect(enlaceWhatsappAlTaller({ tallerWhatsapp: '12', marca: '', modelo: '', anio: null })).toBeNull();
  });
});
