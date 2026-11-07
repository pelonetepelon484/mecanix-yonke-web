// Interruptores de la portada (config/portada). Solo true exacto enciende; sin documento, con otro
// valor o si falla la lectura, todo apagado: la página se ve como hoy.
//   botonPanel: con sesión iniciada, "Ir a mi panel" en lugar de "¿Tienes un yonke?" y
//   "¿Tienes un taller?" en la portada, y "← Ir a Mecanix" dentro del panel.
//   ecosistema: bloque "Ecosistema de soluciones automotrices" al final de la pestaña cliente
//   (EcosistemaMecanix.js). Se lee en el servidor (page.js) para que el texto vaya en el HTML inicial.
//   bienvenida: página /bienvenida (para mandar a yonkes y talleres). Apagada, /bienvenida da 404.
//   asistenciaVialProximamente: tarjeta "Asistencia vial · Próximamente" en el bloque ecosistema.
//   asistenciaVialActiva: directorio público /asistencia-vial (apagada, 404 y noindex) y la tarjeta
//   pasa a activa con enlace. Ver src/lib/asistenciaVial.js.
//   asistenciaVialMapa: mapa y "Usar mi ubicación" en /asistencia-vial, y el enlace "Estoy aquí"
//   de los proveedores (/asistencia-vial/aqui). Solo sirve con asistenciaVialActiva encendida.
//   Ver src/lib/ubicacionAsistencia.js.
//   asistenciaVialRegistro: botón "Regístrate" para proveedores (abre WhatsApp a Red Mecanix, no
//   guarda nada) en la tarjeta de asistencia vial de la portada y en /asistencia-vial. Ver
//   src/lib/registroAsistencia.js.
import { doc, getDoc } from 'firebase/firestore';

export const banderasPortada = (config) => ({
  botonPanel: config?.botonPanel === true, ecosistema: config?.ecosistema === true, bienvenida: config?.bienvenida === true,
  asistenciaVialProximamente: config?.asistenciaVialProximamente === true, asistenciaVialActiva: config?.asistenciaVialActiva === true,
  asistenciaVialMapa: config?.asistenciaVialMapa === true, asistenciaVialRegistro: config?.asistenciaVialRegistro === true,
});

export async function leerConfigPortada(db) {
  try {
    const snap = await getDoc(doc(db, 'config', 'portada'));
    return banderasPortada(snap.exists() ? snap.data() : null);
  } catch (error) {
    console.warn('[portada] No se pudo leer config/portada; todo apagado.', error?.code || error?.message);
    return banderasPortada(null);
  }
}
