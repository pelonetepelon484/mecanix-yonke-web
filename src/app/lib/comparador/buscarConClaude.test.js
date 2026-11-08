import { afterEach, describe, expect, it, vi } from 'vitest';
import { MODELO_IA, buscarConClaude } from './buscarConClaude';

// Cliente falso: nunca se llama a Anthropic en las pruebas.
function cliente(...respuestas) {
  const create = vi.fn();
  for (const r of respuestas) create.mockResolvedValueOnce(r);
  return { create, beta: { messages: { create } } };
}
const uso = { input_tokens: 1000, output_tokens: 200, server_tool_use: { web_search_requests: 2 } };
const resultadoBusqueda = { type: 'web_search_tool_result', content: [{ type: 'web_search_result', url: 'https://ejemplo.com/e69', title: 'GM E69' }] };
const texto = (t, citas) => ({ type: 'text', text: t, ...(citas ? { citations: citas } : {}) });
const JSON_SI = '{"equivalentes": true, "confianza": "alta", "resumen": "19210736 reemplaza a 12605843.", "partesRelacionadas": ["12615418"]}';
const entrada = { tipo: 'computadora', parteA: '12605843', parteB: '19210736' };

describe('búsqueda automática con Claude', () => {
  afterEach(() => { vi.unstubAllEnvs(); });

  it('sin llave en el servidor: no llama a nada', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', '');
    expect(await buscarConClaude(entrada)).toMatchObject({ estado: 'error', motivo: 'sin_llave' });
  });

  it('confirma con fuentes: queda "pendiente" para el admin, con tokens y búsquedas contadas', async () => {
    const c = cliente({
      stop_reason: 'end_turn', usage: uso,
      content: [resultadoBusqueda, texto('Según el catálogo', [{ type: 'web_search_result_location', url: 'https://gm.com/19210736', title: 'GM' }]), texto(JSON_SI)],
    });
    const r = await buscarConClaude(entrada, { cliente: c });
    expect(r).toMatchObject({
      estado: 'pendiente', equivalentes: true, confianza: 'alta', partesRelacionadas: ['12615418'],
      fuentes: [{ url: 'https://gm.com/19210736', titulo: 'GM' }], tokensEntrada: 1000, tokensSalida: 200, busquedas: 2,
    });
    const pedido = c.create.mock.calls[0][0];
    expect(pedido.model).toBe(MODELO_IA);
    expect(pedido.tools[0]).toMatchObject({ type: 'web_search_20260209', max_uses: 5 });
    expect(pedido.messages[0].content).toContain('12605843');
  });

  it('dice que sí pero sin ninguna fuente: no se acepta', async () => {
    const c = cliente({ stop_reason: 'end_turn', usage: uso, content: [texto(JSON_SI)] });
    expect((await buscarConClaude(entrada, { cliente: c })).estado).toBe('sin_resultado');
  });

  it('no lo pudo confirmar: "sin_resultado"; sin citas usa los resultados de la búsqueda', async () => {
    const c = cliente({ stop_reason: 'end_turn', usage: uso, content: [resultadoBusqueda, texto('{"equivalentes": null, "confianza": "baja", "resumen": "No encontré nada claro."}')] });
    const r = await buscarConClaude(entrada, { cliente: c });
    expect(r).toMatchObject({ estado: 'sin_resultado', equivalentes: null, fuentes: [{ url: 'https://ejemplo.com/e69', titulo: 'GM E69' }] });
  });

  it('búsqueda larga (pause_turn): continúa y suma el uso de las dos vueltas', async () => {
    const c = cliente(
      { stop_reason: 'pause_turn', usage: uso, content: [resultadoBusqueda] },
      { stop_reason: 'end_turn', usage: uso, content: [texto(JSON_SI)] },
    );
    const r = await buscarConClaude(entrada, { cliente: c });
    expect(c.create).toHaveBeenCalledTimes(2);
    expect(c.create.mock.calls[1][0].messages[1]).toMatchObject({ role: 'assistant' });
    expect(r).toMatchObject({ estado: 'pendiente', tokensEntrada: 2000, busquedas: 4 });
  });

  it('se niega o falla la llamada: "error", nunca lanza', async () => {
    expect((await buscarConClaude(entrada, { cliente: cliente({ stop_reason: 'refusal', usage: uso, content: [] }) })).estado).toBe('error');
    const roto = { beta: { messages: { create: vi.fn().mockRejectedValue(new Error('500')) } } };
    expect(await buscarConClaude(entrada, { cliente: roto })).toMatchObject({ estado: 'error', motivo: 'api' });
  });
});
