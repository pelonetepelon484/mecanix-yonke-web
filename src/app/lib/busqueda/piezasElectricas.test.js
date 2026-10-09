import { describe, expect, it, vi } from 'vitest';

// Sin Firestore: el catálogo vivo y config/sinonimosPiezas no existen, se usa solo la base del repo.
vi.mock('../firebase-server', () => ({ dbServer: {} }));
vi.mock('firebase/firestore', () => ({
  doc: vi.fn(), collection: vi.fn(),
  getDoc: vi.fn(async () => ({ exists: () => false, data: () => ({}) })),
  getDocs: vi.fn(async () => ({ docs: [], empty: true })),
}));

const { extraerIntencion } = await import('./extraerIntencion');
const { filtrarPrevio } = await import('./filtroPrevio');
const { obtenerSinonimosCombinados } = await import('./sinonimosPiezas');
const { PIEZAS_CATALOGO, PIEZAS_CATALOGO_SUELTAS } = await import('../piezasCatalogo');

const pieza = async (texto) => (await extraerIntencion(texto)).pieza;

describe('piezas eléctricas nuevas en el catálogo', () => {
  it('BCM y Bobinas están en el catálogo (y en piezas sueltas); las existentes no cambian', () => {
    for (const p of ['Módulo BCM', 'Bobinas de encendido']) {
      expect(PIEZAS_CATALOGO).toContain(p);
      expect(PIEZAS_CATALOGO_SUELTAS).toContain(p);
    }
    for (const p of ['Computadora de motor', 'Computadora de transmisión', 'Caja de fusibles', 'Motor', 'Transmisión', 'Alternador']) {
      expect(PIEZAS_CATALOGO).toContain(p);
    }
  });
});

describe('el buscador reconoce las piezas por sus nombres comunes', () => {
  const casos = {
    'Módulo BCM': ['bcm nissan sentra 2010', 'modulo bcm sentra 2010', 'modulo de carroceria sentra 2010', 'modulo de control de carroceria sentra 2010', 'computadora de carroceria sentra 2010', 'body control module sentra 2010'],
    'Computadora de transmisión': ['tcm nissan sentra 2010', 'modulo tcm sentra 2010', 'modulo de transmision sentra 2010', 'computadora de transmision sentra 2010', 'computadora de la transmision sentra 2010', 'transmission control module sentra 2010'],
    'Computadora de motor': ['ecm nissan sentra 2010', 'ecu sentra 2010', 'pcm sentra 2010', 'computadora sentra 2010', 'computadora del motor sentra 2010', 'computadora de motor sentra 2010', 'compu sentra 2010', 'modulo ecm sentra 2010', 'engine control module sentra 2010'],
    'Caja de fusibles': ['caja de fusibles nissan sentra 2010', 'caja fusibles sentra 2010', 'fusiblera sentra 2010', 'fuse box sentra 2010'],
    'Bobinas de encendido': ['bobina nissan sentra 2010', 'bobinas sentra 2010', 'bobina de encendido sentra 2010', 'ignition coil sentra 2010', 'coil pack sentra 2010'],
  };
  for (const [esperada, textos] of Object.entries(casos)) {
    it(`${esperada}: ${textos.length} formas de escribirla`, async () => {
      for (const texto of textos) {
        const r = await extraerIntencion(texto);
        expect({ texto, pieza: r.pieza }).toEqual({ texto, pieza: esperada });
        expect(r.reconocido).toBe(true);
        expect(r.modelo).toBe('Sentra');
      }
    });
  }
  it('con acentos y mayúsculas también', async () => {
    expect(await pieza('Módulo de Carrocería Sentra 2010')).toBe('Módulo BCM');
    expect(await pieza('COMPUTADORA DE TRANSMISIÓN sentra 2010')).toBe('Computadora de transmisión');
    expect(await pieza('Caja de Fusibles sentra 2010')).toBe('Caja de fusibles');
  });
  it('pasan el filtro previo (no se registran como "no interpretadas")', async () => {
    const sinonimos = await obtenerSinonimosCombinados();
    for (const texto of ['bcm sentra 2010', 'ecu tsuru 2005', 'pcm versa 2015', 'tcm sentra 2010', 'fusiblera versa 2015', 'bobina sentra 2010', 'coil pack sentra 2010']) {
      expect({ texto, permitido: filtrarPrevio(texto, sinonimos).permitido }).toEqual({ texto, permitido: true });
    }
  });
});

describe('sin romper lo que ya funcionaba', () => {
  it('"caja" sola sigue siendo transmisión; motor, alternador y transmisión igual que antes', async () => {
    expect(await pieza('caja nissan sentra 2010')).toBe('Transmisión');
    expect(await pieza('transmision sentra 2010')).toBe('Transmisión');
    expect(await pieza('motor sentra 2010')).toBe('Motor');
    expect(await pieza('alternador sentra 2010')).toBe('Alternador');
    expect(await pieza('calavera trasera sentra 2010')).toBe('Calavera');
    expect(await pieza('compresor sentra 2010')).toBe('Compresor A/C');
  });
  it('"módulo" solo no se adivina como BCM (por ejemplo, "modulo abs")', async () => {
    expect(await pieza('modulo abs sentra 2010')).not.toBe('Módulo BCM');
  });
});
