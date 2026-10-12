/* Service worker de los avisos del panel (notificaciones push). Vive en /panel/ y solo actúa
   dentro de /panel/: no toca las páginas públicas ni los subdominios. SOLO muestra avisos y abre
   el panel al tocarlos: no guarda caché ni intercepta páginas (no hay "fetch"), así que no cambia
   cómo carga el sitio ni la app instalable. No carga librerías de internet.
   El servidor (src/app/lib/avisosPush) manda mensajes de solo datos: { titulo, cuerpo, url, etiqueta }. */

// Solo se abren rutas del propio panel; cualquier otra cosa abre Pedidos.
function rutaSegura(url) {
  return typeof url === 'string' && /^\/panel\/[A-Za-z0-9/_?=&-]*$/.test(url) ? url : '/panel/reservaciones';
}

function datosDelAviso(evento) {
  let crudo = {};
  try { crudo = evento.data ? evento.data.json() : {}; } catch (e) { crudo = {}; }
  const d = (crudo && crudo.data) || crudo || {};
  return {
    titulo: typeof d.titulo === 'string' && d.titulo ? d.titulo : 'Mecanix Yonke Virtual',
    cuerpo: typeof d.cuerpo === 'string' ? d.cuerpo : '',
    url: rutaSegura(d.url),
    etiqueta: typeof d.etiqueta === 'string' && d.etiqueta ? d.etiqueta : 'mecanix-avisos',
  };
}

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (evento) => evento.waitUntil(self.clients.claim()));

self.addEventListener('push', (evento) => {
  const aviso = datosDelAviso(evento);
  evento.waitUntil(self.registration.showNotification(aviso.titulo, {
    body: aviso.cuerpo,
    icon: '/icons/icon-192.png',
    tag: aviso.etiqueta, // varios avisos seguidos se juntan en uno
    renotify: true,
    data: { url: aviso.url },
  }));
});

self.addEventListener('notificationclick', (evento) => {
  evento.notification.close();
  const ruta = rutaSegura(evento.notification.data && evento.notification.data.url);
  const destino = new URL(ruta, self.location.origin).href;
  evento.waitUntil((async () => {
    const ventanas = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const ventana of ventanas) {
      if (new URL(ventana.url).origin !== self.location.origin) continue;
      await ventana.focus();
      try {
        if ('navigate' in ventana) { await ventana.navigate(destino); return; }
      } catch (e) { /* ventana que este service worker no controla: se abre una nueva */ }
      break;
    }
    await self.clients.openWindow(destino);
  })());
});
