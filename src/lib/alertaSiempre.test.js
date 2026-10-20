import { describe, expect, it, vi } from 'vitest';
import { alertaSiempreActiva, lugarAlertaConResultados, mensajeConAlerta } from './alertaSiempre';

describe('config/pedidosClientes.alertaSiempre', () => {
  it('encendida por omisión; solo false exacto la apaga', () => {
    expect(alertaSiempreActiva(null)).toBe(true);
    expect(alertaSiempreActiva({})).toBe(true);
    expect(alertaSiempreActiva({ alertaSiempre: true })).toBe(true);
    expect(alertaSiempreActiva({ alertaSiempre: 'false' })).toBe(true);
    expect(alertaSiempreActiva({ alertaSiempre: false })).toBe(false);
  });

  it('con resultados: arriba (compacta) encendida; al final (discreta) apagada, como antes', () => {
    expect(lugarAlertaConResultados(true)).toBe('arriba');
    expect(lugarAlertaConResultados(false)).toBe('final');
  });

  it('mensajes con alerta grande: los de siempre + número de parte, marca muy general y pieza sin vehículo', () => {
    for (const tipo of ['sin_inventario', 'no_catalogado', 'sin_yonkes_estado', 'sin_en_tu_zona']) {
      expect(mensajeConAlerta(tipo, true)).toBe(true);
      expect(mensajeConAlerta(tipo, false)).toBe(true);
    }
    for (const tipo of ['numero_de_parte', 'marca_muy_general', 'pieza_sin_vehiculo']) {
      expect(mensajeConAlerta(tipo, true)).toBe(true);
      expect(mensajeConAlerta(tipo, false)).toBe(false); // apagada: como hoy
    }
    // Nunca: "¿Quisiste decir…?", demasiadas búsquedas, error (ni lo que no es una búsqueda de pieza).
    for (const tipo of ['confirmar', 'rate_limited', 'error', 'rechazado', 'fuera_de_giro', 'parseo_parcial', 'no_interpretada']) {
      expect(mensajeConAlerta(tipo, true)).toBe(false);
    }
  });
});

describe('leerBanderaAlertaSiempre', () => {
  it('lee el mismo documento: sin el campo encendida, con false apagada', async () => {
    let datos = {};
    vi.doMock('firebase/firestore', () => ({ doc: () => 'd', getDoc: async () => ({ exists: () => true, data: () => datos }) }));
    vi.doMock('../app/lib/firebase', () => ({ db: 'db' }));
    vi.resetModules();
    expect(await (await import('../app/lib/banderaPedidosClientes')).leerBanderaAlertaSiempre()).toBe(true);
    datos = { alertaSiempre: false };
    vi.resetModules();
    expect(await (await import('../app/lib/banderaPedidosClientes')).leerBanderaAlertaSiempre()).toBe(false);
  });
});
