import {
  RESULTADOS_POR_PAGINA, buscarEnIndice, numIndices, ordenarCoincidencias, piezaDeCoincidencia, prepararConsulta, ubicacionEnBloques,
} from '../../lib/buscadorRefacciones';

// Buscador "Piezas nuevas" (etapa 4): busca en los índices de las refaccionarias visibles (activas
// y con prueba o pago vigente), ordena (mejor coincidencia y, en empate, precio más bajo) y solo
// lee los bloques de los resultados de la página pedida. Las lecturas llegan inyectadas (con caché,
// ver refaccionariaPublica.js), así se prueba sin Firestore.
// lecturas: { activas(), indice('id/n'), bloque('id/n'), visible(r, ahora) }
export async function buscarPiezasNuevas({ texto, estado = 'todos', pagina = 1 }, lecturas, ahora = new Date()) {
  const vacio = { resultados: [], total: 0, pagina, hayMas: false };
  const consulta = prepararConsulta(texto);
  if (!consulta) return vacio;

  const refaccionarias = (await lecturas.activas())
    .filter((r) => lecturas.visible(r, ahora) && (estado === 'todos' || r.estado === estado));
  const porRefaccionaria = await Promise.all(refaccionarias.map(async (r) => {
    const indices = await Promise.all(Array.from({ length: numIndices(r.totalPiezas) }, (_, n) => lecturas.indice(`${r.id}/${n}`)));
    return indices.flatMap((entradas) => buscarEnIndice(entradas, consulta).map((c) => ({ ...c, refaccionariaId: r.id, r })));
  }));
  const coincidencias = ordenarCoincidencias(porRefaccionaria.flat());

  const desde = (pagina - 1) * RESULTADOS_POR_PAGINA;
  const deLaPagina = coincidencias.slice(desde, desde + RESULTADOS_POR_PAGINA);
  const resultados = (await Promise.all(deLaPagina.map(async (c) => {
    const pieza = piezaDeCoincidencia(await lecturas.bloque(`${c.r.id}/${ubicacionEnBloques(c.posicion).bloque}`), c);
    if (!pieza) return null;
    const { id, nombre, ciudad, whatsapp, slug, verificado } = c.r;
    return { refaccionaria: { id, nombre, ciudad, whatsapp, slug, verificado }, pieza, nivel: c.nivel };
  }))).filter(Boolean);

  return { resultados, total: coincidencias.length, pagina, hayMas: desde + RESULTADOS_POR_PAGINA < coincidencias.length };
}
