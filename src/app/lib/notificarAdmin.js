// Server-only: nunca importar desde un componente 'use client'. El teléfono y la API key de
// CallMeBot viven en variables de entorno (CALLMEBOT_ADMIN_PHONE / CALLMEBOT_APIKEY) para no
// exponerlas en el bundle del navegador, a diferencia del hardcodeo previo en
// panel/registro/page.js. Mismo servicio (CallMeBot) reutilizado para todos los avisos al
// WhatsApp del admin: búsquedas sin inventario con contacto dejado, nuevos registros de yonke, etc.
export async function notificarAdmin(mensaje) {
  const phone = process.env.CALLMEBOT_ADMIN_PHONE;
  const apikey = process.env.CALLMEBOT_APIKEY;

  if (!phone || !apikey) {
    console.error('[notificarAdmin] Faltan CALLMEBOT_ADMIN_PHONE / CALLMEBOT_APIKEY en las variables de entorno — aviso no enviado');
    return;
  }

  try {
    const url = `https://api.callmebot.com/whatsapp.php?phone=${encodeURIComponent(phone)}&text=${encodeURIComponent(mensaje)}&apikey=${encodeURIComponent(apikey)}`;
    await fetch(url);
  } catch (error) {
    console.error('[notificarAdmin] No se pudo enviar el aviso por CallMeBot', { message: error?.message });
  }
}
