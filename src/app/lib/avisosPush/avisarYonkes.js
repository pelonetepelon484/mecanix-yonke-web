// Solo servidor. Avisos en el dispositivo a los yonkes cuando llega una alerta de cliente o un
// pedido de un taller. Lo llaman las mismas rutas que avisan al admin por CallMeBot.
// - Falla cerrada: sin config/notificaciones.habilitado === true, o sin credenciales de FCM, no
//   se manda nada.
// - Destinatarios: yonkes activos del estado del pedido y, solo en alertas de clientes que lo
//   aceptaron, los de otros estados que cumplen Verificado + Envíos nacionales + su interruptor.
//   No depende de los términos ni del plan (los avisos son parte de la sección de pedidos).
// - El texto solo lleva pieza y vehículo: nada del cliente ni del taller.
// - Límite: máximo 10 avisos por yonke por hora (contador pedidosClientesLimite). Si el contador
//   falla, a ese yonke no se le avisa.
// - Si Firebase dice que un token ya no sirve, se borra ese dispositivo.
// - Nunca lanza: si algo falla, la alerta o el pedido ya se crearon y siguen igual.
import { puedeVerOtrosEstados } from '../../../lib/pedidosClientes';

export const MAX_AVISOS_PUSH_YONKE_HORA = 10;
const HORA = 60 * 60 * 1000;
const TIEMPO_MAXIMO_MS = 8000;
const MAX_DESTINATARIOS = 300;

const texto = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

export function textoAviso(tipo, { vehiculo, pieza }) {
  const v = vehiculo ?? {};
  const auto = [texto(v.marca, 60), texto(v.modelo, 60), Number.isInteger(v.anio) ? String(v.anio) : ''].filter(Boolean).join(' ');
  return {
    titulo: tipo === 'alertaCliente' ? 'Nueva alerta de búsqueda' : 'Nuevo pedido de un taller',
    cuerpo: [texto(pieza, 100), auto].filter(Boolean).join(' · '),
  };
}

// Pantalla que abre al tocar el aviso (siempre dentro del panel).
export function urlAviso(tipo, id) {
  return tipo === 'alertaCliente' && /^[A-Za-z0-9]{1,128}$/.test(String(id ?? ''))
    ? `/panel/reservaciones?pedido=${id}`
    : '/panel/reservaciones';
}

// ¿Este yonke de otro estado ve la alerta? Misma regla que el panel y las reglas de Firestore.
export function veAlertaDeOtroEstado(yonke, estadoPedido) {
  return puedeVerOtrosEstados({ habilitado: true, otrosEstados: true }, yonke)
    && yonke.verAlertasOtrosEstados === true
    && typeof yonke.estado === 'string' && yonke.estado !== estadoPedido;
}

function conTiempoLimite(promesa, ms) {
  let reloj;
  const limite = new Promise((resolver) => { reloj = setTimeout(() => resolver({ motivo: 'tiempo' }), ms); });
  return Promise.race([promesa, limite]).finally(() => clearTimeout(reloj));
}

// deps: habilitado(db), cliente() -> { enviar } | null, yonkesDelEstado(db, estado) -> [{ id }],
// yonkesOtrosEstados(db) -> [{ id, estado, activo, verificado, enviosNacionales, verAlertasOtrosEstados }],
// dispositivosDe(db, yonkeIds) -> [{ docId, yonkeId, token }], borrarDispositivo(db, docId),
// contar(db, clave, max, ventanaMs) -> boolean, claveLimite(tipo, valor, ventana), ahora()
export function crearAvisarYonkes(deps) {
  async function avisar(db, evento) {
    if (!db || !(await deps.habilitado(db))) return { enviados: 0, motivo: 'apagado' };
    const cliente = deps.cliente();
    if (!cliente) return { enviados: 0, motivo: 'sinCredenciales' };

    const ids = new Set((await deps.yonkesDelEstado(db, evento.estado)).map((y) => y.id));
    if (evento.tipo === 'alertaCliente' && evento.incluirOtrosEstados === true) {
      for (const y of await deps.yonkesOtrosEstados(db)) if (veAlertaDeOtroEstado(y, evento.estado)) ids.add(y.id);
    }
    if (ids.size === 0) return { enviados: 0, motivo: 'sinYonkes' };

    const porYonke = new Map();
    for (const d of await deps.dispositivosDe(db, [...ids].slice(0, MAX_DESTINATARIOS))) {
      if (!ids.has(d.yonkeId)) continue;
      if (!porYonke.has(d.yonkeId)) porYonke.set(d.yonkeId, []);
      porYonke.get(d.yonkeId).push(d);
    }

    const { titulo, cuerpo } = textoAviso(evento.tipo, evento);
    const datos = {
      titulo, cuerpo,
      url: urlAviso(evento.tipo, evento.id),
      etiqueta: evento.tipo === 'alertaCliente' ? 'mecanix-alertas' : 'mecanix-pedidos-talleres',
    };
    const ventana = Math.floor(deps.ahora().getTime() / HORA);
    let enviados = 0;
    let borrados = 0;
    await Promise.all([...porYonke].map(async ([yonkeId, dispositivos]) => {
      let permitido = false;
      try {
        permitido = await deps.contar(db, deps.claveLimite('avisoPush', yonkeId, ventana), MAX_AVISOS_PUSH_YONKE_HORA, HORA);
      } catch (error) {
        console.error('[avisosPush] Falló el contador de límite', { code: error?.code });
      }
      if (!permitido) return;
      await Promise.all(dispositivos.map(async (d) => {
        const resultado = await cliente.enviar(d.token, datos);
        if (resultado === 'ok') enviados += 1;
        if (resultado === 'invalido') {
          try {
            await deps.borrarDispositivo(db, d.docId);
            borrados += 1;
          } catch (error) {
            console.error('[avisosPush] No se pudo borrar un dispositivo inválido', { code: error?.code });
          }
        }
      }));
    }));
    return { enviados, borrados };
  }

  return async function avisarYonkes(db, evento) {
    try {
      return await conTiempoLimite(avisar(db, evento), TIEMPO_MAXIMO_MS);
    } catch (error) {
      console.error('[avisosPush] No se pudieron mandar los avisos', { message: error?.message });
      return { enviados: 0, motivo: 'error' };
    }
  };
}
