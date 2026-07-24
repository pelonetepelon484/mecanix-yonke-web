// Listas base para el heurístico "fuera de giro" (detectarFueraDeGiro.js). Funcionan desde
// el día uno sin depender de Firestore; se fusionan por unión con config/palabrasFueraDeGiro
// si ese doc existe (mismo espíritu que CATALOGO_BASE + config/catalogoVehiculos).

export const OTROS_OFICIOS_BASE = [
  'plomero', 'plomeria', 'electricista', 'electricidad', 'cerrajero', 'jardinero',
  'pintor', 'albañil', 'carpintero', 'herrero', 'soldador', 'fontanero',
  'renta de casa', 'renta de departamento', 'se renta', 'en renta', 'departamento en renta',
  'casa en renta', 'abogado', 'contador', 'niñera', 'limpieza del hogar', 'mudanza',
  'vacante', 'empleo', 'trabajo disponible', 'se solicita', 'busco empleo',
];

export const SALUDOS_CORTESIA_BASE = [
  'hola', 'buenas', 'buenos dias', 'buenas tardes', 'buenas noches', 'que tal',
  'como estas', 'como estan', 'gracias', 'de nada', 'saludos', 'buen dia',
  'oye', 'disculpa', 'disculpen', 'perdon', 'quien eres', 'que eres',
];

export const VENTA_VEHICULO_BASE = [
  'vendo', 'se vende', 'en venta', 'busco comprar', 'compro auto', 'compro carro',
  'venta de auto', 'venta de carro', 'vendo mi auto', 'vendo mi carro', 'precio a tratar',
  'a tratar', 'factura original', 'papeles en regla',
];
