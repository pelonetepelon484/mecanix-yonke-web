'use client';

// Aviso de instalación del navegador (Android/Chrome y computadora): el evento
// "beforeinstallprompt" llega una sola vez por carga de página. Se guarda aquí para que el botón
// "Instalar app" lo use cuando la persona quiera; preventDefault() evita la barrita automática de
// Chrome (en su lugar va nuestro aviso). iPhone no tiene este evento.
import { useSyncExternalStore } from 'react';

let evento = null;
let escuchando = false;
const oyentes = new Set();

function avisar() {
  oyentes.forEach((f) => f());
}

function escuchar() {
  if (escuchando || typeof window === 'undefined') return;
  escuchando = true;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    evento = e;
    avisar();
  });
  window.addEventListener('appinstalled', () => {
    evento = null;
    avisar();
  });
}

function suscribir(cb) {
  escuchar();
  oyentes.add(cb);
  return () => oyentes.delete(cb);
}

export function usePromptInstalacion() {
  return useSyncExternalStore(suscribir, () => evento, () => null);
}

// Abre el aviso del navegador. Devuelve 'accepted', 'dismissed' o 'sin-aviso'.
export async function pedirInstalacion() {
  const e = evento;
  if (!e) return 'sin-aviso';
  e.prompt();
  const { outcome } = await e.userChoice;
  evento = null; // el mismo aviso no se puede usar dos veces
  avisar();
  return outcome;
}
