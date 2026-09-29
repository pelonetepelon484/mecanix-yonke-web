import { describe, expect, it } from 'vitest';
import { debeMostrarAvisoPiezaSinVehiculo, piezaExentaDeVehiculo } from './piezaSinVehiculo';

describe('debeMostrarAvisoPiezaSinVehiculo', () => {
  it('pieza sin nada más ("calavera") -> true', () => {
    expect(debeMostrarAvisoPiezaSinVehiculo({ pieza: 'Calavera trasera izquierda', modelo: null, cilindrada: null })).toBe(true);
  });

  it('pieza + marca por alias de plataforma, sin modelo ("facia trasera de mk6") -> true', () => {
    // mk6 solo resuelve marca (Volkswagen); modelo sigue null -- no alcanza.
    expect(debeMostrarAvisoPiezaSinVehiculo({ pieza: 'Facia trasera', modelo: null, cilindrada: null })).toBe(true);
  });

  it('pieza + modelo ("Calavera Dodge Stratus") -> false, búsqueda normal', () => {
    expect(debeMostrarAvisoPiezaSinVehiculo({ pieza: 'Calavera trasera izquierda', modelo: 'Stratus', cilindrada: null })).toBe(false);
  });

  it('vehículo sin pieza ("Jeep 2003") -> false (no aplica, no hay pieza)', () => {
    expect(debeMostrarAvisoPiezaSinVehiculo({ pieza: null, modelo: null, cilindrada: null })).toBe(false);
  });

  it('pieza + cilindrada, sin modelo ("arranque 3.6") -> false, la cilindrada ya narrows lo suficiente', () => {
    expect(debeMostrarAvisoPiezaSinVehiculo({ pieza: 'Arranque', modelo: null, cilindrada: 3.6 })).toBe(false);
  });

  it('pieza exenta (aceite/batería) sin vehículo -> false, se trata como caso (c)', () => {
    expect(debeMostrarAvisoPiezaSinVehiculo({ pieza: 'Aceite', modelo: null, cilindrada: null })).toBe(false);
    expect(debeMostrarAvisoPiezaSinVehiculo({ pieza: 'batería', modelo: null, cilindrada: null })).toBe(false);
  });

  it('sin pieza en absoluto -> siempre false', () => {
    expect(debeMostrarAvisoPiezaSinVehiculo({ pieza: null, modelo: 'Stratus', cilindrada: null })).toBe(false);
    expect(debeMostrarAvisoPiezaSinVehiculo({ pieza: undefined, modelo: null, cilindrada: null })).toBe(false);
  });
});

describe('piezaExentaDeVehiculo', () => {
  it('compara sin importar mayúsculas ni acentos', () => {
    expect(piezaExentaDeVehiculo('ACEITE')).toBe(true);
    expect(piezaExentaDeVehiculo('bateria')).toBe(true);
    expect(piezaExentaDeVehiculo('Batería')).toBe(true);
  });
  it('cualquier otra pieza, o nada -> false', () => {
    expect(piezaExentaDeVehiculo('Calavera trasera izquierda')).toBe(false);
    expect(piezaExentaDeVehiculo(null)).toBe(false);
    expect(piezaExentaDeVehiculo('')).toBe(false);
  });
});
