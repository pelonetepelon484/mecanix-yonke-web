// Interruptores de la portada (config/portada). Solo true exacto enciende; sin documento, con otro
// valor o si falla la lectura, todo apagado: la página se ve como hoy.
//   botonPanel: con sesión iniciada, "Ir a mi panel" en lugar de "¿Tienes un yonke?" y
//   "¿Tienes un taller?" en la portada, y "← Ir a Mecanix" dentro del panel.
//   ecosistema: bloque "Ecosistema de soluciones automotrices" al final de la pestaña cliente
//   (EcosistemaMecanix.js). Se lee en el servidor (page.js) para que el texto vaya en el HTML inicial.
//   bienvenida: página /bienvenida (para mandar a yonkes y talleres). Apagada, /bienvenida da 404.
import { doc, getDoc } from 'firebase/firestore';

export const banderasPortada = (config) => ({
  botonPanel: config?.botonPanel === true, ecosistema: config?.ecosistema === true, bienvenida: config?.bienvenida === true,
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
