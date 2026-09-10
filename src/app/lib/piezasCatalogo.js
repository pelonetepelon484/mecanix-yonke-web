// Catálogo de nombres de piezas — fuente única compartida entre el matcher del buscador
// (extraerIntencion.js), el selector de búsqueda avanzada (HomeClient.js) y los formularios de
// inventario (panel/inventario/page.js, admin/yonke/[id]/inventario/page.js, y el selector de
// piezas sueltas). Antes existían 3 copias casi idénticas y desincronizadas — cambiar aquí
// alcanza a todo el sitio de una sola vez.
export const PIEZAS_CATALOGO = [
  'Faro delantero izquierdo', 'Faro delantero derecho', 'Calavera trasera izquierda', 'Calavera trasera derecha',
  'Cofre', 'Cajuela', 'Parachoques delantero', 'Parachoques trasero', 'Espejo izquierdo', 'Espejo derecho',
  'Puerta delantera izquierda', 'Puerta delantera derecha', 'Puerta trasera izquierda', 'Puerta trasera derecha',
  'Parabrisas', 'Rines', 'Tablero', 'Asientos', 'Orquilla derecha', 'Orquilla izquierda',
  'Disco de freno delantero', 'Disco de freno trasero', 'Prensa de freno', 'Amortiguador delantero izquierdo',
  'Amortiguador delantero derecho', 'Resortes delanteros', 'Resortes traseros', 'Amortiguador trasero derecho',
  'Amortiguador trasero izquierdo', 'Compresor A/C', 'Alternador', 'Computadora de motor',
  'Computadora de transmisión', 'Caja de fusibles', 'Cremallera', 'Bomba de dirección', 'Barra estabilizadora',
  'Múltiple de admisión', 'Múltiple de escape', 'Garganta', 'Filtro de aire', 'Manguera de aire', 'Sensor MAF',
  'Flecha delantera izquierda', 'Flecha delantera derecha', 'Motor', 'Transmisión', 'Pistón',
];

// Piezas sueltas (yonkes/{id}/piezasSueltas): Motor y Transmisión ya tienen su propio flujo
// dedicado (yonkes/{id}/motores, con marca/modelo/año/cilindrada) — se excluyen aquí para no
// duplicar esa función con un formulario más simple que no captura cilindrada.
export const PIEZAS_CATALOGO_SUELTAS = PIEZAS_CATALOGO.filter(
  (p) => p !== 'Motor' && p !== 'Transmisión'
);
