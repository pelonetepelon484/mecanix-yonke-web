'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { useAuth } from './AuthContext';
import { escucharConfigSolicitudesPiezas, escucharSolicitudesAbiertas, escucharYonkeEstadoActivo } from './solicitudesPiezasDatos';
import {
  escucharConfigPedidosClientes, escucharPedidosClientesAbiertos, escucharPedidosClientesOtrosEstados,
} from './pedidosClientesDatos';
import { puedeVerOtrosEstados } from '../../lib/pedidosClientes';

// Contador del botón "Pedidos" del menú de abajo (BottomNav): solicitudes de piezas de talleres
// abiertas del estado del yonke + alertas de clientes de su estado + (con el interruptor y la
// segunda bandera) alertas de otros estados que aceptan envío.
//
// Vive UNA vez en el layout del panel (PanelLayoutCliente), que no se vuelve a montar al cambiar
// de pantalla: sus conexiones duran toda la sesión. Las banderas (config/solicitudesPiezas,
// config/pedidosClientes) y la ficha del yonke se escuchan en vivo, así que si cambian, el
// contador se corrige solo. Mismas reglas de siempre: sin bandera encendida no se lee nada más
// de esa función; un yonke inactivo o sin estado no cuenta nada; admin y taller no abren nada.
//
// Cierre de sesión y cambio de cuenta: todo depende de `sesion` (uid + yonkeId de un rol
// 'yonke'). Al cambiar, React cierra primero las conexiones de la sesión anterior y el contador
// vuelve a 0; cada conexión ignora lo que le llegue después de cerrarse (bandera `vigente`).
const ConteoPedidosContext = createContext(0);

// Escucha con `escuchar(cb)` mientras `activo`; deja el último valor (o `inicial`) en el estado.
function useEnVivo(activo, escuchar, deps, inicial = null) {
  const [valor, setValor] = useState(inicial);
  useEffect(() => {
    if (!activo) return undefined;
    let vigente = true;
    const dejar = escuchar((v) => { if (vigente) setValor(v); });
    // Al cerrar (cierre de sesión, cambio de cuenta o de estado): se corta la conexión, se ignora
    // lo que llegue tarde y se vuelve al valor inicial.
    return () => { vigente = false; if (typeof dejar === 'function') dejar(); setValor(inicial); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activo, ...deps]);
  return valor;
}

export function ConteoPedidosProvider({ children }) {
  const { user, userRole, yonkeId } = useAuth();
  const sesion = user && userRole === 'yonke' && yonkeId ? `${user.uid}:${yonkeId}` : null;

  // Banderas: una conexión cada una por sesión.
  const configSolicitudes = useEnVivo(sesion !== null, escucharConfigSolicitudesPiezas, [sesion]);
  const configPedidos = useEnVivo(sesion !== null, escucharConfigPedidosClientes, [sesion]);
  const solicitudesOn = configSolicitudes?.habilitado === true;
  const pedidosOn = configPedidos?.habilitado === true;

  // Ficha del yonke: solo si alguna de las dos funciones está encendida.
  const yonke = useEnVivo(sesion !== null && (solicitudesOn || pedidosOn), (cb) => escucharYonkeEstadoActivo(yonkeId, cb), [sesion]);
  const estado = yonke?.activo === true && yonke.estado ? yonke.estado : null;
  const conOtros = pedidosOn && estado !== null && puedeVerOtrosEstados(configPedidos, yonke) && yonke.verAlertasOtrosEstados === true;

  // Listas: se vuelven a conectar solo si cambia lo que de verdad las define (no por cualquier
  // cambio de la ficha, como la marca de actividad).
  const solicitudes = useEnVivo(solicitudesOn && estado !== null, (cb) => escucharSolicitudesAbiertas(estado, (l) => cb(l.length)), [sesion, estado], 0);
  const propias = useEnVivo(pedidosOn && estado !== null, (cb) => escucharPedidosClientesAbiertos(estado, (l) => cb(l.length)), [sesion, estado], 0);
  const otras = useEnVivo(conOtros, (cb) => escucharPedidosClientesOtrosEstados((l) => cb(l.filter((p) => p.estado !== estado).length)), [sesion, estado], 0);

  const conteo = sesion === null ? 0 : solicitudes + propias + otras;
  return <ConteoPedidosContext.Provider value={conteo}>{children}</ConteoPedidosContext.Provider>;
}

// Número para el globo de "Pedidos". Sin el proveedor montado, 0 (nunca un número equivocado).
export const useConteoPedidos = () => useContext(ConteoPedidosContext);
