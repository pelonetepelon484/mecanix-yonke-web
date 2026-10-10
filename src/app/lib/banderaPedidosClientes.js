'use client';

// Bandera config/pedidosClientes.habilitado, leída UNA vez por carga de página en el navegador
// y compartida por todo lo que la necesita (campo viejo de WhatsApp del buscador y botón
// "Avisar a los yonkes"). Mientras no se sabe, o si la lectura falla, vale false: la página se
// comporta exactamente como antes de esta función.
import { useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from './firebase';

let config = null;

function leerConfig() {
  if (!config) {
    config = getDoc(doc(db, 'config', 'pedidosClientes'))
      .then((snap) => (snap.exists() ? snap.data() : {}))
      .catch(() => ({}));
  }
  return config;
}

export function leerBanderaPedidosClientes() {
  return leerConfig().then((c) => c.habilitado === true);
}

// Segunda bandera (config/pedidosClientes.otrosEstados): casilla "yonkes de otros estados que
// hagan envíos" en el formulario. Mismo documento y misma lectura que la primera; exige las dos.
export function leerBanderaOtrosEstados() {
  return leerConfig().then((c) => c.habilitado === true && c.otrosEstados === true);
}

export function useBanderaPedidosClientes() {
  const [activa, setActiva] = useState(false);
  useEffect(() => {
    let cancelado = false;
    leerBanderaPedidosClientes().then((v) => { if (!cancelado) setActiva(v); });
    return () => { cancelado = true; };
  }, []);
  return activa;
}
