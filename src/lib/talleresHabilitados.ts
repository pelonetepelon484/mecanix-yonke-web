// Bandera de la función de talleres (registro, cotizaciones y botones relacionados).
// Está APAGADA si la variable no existe o si no vale exactamente "1".
// Se lee al construir la app: cambiarla exige un nuevo deploy (Vercel) o reiniciar `npm run dev`.
export function talleresHabilitados(): boolean {
  return process.env.NEXT_PUBLIC_TALLERES_HABILITADOS === '1';
}
