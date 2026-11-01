import { describe, expect, it } from 'vitest';
import {
  MAX_POR_DIA, MAX_POR_IP_DIA, MENSAJES_LIGERO, configLigeros, correoDeEntrada, correoInterno, enlaceRecuperarWhatsapp, esCuentaInterna, nombreReservado,
  numerosDeYonkes, validarRegistroLigero, whatsappDeEntrada, whatsappDiezDigitos,
} from './yonkeLigero';

const ID = 'Pedido00000000000007';
const bien = (extra = {}) => ({ nombre: '  Yonke   El Tigre ', whatsapp: '664 123 4567', password: 'secreto12', aceptaTerminos: true, pedidoId: ID, ...extra });

describe('WhatsApp del yonke ligero', () => {
  it('queda en 10 dígitos con cualquier formato', () => {
    for (const n of ['6641234567', '664 123 4567', '664-123-4567', '+52 664 123 4567', '526641234567', '+521 664 123 4567']) {
      expect(whatsappDiezDigitos(n)).toBe('6641234567');
    }
  });
  it('rechaza lo que no puede ser un número', () => {
    for (const n of ['', '12345', '0641234567', '1641234567', '6666666666', '66412345678', null, 6641234567]) expect(whatsappDiezDigitos(n)).toBeNull();
  });
  it('correo interno', () => {
    expect(correoInterno('6641234567')).toBe('6641234567@yonkes.mecanixyonkevirtual.com');
  });
});

describe('nombres reservados', () => {
  it('nadie se presenta como Mecanix ni aparenta una insignia', () => {
    for (const n of ['Mecanix', 'yonke MECANIX', 'Mé-ca-nix Oficial', 'Yonke Verificado', 'verificada', 'V.E.R.I.F.I.C.A.D.O']) expect(nombreReservado(n)).toBe(true);
  });
  it('los nombres normales pasan', () => {
    for (const n of ['Yonke El Tigre', 'Autopartes Ñandú', 'Mecánica Díaz']) expect(nombreReservado(n)).toBe(false);
  });
});

describe('validarRegistroLigero', () => {
  it('limpia los datos', () => {
    expect(validarRegistroLigero(bien())).toEqual({ datos: { nombre: 'Yonke El Tigre', whatsapp: '6641234567', password: 'secreto12', pedidoId: ID } });
  });
  it('ignora el estado que mande el navegador', () => {
    expect(validarRegistroLigero(bien({ estado: 'sonora', tipoRegistro: 'completo' })).datos).not.toHaveProperty('estado');
  });
  it('cada dato malo tiene su mensaje', () => {
    expect(validarRegistroLigero(bien({ nombre: ' a ' })).error).toBe(MENSAJES_LIGERO.nombre);
    expect(validarRegistroLigero(bien({ nombre: 'n'.repeat(101) })).error).toBe(MENSAJES_LIGERO.nombre);
    expect(validarRegistroLigero(bien({ nombre: 123 })).error).toBe(MENSAJES_LIGERO.nombre);
    expect(validarRegistroLigero(bien({ nombre: 'Yonke Mecanix' })).error).toBe(MENSAJES_LIGERO.nombreReservado);
    expect(validarRegistroLigero(bien({ whatsapp: '123' })).error).toBe(MENSAJES_LIGERO.whatsapp);
    expect(validarRegistroLigero(bien({ password: '1234567' })).error).toBe(MENSAJES_LIGERO.password);
    expect(validarRegistroLigero(bien({ password: 'x'.repeat(129) })).error).toBe(MENSAJES_LIGERO.password);
    expect(validarRegistroLigero(bien({ aceptaTerminos: 'true' })).error).toBe(MENSAJES_LIGERO.terminos);
    expect(validarRegistroLigero(bien({ pedidoId: 'corto' })).error).toBe(MENSAJES_LIGERO.alerta);
    expect(validarRegistroLigero(null).error).toBe(MENSAJES_LIGERO.nombre);
  });
});

describe('config/yonkesLigeros', () => {
  it('solo true exacto enciende, y los topes inválidos usan el respaldo', () => {
    expect(configLigeros(null)).toEqual({ habilitado: false, maxPorIpDia: MAX_POR_IP_DIA, maxPorDia: MAX_POR_DIA });
    expect(configLigeros({ habilitado: 'true' }).habilitado).toBe(false);
    expect(configLigeros({ habilitado: true, maxPorIpDia: 2, maxPorDia: 9 })).toEqual({ habilitado: true, maxPorIpDia: 2, maxPorDia: 9 });
    expect(configLigeros({ maxPorIpDia: 0, maxPorDia: '9' })).toMatchObject({ maxPorIpDia: 5, maxPorDia: 30 });
  });
});

describe('números de los yonkes existentes', () => {
  it('normaliza WhatsApp y teléfono en formato libre, e ignora lo inválido', () => {
    const n = numerosDeYonkes([{ whatsapp: '664 123 4567', telefono: '+52 664 999 8877' }, { telefono: 'sin número' }, {}]);
    expect([...n].sort()).toEqual(['6641234567', '6649998877']);
  });
});

describe('pantalla de entrada', () => {
  it('un WhatsApp en cualquier formato entra con su correo interno', () => {
    for (const t of ['6641234567', ' 664 123 4567 ', '+52 664 123 4567']) expect(correoDeEntrada(t)).toBe('6641234567@yonkes.mecanixyonkevirtual.com');
  });
  it('un correo sigue igual, sin espacios alrededor', () => {
    expect(correoDeEntrada('  Yonke@Correo.mx ')).toBe('Yonke@Correo.mx');
    expect(whatsappDeEntrada('6641234567@correo.mx')).toBeNull();
  });
  it('lo que no es número válido se deja tal cual, para que Firebase lo rechace', () => {
    expect(correoDeEntrada('12345')).toBe('12345');
    expect(whatsappDeEntrada('12345')).toBeNull();
    expect(correoDeEntrada(undefined)).toBe('');
  });
  it('cuentas internas: solo con el dominio exacto', () => {
    expect(esCuentaInterna('6641234567@yonkes.mecanixyonkevirtual.com')).toBe(true);
    for (const c of ['a@b.mx', 'x@mecanixyonkevirtual.com', 'x@yonkes.mecanixyonkevirtual.com.mx', '', null]) expect(esCuentaInterna(c)).toBe(false);
  });
  it('enlace de recuperar: a tu WhatsApp, con el número del yonke', () => {
    const enlace = enlaceRecuperarWhatsapp('6641234567');
    expect(enlace.startsWith('https://wa.me/526611034260?text=')).toBe(true);
    expect(decodeURIComponent(enlace)).toContain('6641234567');
  });
});
