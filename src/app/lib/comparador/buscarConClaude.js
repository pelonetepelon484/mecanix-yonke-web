// Solo servidor. Búsqueda automática de equivalencias con Claude + búsqueda web.
// Se usa SOLO si config/comparador.sugerenciasIA es true Y existe ANTHROPIC_API_KEY en las variables
// de entorno del servidor (Vercel). La llave nunca llega al navegador ni se guarda en Firestore.
// El resultado es una SUGERENCIA para el admin: el cliente nunca la ve sin aprobar.
import Anthropic from '@anthropic-ai/sdk';
import { etiquetaTipoPieza } from '../../../lib/comparadorPiezas';
import { leerRespuestaIA, limpiarFuentes } from '../../../lib/equivalencias';

export const MODELO_IA = 'claude-sonnet-5-5';
const MAX_BUSQUEDAS = 5;
const MAX_VUELTAS = 3; // reanudaciones por "pause_turn" (búsquedas largas)

const SISTEMA = `You verify auto part number interchange for a used-parts marketplace in Mexico.
Use web search to check whether two OEM part numbers are the same part (same hardware, or one officially supersedes/replaces the other).
Rules:
- Only say they are equivalent if a source you found states it (supersession, interchange, "replaces", "same as").
- If sources disagree, are unclear, or you found nothing, answer equivalentes = null. Never guess.
- Calibration/software numbers that share hardware count as related part numbers, but say so in the summary.
- Ignore prices and sellers' marketing claims.
When finished, reply with ONLY one JSON object, no other text:
{"equivalentes": true | false | null, "confianza": "alta" | "media" | "baja", "resumen": "<2-3 short sentences in Spanish (Mexico): what the sources say, vehicle/application if known>", "partesRelacionadas": ["<other OEM part numbers the sources list as the same part>"]}`;

function pregunta({ tipo, parteA, parteB }) {
  return `Tipo de pieza: ${etiquetaTipoPieza(tipo)}.\nNúmero de parte A: ${parteA}\nNúmero de parte B: ${parteB}\n¿Son la misma pieza (o uno reemplaza al otro)?`;
}

// Fuentes reales: primero las que el modelo citó; si no citó, los primeros resultados de la búsqueda.
function fuentesDe(bloques) {
  const citadas = [];
  const encontradas = [];
  for (const b of bloques) {
    if (b.type === 'text' && Array.isArray(b.citations)) {
      for (const c of b.citations) if (c?.type === 'web_search_result_location') citadas.push({ url: c.url, titulo: c.title || '' });
    }
    if (b.type === 'web_search_tool_result' && Array.isArray(b.content)) {
      for (const r of b.content) if (r?.type === 'web_search_result') encontradas.push({ url: r.url, titulo: r.title || '' });
    }
  }
  return limpiarFuentes(citadas.length ? citadas : encontradas);
}

// Devuelve { estado: 'pendiente' | 'sin_resultado' | 'error', equivalentes, confianza, resumen,
// partesRelacionadas, fuentes, tokensEntrada, tokensSalida, busquedas }. Nunca lanza.
export async function buscarConClaude(entrada, { cliente } = {}) {
  const uso = { tokensEntrada: 0, tokensSalida: 0, busquedas: 0 };
  if (!cliente && !process.env.ANTHROPIC_API_KEY) return { estado: 'error', motivo: 'sin_llave', ...uso, fuentes: [] };
  const client = cliente || new Anthropic({ timeout: 120 * 1000, maxRetries: 1 });
  const messages = [{ role: 'user', content: pregunta(entrada) }];
  const bloques = [];
  try {
    let respuesta;
    for (let vuelta = 0; vuelta < MAX_VUELTAS; vuelta += 1) {
      respuesta = await client.beta.messages.create({
        model: MODELO_IA,
        max_tokens: 16000,
        system: SISTEMA,
        messages,
        tools: [{ type: 'web_search_20260209', name: 'web_search', max_uses: MAX_BUSQUEDAS }],
        output_config: { effort: 'medium' },
        // Si el modelo se niega por una regla de seguridad, el servidor de Anthropic reintenta con
        // otro modelo en la misma llamada.
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
      });
      uso.tokensEntrada += respuesta.usage?.input_tokens || 0;
      uso.tokensSalida += respuesta.usage?.output_tokens || 0;
      uso.busquedas += respuesta.usage?.server_tool_use?.web_search_requests || 0;
      bloques.push(...respuesta.content);
      if (respuesta.stop_reason !== 'pause_turn') break;
      messages.push({ role: 'assistant', content: respuesta.content });
    }
    if (respuesta.stop_reason === 'refusal' || respuesta.stop_reason === 'max_tokens' || respuesta.stop_reason === 'pause_turn') {
      return { estado: 'error', motivo: respuesta.stop_reason, ...uso, fuentes: fuentesDe(bloques) };
    }
    // El JSON va en el último bloque de texto de la respuesta final.
    const textos = respuesta.content.filter((b) => b.type === 'text').map((b) => b.text);
    const r = leerRespuestaIA(textos.join('\n'));
    const fuentes = fuentesDe(bloques);
    // Sin fuentes no hay sugerencia positiva, diga lo que diga el modelo.
    const confirmado = r.equivalentes === true && fuentes.length > 0;
    return { estado: confirmado ? 'pendiente' : 'sin_resultado', ...r, fuentes, ...uso };
  } catch (error) {
    console.warn('[comparador] Falló la búsqueda automática', error?.status || error?.name || error?.message);
    return { estado: 'error', motivo: 'api', ...uso, fuentes: [] };
  }
}
