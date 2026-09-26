import { createHmac } from 'node:crypto';

// ID de documento para el contador de rate limit (busqueda_rate_limit): HMAC-SHA256 de la IP con
// una sal secreta, truncado, + el minuto. La IP en claro ya no se guarda en Firestore; con sal
// secreta un hash de IPv4 no se puede revertir por fuerza bruta (con un hash simple, sí: solo hay
// ~4 mil millones de IPv4). Solo servidor (usa node:crypto).
//
// RATE_LIMIT_SALT debe definirse en las variables de entorno de Vercel. Sin ella se usa una sal
// fija de respaldo (el rate limit sigue funcionando, pero el hash es menos resistente).
const SAL_RESPALDO = 'mecanix-rate-limit-v1';

export function idContadorRateLimit(ip: string, minutoBucket: number, sal: string = process.env.RATE_LIMIT_SALT || SAL_RESPALDO): string {
  const hash = createHmac('sha256', sal).update(ip || 'unknown').digest('hex').slice(0, 32);
  return `${hash}_${minutoBucket}`;
}
