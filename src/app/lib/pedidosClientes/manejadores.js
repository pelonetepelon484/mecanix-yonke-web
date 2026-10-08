import { NextResponse } from 'next/server';
import {
  MAX_AVISOS_ADMIN_HORA, MAX_CONSULTAS_POR_IP_MINUTO, MAX_PEDIDOS_ABIERTOS_LISTA, MAX_PEDIDOS_POR_IP_HORA, MAX_PEDIDOS_POR_WHATSAPP_DIA,
  MENSAJES_PEDIDO, calcularExpiraAtPedido, enlaceMiPedido, esCodigo, esIdPedido, estaVencido, mensajeAvisoAdmin, normalizarWhatsapp,
  ordenarRespuestas, pedidoPublico, respuestaParaCliente, validarPedidoCliente,
} from '../../../lib/pedidosClientes';

// Lógica de las rutas /api/pedir-pieza, /api/mi-pedido/[id] y /api/pedidos-abiertos.
// Todo lo que toca Firestore, el reloj, el azar y el aviso al admin llega en `deps` (las reales
// están en servicio.js): así las pruebas corren sin Firestore. Falla cerrada: sin identidad de
// servicio, sin config/pedidosClientes.habilitado == true, o si un contador de límite falla,
// la respuesta es "no disponible" / "límite" y no se escribe nada.

const MINUTO = 60 * 1000;
const HORA = 60 * MINUTO;
const DIA = 24 * HORA;

function json(cuerpo, status = 200) {
  return NextResponse.json(cuerpo, { status, headers: { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' } });
}
const noDisponible = () => json({ ok: false, disponible: false, mensaje: MENSAJES_PEDIDO.noDisponible }, 503);
const noEncontrado = () => json({ ok: false, mensaje: MENSAJES_PEDIDO.noEncontrado }, 404);

function obtenerIp(request) {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return request.headers.get('x-real-ip') || 'unknown';
}

const texto = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

// Límite de consultas en memoria (por instancia del servidor): protege la cuota de Firestore de
// /mi-pedido y /pedidos-abiertos sin gastar una escritura por consulta. El código del enlace
// tiene 256 bits, así que adivinarlo no es viable aunque este límite no sea global.
export function crearLimiteEnMemoria() {
  const cuentas = new Map();
  // La clave ya termina en "_<ventana>" (claveLimite): al cambiar de ventana se tiran las viejas.
  return (clave, max, ventana) => {
    for (const k of cuentas.keys()) if (!k.endsWith(`_${ventana}`)) cuentas.delete(k);
    const n = (cuentas.get(clave) || 0) + 1;
    cuentas.set(clave, n);
    return n <= max;
  };
}

export function crearManejadores(deps) {
  const limiteEnMemoria = deps.limiteEnMemoria ?? crearLimiteEnMemoria();

  async function prepararDb() {
    try {
      const db = await deps.obtenerDb();
      if (!db) return null;
      return (await deps.habilitado(db)) ? db : null;
    } catch (error) {
      console.error('[pedidosClientes] No se pudo preparar la conexión de servicio', { message: error?.message });
      return null;
    }
  }

  // Contador en Firestore (pedidosClientesLimite). Si falla, se NIEGA (falla cerrada).
  async function dentroDeLimite(db, tipo, valor, max, ventanaMs) {
    const ventana = Math.floor(deps.ahora().getTime() / ventanaMs);
    try {
      return await deps.contar(db, deps.claveLimite(tipo, valor, ventana), max, ventanaMs);
    } catch (error) {
      console.error('[pedidosClientes] Falló el contador de límite', { tipo, code: error?.code, message: error?.message });
      return false;
    }
  }

  function consultaPermitida(request) {
    const ventana = Math.floor(deps.ahora().getTime() / MINUTO);
    return limiteEnMemoria(deps.claveLimite('lectura', obtenerIp(request), ventana), MAX_CONSULTAS_POR_IP_MINUTO, ventana);
  }

  async function nombreDeEstado(id) {
    const estados = await deps.estados();
    return estados.find((e) => e.id === id)?.nombre || id;
  }

  // POST /api/pedir-pieza
  async function pedirPieza(request) {
    const db = await prepararDb();
    if (!db) return noDisponible();

    let body;
    try {
      body = await request.json();
    } catch {
      return json({ ok: false, mensaje: MENSAJES_PEDIDO.solicitudInvalida }, 400);
    }

    if (!(await dentroDeLimite(db, 'ip', obtenerIp(request), MAX_PEDIDOS_POR_IP_HORA, HORA))) {
      return json({ ok: false, mensaje: MENSAJES_PEDIDO.limiteIp }, 429);
    }

    const datos = {
      vehiculo: {
        marca: texto(body?.vehiculo?.marca, 200),
        modelo: texto(body?.vehiculo?.modelo, 200),
        anio: Number.isInteger(body?.vehiculo?.anio) ? body.vehiculo.anio : Number.NaN,
      },
      pieza: texto(body?.pieza, 200),
      estado: texto(body?.estado, 100),
      whatsapp: texto(body?.whatsapp, 40),
    };
    const estados = await deps.estados();
    const problema = validarPedidoCliente(datos, estados.map((e) => e.id));
    if (problema) return json({ ok: false, mensaje: problema }, 400);

    const whatsapp = normalizarWhatsapp(datos.whatsapp);
    if (!(await dentroDeLimite(db, 'wa', whatsapp, MAX_PEDIDOS_POR_WHATSAPP_DIA, DIA))) {
      return json({ ok: false, mensaje: MENSAJES_PEDIDO.limiteWhatsapp }, 429);
    }

    const codigo = deps.generarCodigo();
    const expiraAt = calcularExpiraAtPedido(deps.ahora());
    let id;
    try {
      id = await deps.crearPedido(db, {
        pedido: { vehiculo: datos.vehiculo, pieza: datos.pieza, estado: datos.estado, expiraAt },
        privado: { clienteWhatsapp: whatsapp, codigoHash: deps.hashCodigo(codigo), expiraAt },
      });
    } catch (error) {
      console.error('[pedidosClientes] No se pudo crear el pedido', { code: error?.code, message: error?.message });
      return json({ ok: false, mensaje: MENSAJES_PEDIDO.guardarFallo }, 500);
    }

    // Aviso al admin con tope por hora, para no saturar su WhatsApp. Nunca tumba la respuesta.
    if (await dentroDeLimite(db, 'aviso', 'admin', MAX_AVISOS_ADMIN_HORA, HORA)) {
      const estadoNombre = estados.find((e) => e.id === datos.estado)?.nombre || datos.estado;
      try {
        await deps.notificar(mensajeAvisoAdmin(datos, estadoNombre));
      } catch (error) {
        console.error('[pedidosClientes] No se pudo avisar al admin', { message: error?.message });
      }
    }

    return json({ ok: true, id, enlace: enlaceMiPedido(new URL(request.url).origin, id, codigo) });
  }

  // GET /api/mi-pedido/{id}?c={codigo} -- solo con el código correcto. Cualquier falla de id o
  // código responde igual ("no encontrado"), para no revelar si el pedido existe.
  async function miPedido(request, id) {
    const db = await prepararDb();
    if (!db) return noDisponible();
    if (!consultaPermitida(request)) return json({ ok: false, mensaje: MENSAJES_PEDIDO.limiteConsultas }, 429);

    const codigo = new URL(request.url).searchParams.get('c');
    if (!esIdPedido(id) || !esCodigo(codigo)) return noEncontrado();
    try {
      const privado = await deps.leerPrivado(db, id);
      if (!privado || !deps.codigoCoincide(codigo, privado.codigoHash)) return noEncontrado();
      const pedido = await deps.leerPedido(db, id);
      if (!pedido) return noEncontrado();
      const respuestas = await deps.leerRespuestas(db, id);
      const yonkes = await deps.leerYonkes(db, [...new Set(respuestas.map((r) => r.yonkeId))]);
      return json({
        ok: true,
        pedido: {
          ...pedidoPublico(id, pedido),
          estadoNombre: await nombreDeEstado(pedido.estado),
          estadoPedido: pedido.estadoPedido,
          vence: pedido.expiraAt?.toDate ? pedido.expiraAt.toDate().toISOString() : null,
          vencido: estaVencido(pedido.expiraAt, deps.ahora()),
        },
        respuestas: ordenarRespuestas(respuestas.map((r) => respuestaParaCliente(r, yonkes[r.yonkeId]))),
      });
    } catch (error) {
      console.error('[pedidosClientes] No se pudo leer el pedido', { code: error?.code, message: error?.message });
      return json({ ok: false, mensaje: MENSAJES_PEDIDO.noDisponible }, 500);
    }
  }

  // GET /api/pedidos-abiertos?estado={id}  -> lista pública (vehículo, pieza, estado y fecha)
  // GET /api/pedidos-abiertos?pedido={id}  -> un pedido abierto (para el registro y el panel)
  async function pedidosAbiertos(request) {
    const db = await prepararDb();
    if (!db) return noDisponible();
    if (!consultaPermitida(request)) return json({ ok: false, mensaje: MENSAJES_PEDIDO.limiteConsultas }, 429);

    const params = new URL(request.url).searchParams;
    try {
      const idPedido = params.get('pedido');
      if (idPedido !== null) {
        if (!esIdPedido(idPedido)) return noEncontrado();
        const d = await deps.leerPedido(db, idPedido);
        if (!d || d.estadoPedido !== 'abierta' || estaVencido(d.expiraAt, deps.ahora())) return noEncontrado();
        return json({ ok: true, pedido: { ...pedidoPublico(idPedido, d), estadoNombre: await nombreDeEstado(d.estado) } });
      }

      const estado = params.get('estado') || '';
      const estados = await deps.estados();
      const encontrado = estados.find((e) => e.id === estado);
      if (!encontrado) return json({ ok: false, mensaje: MENSAJES_PEDIDO.estado }, 400);
      const lista = await deps.listarAbiertos(db, estado, MAX_PEDIDOS_ABIERTOS_LISTA);
      const ahora = deps.ahora();
      return json({
        ok: true,
        pedidos: lista
          .filter((p) => p.estadoPedido === 'abierta' && !estaVencido(p.expiraAt, ahora))
          .slice(0, MAX_PEDIDOS_ABIERTOS_LISTA)
          .map((p) => ({ ...pedidoPublico(p.id, p), estadoNombre: encontrado.nombre })),
      });
    } catch (error) {
      console.error('[pedidosClientes] No se pudieron leer los pedidos abiertos', { code: error?.code, message: error?.message });
      return json({ ok: false, mensaje: MENSAJES_PEDIDO.noDisponible }, 500);
    }
  }

  return { pedirPieza, miPedido, pedidosAbiertos };
}
