import { whatsappHref } from './whatsapp';

// "Toques al botón de WhatsApp" de un vehículo del sitio con subdominio (tenant). Lógica pura:
// arma el mensaje y el enlace wa.me. El registro del toque (contador server-side) vive aparte,
// en src/app/lib/registrarContactoVehiculo.js (SDK normal del navegador, fire-and-forget) —
// esta función no toca red ni Firestore.

export function anchorVehiculo(vehiculoId: string): string {
  return `vehiculo-${vehiculoId}`;
}

// urlBase sin hash ni query (ej. location.origin + location.pathname).
export function urlVehiculo(urlBase: string, vehiculoId: string): string {
  return `${urlBase}#${anchorVehiculo(vehiculoId)}`;
}

export function mensajeContactoVehiculo(marca: string, modelo: string, ano: unknown, urlVehiculoCompleta: string): string {
  return `Hola, estoy interesado en ${marca} ${modelo} ${ano}\n${urlVehiculoCompleta}`;
}

// null si el yonke no tiene WhatsApp válido (el botón debe ocultarse, no mostrar un enlace roto).
export function hrefContactoVehiculo(
  numeroWhatsapp: unknown,
  marca: string,
  modelo: string,
  ano: unknown,
  urlVehiculoCompleta: string,
): string | null {
  return whatsappHref(numeroWhatsapp, mensajeContactoVehiculo(marca, modelo, ano, urlVehiculoCompleta));
}

// Id de vehículo dentro de un hash de URL, ej. "#vehiculo-abc123" -> "abc123". null si el hash no
// tiene ese formato (carga normal, sin expandir ni hacer scroll a nada).
export function idVehiculoDesdeHash(hash: string | null | undefined): string | null {
  if (!hash) return null;
  const m = /^#?vehiculo-(.+)$/.exec(hash);
  return m ? m[1] : null;
}
