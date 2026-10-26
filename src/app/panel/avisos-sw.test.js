// Service worker de los avisos (public/panel/avisos-sw.js), cargado en un entorno simulado.
import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const codigo = readFileSync(new URL('../../../public/panel/avisos-sw.js', import.meta.url), 'utf8');

function cargar({ ventanas = [] } = {}) {
  const oyentes = {};
  const self = {
    location: { origin: 'https://mecanixyonkevirtual.com' },
    addEventListener: (tipo, fn) => { oyentes[tipo] = fn; },
    skipWaiting: vi.fn(),
    registration: { showNotification: vi.fn(async () => {}) },
    clients: { claim: vi.fn(), matchAll: vi.fn(async () => ventanas), openWindow: vi.fn(async () => {}) },
  };
  vm.runInNewContext(codigo, { self, URL, console });
  const disparar = async (tipo, evento) => {
    let espera = Promise.resolve();
    oyentes[tipo]({ ...evento, waitUntil: (p) => { espera = p; } });
    await espera;
  };
  return { self, oyentes, disparar };
}
const push = (datos) => ({ data: { json: () => datos } });

describe('service worker de avisos', () => {
  it('solo escucha install, activate, push y notificationclick (nada de fetch ni caché)', () => {
    const { oyentes } = cargar();
    expect(Object.keys(oyentes).sort()).toEqual(['activate', 'install', 'notificationclick', 'push']);
    expect(codigo).not.toMatch(/importScripts|caches\./);
  });
  it('muestra el aviso con título, texto, ícono y etiqueta (formato de FCM con "data")', async () => {
    const { self, disparar } = cargar();
    await disparar('push', push({ data: { titulo: 'Nueva búsqueda activa', cuerpo: 'Alternador · Nissan Sentra 2005', url: '/panel/reservaciones?pedido=P1', etiqueta: 'mecanix-alertas' }, from: '123' }));
    expect(self.registration.showNotification).toHaveBeenCalledWith('Nueva búsqueda activa', {
      body: 'Alternador · Nissan Sentra 2005', icon: '/icons/icon-192.png', tag: 'mecanix-alertas', renotify: true, data: { url: '/panel/reservaciones?pedido=P1' },
    });
  });
  it('datos raros o ajenos: aviso genérico que abre Pedidos', async () => {
    const { self, disparar } = cargar();
    await disparar('push', push({ data: { url: 'https://otro-sitio.com/robo' } }));
    await disparar('push', { data: { json: () => { throw new Error('no es JSON'); } } });
    for (const [titulo, opciones] of self.registration.showNotification.mock.calls) {
      expect(titulo).toBe('Mecanix Yonke Virtual');
      expect(opciones.data.url).toBe('/panel/reservaciones');
    }
  });
  it('al tocarlo: si el panel está abierto, lo enfoca y lo lleva a la pantalla del aviso', async () => {
    const ventana = { url: 'https://mecanixyonkevirtual.com/panel/inventario', focus: vi.fn(async () => {}), navigate: vi.fn(async () => {}) };
    const { self, disparar } = cargar({ ventanas: [ventana] });
    const close = vi.fn();
    await disparar('notificationclick', { notification: { close, data: { url: '/panel/reservaciones?pedido=P1' } } });
    expect(close).toHaveBeenCalled();
    expect(ventana.focus).toHaveBeenCalled();
    expect(ventana.navigate).toHaveBeenCalledWith('https://mecanixyonkevirtual.com/panel/reservaciones?pedido=P1');
    expect(self.clients.openWindow).not.toHaveBeenCalled();
  });
  it('al tocarlo con la app cerrada: abre Pedidos en una ventana nueva', async () => {
    const { self, disparar } = cargar();
    await disparar('notificationclick', { notification: { close: vi.fn(), data: { url: '/panel/reservaciones' } } });
    expect(self.clients.openWindow).toHaveBeenCalledWith('https://mecanixyonkevirtual.com/panel/reservaciones');
  });
});
