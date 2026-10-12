// Navegador. Pide al servidor el aviso por WhatsApp al admin (CallMeBot). NUNCA lanza ni hace
// fallar la acción del usuario (pedido, registro, reservación): si no hay sesión, si falla la
// red o si el servidor dice que no (límite, repetido...), simplemente no hay aviso.
// obtenerToken: función que devuelve el pase de sesión de Firebase (o nada, si no hace falta).
// Devuelve true solo si el servidor confirmó que avisó.
export async function avisarAlAdmin(ruta, { cuerpo = {}, obtenerToken = null, fetchFn = fetch } = {}) {
  try {
    const headers = { 'Content-Type': 'application/json' };
    if (obtenerToken) {
      const token = await obtenerToken();
      if (!token) return false;
      headers.Authorization = `Bearer ${token}`;
    }
    const r = await fetchFn(ruta, { method: 'POST', headers, body: JSON.stringify(cuerpo) });
    if (!r?.ok) return false;
    const datos = await r.json().catch(() => null);
    return datos?.avisado === true;
  } catch (error) {
    console.error('No se pudo enviar el aviso al admin', error);
    return false;
  }
}
