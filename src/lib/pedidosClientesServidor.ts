import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

// Solo servidor (usa node:crypto). Código del enlace del cliente y claves de los contadores de límite.

// Código del enlace /mi-pedido: 32 bytes al azar en base64url (43 caracteres). Nunca se guarda:
// en Firestore solo queda su SHA-256 (privado/contacto.codigoHash).
export function generarCodigo(): string {
  return randomBytes(32).toString('base64url');
}

export function hashCodigo(codigo: string): string {
  return createHash('sha256').update(codigo).digest('hex');
}

// Compara en tiempo constante el hash del código recibido con el guardado.
export function codigoCoincide(codigo: string, hashGuardado: unknown): boolean {
  if (typeof hashGuardado !== 'string' || !/^[0-9a-f]{64}$/.test(hashGuardado)) return false;
  return timingSafeEqual(Buffer.from(hashCodigo(codigo), 'hex'), Buffer.from(hashGuardado, 'hex'));
}

// Misma sal que el límite del buscador (RATE_LIMIT_SALT, ver rateLimitId.ts). Con sal secreta,
// ni la IP ni el WhatsApp se pueden recuperar del ID del contador.
const SAL_RESPALDO = 'mecanix-pedidos-clientes-v1';

// ID del contador: "<tipo>_<hmac>_<ventana>". tipo: ip | wa | lectura | aviso.
export function claveLimite(tipo: string, valor: string, ventana: number, sal: string = process.env.RATE_LIMIT_SALT || SAL_RESPALDO): string {
  const hash = createHmac('sha256', sal).update(`${tipo}:${valor || 'unknown'}`).digest('hex').slice(0, 32);
  return `${tipo}_${hash}_${ventana}`;
}
