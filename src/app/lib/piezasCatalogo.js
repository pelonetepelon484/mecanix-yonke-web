// Catálogo de nombres de piezas — fuente única compartida entre el matcher del buscador
// (extraerIntencion.js), el selector de búsqueda avanzada (HomeClient.js) y los formularios de
// inventario (panel/inventario/page.js, admin/yonke/[id]/inventario/page.js, y el selector de
// piezas sueltas). Antes existían 3 copias casi idénticas y desincronizadas — cambiar aquí
// alcanza a todo el sitio de una sola vez.

// Piezas que se crean SOLAS en cada vehículo nuevo al registrarlo (crearPiezasComunes): 52
// escrituras por vehículo, y el buscador y el subdominio leen todas en cada vehículo que coincide.
// Agregar aquí sube esas lecturas y escrituras; las piezas nuevas van en PIEZAS_SOLO_CATALOGO.
export const PIEZAS_POR_VEHICULO = [
  'Faro delantero izquierdo', 'Faro delantero derecho', 'Calavera trasera izquierda', 'Calavera trasera derecha',
  'Cofre', 'Cajuela', 'Parachoques delantero', 'Parachoques trasero', 'Espejo izquierdo', 'Espejo derecho',
  'Puerta delantera izquierda', 'Puerta delantera derecha', 'Puerta trasera izquierda', 'Puerta trasera derecha',
  'Parabrisas', 'Rines', 'Tablero', 'Asientos', 'Orquilla derecha', 'Orquilla izquierda',
  'Disco de freno delantero', 'Disco de freno trasero', 'Prensa de freno', 'Amortiguador delantero izquierdo',
  'Amortiguador delantero derecho', 'Resortes delanteros', 'Resortes traseros', 'Amortiguador trasero derecho',
  'Amortiguador trasero izquierdo', 'Compresor A/C', 'Alternador', 'Computadora de motor',
  'Computadora de transmisión', 'Caja de fusibles', 'Cremallera', 'Bomba de dirección', 'Barra estabilizadora',
  'Múltiple de admisión', 'Múltiple de escape', 'Garganta', 'Filtro de aire', 'Manguera de aire', 'Sensor MAF',
  'Flecha delantera izquierda', 'Flecha delantera derecha', 'Motor', 'Transmisión', 'Pistón', 'Arranque',
  // Mangueta/muñón de dirección (spindle) — alta rotación; sinónimos en lib/busqueda/sinonimosPiezas.js.
  'Mango/muñón de dirección',
  // Eléctricas pedidas por los yonkeros (sinónimos en lib/busqueda/sinonimosPiezas.js). TCM, ECM/ECU
  // y caja de fusibles ya existían arriba como "Computadora de transmisión", "Computadora de motor"
  // y "Caja de fusibles": a esas solo se les agregaron sinónimos.
  'Módulo BCM', 'Bobinas de encendido',
];

// Piezas que el buscador reconoce y que se pueden registrar como pieza suelta, pero que NO se
// crean solas en cada vehículo (decisión del 8 de octubre de 2026, para no subir las lecturas y
// escrituras de cada vehículo de 52 a 69). Si alguien busca una de estas, los vehículos que
// coinciden salen como "vehículo completo, pregunta por la pieza". "Cuerpo de aceleración" no
// está aquí: ya existía arriba como "Garganta" (solo se le agregaron sinónimos).
export const PIEZAS_SOLO_CATALOGO = [
  'Módulo ABS', 'Módulo de bolsas de aire', 'Bolsas de aire',
  'Sensores de oxígeno', 'Sensor de cigüeñal', 'Sensor de árbol de levas',
  'Radiador', 'Condensador de A/C', 'Electroventilador',
  'Bomba de gasolina', 'Inyectores', 'Motor de limpiaparabrisas', 'Elevador de vidrio',
  'Estéreo', 'Switch de encendido', 'Catalizador', 'Mofle',
];

// Todo el catálogo: lo que reconoce el buscador y lo que se muestra en la búsqueda avanzada.
export const PIEZAS_CATALOGO = [...PIEZAS_POR_VEHICULO, ...PIEZAS_SOLO_CATALOGO];

// Piezas sueltas (yonkes/{id}/piezasSueltas): Motor y Transmisión ya tienen su propio flujo
// dedicado (yonkes/{id}/motores, con marca/modelo/año/cilindrada) — se excluyen aquí para no
// duplicar esa función con un formulario más simple que no captura cilindrada.
export const PIEZAS_CATALOGO_SUELTAS = PIEZAS_CATALOGO.filter(
  (p) => p !== 'Motor' && p !== 'Transmisión'
);
