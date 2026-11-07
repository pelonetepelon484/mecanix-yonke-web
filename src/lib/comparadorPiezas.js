// Comparador de compatibilidad de piezas (config/comparador, ver configComparador.js). Lógica pura,
// la usan el servidor (api/comparador) y las pantallas. REGLA ESTRICTA: solo datos reales. Un campo
// vacío es "Sin datos"; nada se adivina y el porcentaje sale solo de los campos que sí se compararon.
//
// Privacidad: del VIN solo se usa la parte que describe el modelo (posiciones 1 a 8, 10 y 11). El
// número de serie (posiciones 12 a 17) nunca se manda a NHTSA ni se guarda. La posición 9 (dígito
// verificador) depende del número de serie, así que va como comodín "*".

export const AVISO_COMPARADOR = 'Resultado orientativo. Confirma siempre la compatibilidad con el yonke o el taller antes de comprar.';
export const TEXTO_BOTON_COMPARADOR = 'Comparar número de serie o número de parte';
export const SIN_DATOS = 'Sin datos';

export const TIPOS_PIEZA = [
  { key: 'motor', label: 'Motor' },
  { key: 'transmision', label: 'Transmisión' },
  { key: 'suspension', label: 'Suspensión' },
  { key: 'computadora', label: 'Computadora de motor' },
  { key: 'frenos', label: 'Discos de freno' },
];
export const etiquetaTipoPieza = (key) => TIPOS_PIEZA.find((t) => t.key === key)?.label ?? key;

// ---------- VIN ----------
// 17 caracteres, letras y números sin I, O ni Q (las excluye el estándar).
export const normalizarVin = (v) => (typeof v === 'string' ? v.toUpperCase().replace(/[\s-]/g, '') : '');
export const vinValido = (v) => /^[A-HJ-NPR-Z0-9]{17}$/.test(v);

// Lo que se manda a NHTSA y la llave del caché: "1HGCM826*3A" (sin número de serie).
export function claveVin(vin) {
  const v = normalizarVin(vin);
  if (!vinValido(v)) return null;
  return `${v.slice(0, 8)}*${v.slice(9, 11)}`;
}
export const claveVinValida = (c) => typeof c === 'string' && /^[A-HJ-NPR-Z0-9]{8}\*[A-HJ-NPR-Z0-9]{2}$/.test(c);

// ---------- Número de parte ----------
// Mayúsculas, sin espacios, guiones, puntos ni diagonales. Máximo 40.
export const normalizarParte = (p) => (typeof p === 'string' ? p.toUpperCase().replace(/[\s\-./_]/g, '').slice(0, 40) : '');
export const parteValida = (p) => /^[A-Z0-9]{3,40}$/.test(p);

// ---------- Datos del vehículo (NHTSA vPIC, DecodeVinValues) ----------
// Campo nuestro -> campo de vPIC. Se muestran tal cual los regresa vPIC (en inglés).
export const CAMPOS_VEHICULO = [
  { key: 'marca', label: 'Marca', vpic: 'Make' },
  { key: 'modelo', label: 'Modelo', vpic: 'Model' },
  { key: 'anio', label: 'Año', vpic: 'ModelYear' },
  { key: 'motor', label: 'Motor', vpic: 'EngineModel' },
  { key: 'cilindrada', label: 'Cilindrada (L)', vpic: 'DisplacementL' },
  { key: 'cilindros', label: 'Cilindros', vpic: 'EngineCylinders' },
  { key: 'combustible', label: 'Combustible', vpic: 'FuelTypePrimary' },
  { key: 'transmision', label: 'Transmisión', vpic: 'TransmissionStyle' },
  { key: 'traccion', label: 'Tracción', vpic: 'DriveType' },
  { key: 'carroceria', label: 'Carrocería', vpic: 'BodyClass' },
  { key: 'pais', label: 'País de fabricación', vpic: 'PlantCountry' },
  { key: 'planta', label: 'Planta', vpic: 'PlantCity' },
];

const VACIOS = new Set(['', 'NOT APPLICABLE', 'N/A', 'NULL', '0']);
const textoReal = (v) => {
  if (v === null || v === undefined) return '';
  const t = String(v).trim().slice(0, 80);
  return VACIOS.has(t.toUpperCase()) ? '' : t;
};

// Fila de vPIC -> { marca, modelo, ... } con '' donde no hay dato; sinDatos si no trae ni marca ni año.
export function vehiculoDesdeVpic(fila) {
  const datos = {};
  for (const c of CAMPOS_VEHICULO) datos[c.key] = textoReal(fila?.[c.vpic]);
  // La cilindrada viene como "1.79742..." : se redondea a un decimal para mostrar y comparar.
  const cc = Number(datos.cilindrada);
  datos.cilindrada = datos.cilindrada && Number.isFinite(cc) && cc > 0 ? cc.toFixed(1) : '';
  if (datos.anio && !/^(19|20)\d{2}$/.test(datos.anio)) datos.anio = '';
  if (datos.cilindros && !/^\d{1,2}$/.test(datos.cilindros)) datos.cilindros = '';
  return { ...datos, sinDatos: !datos.marca && !datos.anio };
}

// ---------- Comparación campo por campo ----------
export const ESTADO_CAMPO = { coincide: 'coincide', difiere: 'difiere', sinDatos: 'sin_datos' };
const ANIOS_CERCANOS = 3; // "año cercano" para motor: hasta 3 años de diferencia.

const igual = (a, b) => a.trim().toLowerCase() === b.trim().toLowerCase();

function estadoDe(key, a, b) {
  if (!a || !b) return ESTADO_CAMPO.sinDatos;
  if (key === 'cilindrada') return Math.abs(Number(a) - Number(b)) < 0.05 ? ESTADO_CAMPO.coincide : ESTADO_CAMPO.difiere;
  return igual(a, b) ? ESTADO_CAMPO.coincide : ESTADO_CAMPO.difiere;
}

// [{ key, label, a, b, estado }] + resumen { comparados, coinciden, porcentaje } (porcentaje null si
// no se comparó ningún campo).
export function compararVehiculos(va, vb) {
  const filas = CAMPOS_VEHICULO.map((c) => {
    const a = va && !va.sinDatos ? va[c.key] || '' : '';
    const b = vb && !vb.sinDatos ? vb[c.key] || '' : '';
    return { key: c.key, label: c.label, a, b, estado: estadoDe(c.key, a, b) };
  });
  const comparados = filas.filter((f) => f.estado !== ESTADO_CAMPO.sinDatos).length;
  const coinciden = filas.filter((f) => f.estado === ESTADO_CAMPO.coincide).length;
  return { filas, comparados, coinciden, porcentaje: comparados > 0 ? Math.round((coinciden / comparados) * 100) : null };
}

// ---------- Resultado por tipo de pieza ----------
export const RESULTADOS = {
  compatible: { key: 'compatible', titulo: 'Compatible', desc: 'El número de parte es idéntico.' },
  registros: { key: 'registros', titulo: 'Compatible según registros de Mecanix', desc: 'Los números de parte son distintos, pero están registrados como equivalentes.' },
  probable: { key: 'probable', titulo: 'Probable, confirmar con el yonke', desc: 'No hay número de parte para comparar, pero los datos de los VIN coinciden en lo que importa para esta pieza.' },
  noCompatible: { key: 'no_compatible', titulo: 'No compatible', desc: 'Hay una diferencia clara entre los dos vehículos.' },
  indeterminado: { key: 'indeterminado', titulo: 'No se puede determinar', desc: 'No hay datos suficientes para dar un resultado.' },
};

export const NOTA_PROGRAMACION = 'Compatible en número de parte, puede requerir programación o verificación.';
export const NOTA_VERIFICAR_PARTE = 'Verificar con número de parte: con esta pieza el VIN nunca basta.';
export const NOTA_PARTES_DISTINTAS = 'Los números de parte son distintos y no hay una equivalencia registrada.';

// Qué campos del VIN deben coincidir según la pieza. "anioCercano": años a menos de 3 de diferencia;
// "anioIgual": el mismo año modelo (la generación no viene en los datos del VIN, y el mismo año
// modelo es lo único que asegura la misma generación).
const REGLAS_VIN = {
  motor: { requeridos: ['cilindrada', 'cilindros'], opcionales: ['combustible'], anio: 'cercano' },
  transmision: { requeridos: ['transmision', 'traccion', 'cilindrada', 'cilindros'], opcionales: [], anio: null },
  suspension: { requeridos: ['marca', 'modelo', 'traccion'], opcionales: [], anio: 'igual' },
};
const SOLO_PARTE = new Set(['computadora', 'frenos']);

function porVin(tipo, va, vb) {
  const regla = REGLAS_VIN[tipo];
  if (!regla || !va || !vb || va.sinDatos || vb.sinDatos) return { resultado: RESULTADOS.indeterminado, motivos: ['Sin datos de VIN de uno o los dos vehículos.'] };
  const etiqueta = (k) => CAMPOS_VEHICULO.find((c) => c.key === k).label;
  const motivos = [];
  let falta = false;
  let difiere = false;
  for (const k of [...regla.requeridos, ...regla.opcionales]) {
    const e = estadoDe(k, va[k] || '', vb[k] || '');
    if (e === ESTADO_CAMPO.difiere) { difiere = true; motivos.push(`${etiqueta(k)} distinta: ${va[k]} contra ${vb[k]}.`); }
    if (e === ESTADO_CAMPO.sinDatos && regla.requeridos.includes(k)) { falta = true; motivos.push(`${etiqueta(k)}: sin datos.`); }
  }
  if (regla.anio) {
    if (!va.anio || !vb.anio) { falta = true; motivos.push('Año: sin datos.'); } else {
      const dif = Math.abs(Number(va.anio) - Number(vb.anio));
      if (regla.anio === 'cercano' && dif > ANIOS_CERCANOS) { difiere = true; motivos.push(`Años muy distintos: ${va.anio} contra ${vb.anio}.`); }
      if (regla.anio === 'igual' && dif !== 0) { falta = true; motivos.push(`Años distintos (${va.anio} y ${vb.anio}): el VIN no dice la generación.`); }
    }
  }
  if (difiere) return { resultado: RESULTADOS.noCompatible, motivos };
  if (falta) return { resultado: RESULTADOS.indeterminado, motivos };
  return { resultado: RESULTADOS.probable, motivos: ['Los datos de los VIN coinciden en lo que importa para esta pieza.'] };
}

// entrada: { tipo, parteA, parteB } (ya normalizados), vehiculoA/B de vehiculoDesdeVpic (o null),
// registros: { equivalentes: bool, aplicacion: bool } leídos de equivalenciasPiezas.
// Devuelve { resultado, nota, motivos }.
export function resultadoPorPieza({ tipo, parteA = '', parteB = '' }, vehiculoA, vehiculoB, registros = {}) {
  const soloParte = SOLO_PARTE.has(tipo);
  const conNota = (resultado, motivos) => ({ resultado, nota: soloParte ? NOTA_PROGRAMACION : null, motivos });
  if (parteA && parteB && parteA === parteB) return conNota(RESULTADOS.compatible, [`Mismo número de parte: ${parteA}.`]);
  if (parteA && parteB && registros.equivalentes) return conNota(RESULTADOS.registros, [`${parteA} y ${parteB} están registrados como equivalentes.`]);
  if (registros.aplicacion) return conNota(RESULTADOS.registros, ['El número de parte está registrado para el otro vehículo.']);
  if (soloParte) {
    return {
      resultado: RESULTADOS.indeterminado,
      nota: parteA && parteB ? NOTA_PARTES_DISTINTAS : NOTA_VERIFICAR_PARTE,
      motivos: [],
    };
  }
  const vin = porVin(tipo, vehiculoA, vehiculoB);
  return { ...vin, nota: parteA && parteB ? NOTA_PARTES_DISTINTAS : null };
}

// ---------- Entrada del formulario ----------
export const MENSAJES_COMPARADOR = {
  vinA: 'El VIN del vehículo A debe tener 17 letras y números (sin I, O ni Q).',
  vinB: 'El VIN del vehículo B debe tener 17 letras y números (sin I, O ni Q).',
  parte: 'El número de parte debe tener al menos 3 letras o números.',
  tipo: 'Escoge el tipo de pieza.',
  nada: 'Escribe los dos VIN, los dos números de parte, o un número de parte y el VIN del otro vehículo.',
  limite: 'Llegaste al límite de consultas de hoy. Vuelve mañana o, si tienes taller o yonke, crea tu cuenta (actualmente sin costo) y compara más.',
  limiteCuenta: 'Llegaste al límite de consultas de hoy con tu cuenta. Vuelve mañana.',
  login: 'Para usar el comparador, inicia sesión con tu cuenta de yonke o de taller.',
  noDisponible: 'El comparador no está disponible en este momento.',
  fallo: 'No pudimos comparar en este momento. Intenta de nuevo en unos minutos.',
};

// { ok, datos: { tipo, vinA, vinB, parteA, parteB } } o { ok: false, mensaje }.
export function validarEntrada(f = {}) {
  const tipo = TIPOS_PIEZA.some((t) => t.key === f.tipo) ? f.tipo : '';
  const vinA = normalizarVin(f.vinA);
  const vinB = normalizarVin(f.vinB);
  const parteA = normalizarParte(f.parteA);
  const parteB = normalizarParte(f.parteB);
  if (!tipo) return { ok: false, mensaje: MENSAJES_COMPARADOR.tipo };
  if (vinA && !vinValido(vinA)) return { ok: false, mensaje: MENSAJES_COMPARADOR.vinA };
  if (vinB && !vinValido(vinB)) return { ok: false, mensaje: MENSAJES_COMPARADOR.vinB };
  if ((parteA && !parteValida(parteA)) || (parteB && !parteValida(parteB))) return { ok: false, mensaje: MENSAJES_COMPARADOR.parte };
  const ladoA = vinA || parteA;
  const ladoB = vinB || parteB;
  if (!ladoA || !ladoB) return { ok: false, mensaje: MENSAJES_COMPARADOR.nada };
  return { ok: true, datos: { tipo, vinA, vinB, parteA, parteB } };
}

// Para mostrar el VIN en pantalla: el número de serie (últimos 6) queda oculto.
export const vinParaMostrar = (vin) => (vinValido(vin) ? `${vin.slice(0, 11)}••••••` : '');
