import { describe, expect, it } from 'vitest';
import {
  anchorVehiculo, hrefContactoVehiculo, idVehiculoDesdeHash, mensajeContactoVehiculo, urlVehiculo,
} from './contactoVehiculo';

describe('anchorVehiculo / urlVehiculo', () => {
  it('arma el ancla y la URL completa', () => {
    expect(anchorVehiculo('abc123')).toBe('vehiculo-abc123');
    expect(urlVehiculo('https://elcamino.mecanixyonkevirtual.com/', 'abc123'))
      .toBe('https://elcamino.mecanixyonkevirtual.com/#vehiculo-abc123');
  });
});

describe('mensajeContactoVehiculo', () => {
  it('mensaje exacto con la URL en su propia línea', () => {
    expect(mensajeContactoVehiculo('Honda', 'Civic', 1999, 'https://x.com/#vehiculo-1'))
      .toBe('Hola, estoy interesado en Honda Civic 1999\nhttps://x.com/#vehiculo-1');
  });
});

describe('hrefContactoVehiculo', () => {
  it('arma el enlace wa.me con el mensaje codificado', () => {
    const href = hrefContactoVehiculo('6641234567', 'Honda', 'Civic', 1999, 'https://x.com/#vehiculo-1');
    expect(href).toBe(`https://wa.me/526641234567?text=${encodeURIComponent('Hola, estoy interesado en Honda Civic 1999\nhttps://x.com/#vehiculo-1')}`);
  });
  it('sin número válido -> null (el botón se oculta)', () => {
    expect(hrefContactoVehiculo('', 'Honda', 'Civic', 1999, 'https://x.com')).toBeNull();
    expect(hrefContactoVehiculo(undefined, 'Honda', 'Civic', 1999, 'https://x.com')).toBeNull();
    expect(hrefContactoVehiculo('123', 'Honda', 'Civic', 1999, 'https://x.com')).toBeNull();
  });
});

describe('idVehiculoDesdeHash', () => {
  it('extrae el id con o sin "#" inicial', () => {
    expect(idVehiculoDesdeHash('#vehiculo-abc123')).toBe('abc123');
    expect(idVehiculoDesdeHash('vehiculo-abc123')).toBe('abc123');
  });
  it('hash vacío, ausente o de otro formato -> null (carga normal)', () => {
    expect(idVehiculoDesdeHash('')).toBeNull();
    expect(idVehiculoDesdeHash(null)).toBeNull();
    expect(idVehiculoDesdeHash(undefined)).toBeNull();
    expect(idVehiculoDesdeHash('#otracosa')).toBeNull();
  });
});
