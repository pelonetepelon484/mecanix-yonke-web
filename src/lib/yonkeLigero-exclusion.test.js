import { describe, expect, it, vi } from 'vitest';
import { esRegistroLigero, whatsappDeCuentaInterna } from './yonkeLigero';

// Los de registro ligero no tienen inventario: fuera del buscador, de otros estados y de los conteos.
vi.mock('../app/lib/firebase-server', () => ({ dbServer: {} }));
const docsDe = (lista) => lista.map((d, i) => ({ id: `Y${i}`, data: () => d }));
const { yonkesElegiblesOtrosEstados } = await import('../app/lib/busqueda/otrosEstados');

describe('esRegistroLigero', () => {
  it('solo el campo exacto: los actuales (sin campo) y los que ya completaron cuentan normal', () => {
    expect(esRegistroLigero({ tipoRegistro: 'ligero' })).toBe(true);
    for (const y of [{}, { tipoRegistro: 'completo' }, null, undefined]) expect(esRegistroLigero(y)).toBe(false);
  });
});

describe('whatsappDeCuentaInterna', () => {
  it('saca el número solo de cuentas internas bien formadas', () => {
    expect(whatsappDeCuentaInterna('6641234567@yonkes.mecanixyonkevirtual.com')).toBe('6641234567');
    for (const c of ['a@b.mx', 'abc@yonkes.mecanixyonkevirtual.com', null]) expect(whatsappDeCuentaInterna(c)).toBeNull();
  });
});

describe('resultados de otros estados', () => {
  it('nunca incluye un ligero, ni marcado como verificado', () => {
    const lista = docsDe([
      { activo: true, verificado: true, estado: 'sonora' },
      { activo: true, verificado: true, estado: 'sonora', tipoRegistro: 'ligero' },
      { activo: true, verificado: true, estado: 'jalisco', tipoRegistro: 'completo' },
    ]);
    expect(yonkesElegiblesOtrosEstados(lista, 'baja-california').map((d) => d.id)).toEqual(['Y0', 'Y2']);
  });
});
