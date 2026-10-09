'use client';

import VisorFotos from './VisorFotos';
import { SLOTS_FOTO_VEHICULO } from './vehiculoFotosStorage';

const ETIQUETAS_SLOT = {
  frontal: 'Frontal', trasera: 'Trasera', derecha: 'Lateral derecho', izquierda: 'Lateral izquierdo',
};

// Visor de las fotos de un vehículo (hasta 4, una por lado). Mismo visor genérico que motores y
// piezas sueltas (VisorFotos.js); aquí solo se ordenan los lados y se les pone su nombre.
export default function VisorFotosVehiculo({ fotos, nombreVehiculo, slotInicial, onClose }) {
  const conFoto = SLOTS_FOTO_VEHICULO.filter((slot) => fotos?.[slot]?.url);
  const items = conFoto.map((slot) => ({ url: fotos[slot].url, etiqueta: ETIQUETAS_SLOT[slot] }));
  return (
    <VisorFotos
      items={items}
      titulo={nombreVehiculo}
      indiceInicial={Math.max(0, conFoto.indexOf(slotInicial))}
      onClose={onClose}
    />
  );
}
