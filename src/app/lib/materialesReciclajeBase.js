// Catálogo base de materiales reciclables — mismo espíritu que piezasCatalogo.js: el yonke no
// tiene que dar de alta cada material a mano, solo ponerle precio. Se siembra UNA sola vez por
// yonke (ver sembrarMaterialesBase en panel/reciclaje/page.js) si su subcolección
// materialesReciclaje todavía está vacía — después el yonke administra su propia lista
// (agregar, editar precio, eliminar) sin que este archivo la vuelva a tocar.
export const MATERIALES_RECICLAJE_BASE = [
  'Aluminio', 'Cobre', 'Bronce', 'Latón', 'Fierro/Chatarra', 'Acero inoxidable', 'Plomo',
  'Radiador de aluminio', 'Radiador de cobre', 'Cable con forro', 'Cable pelado', 'Batería',
  'PET', 'Cartón',
];
