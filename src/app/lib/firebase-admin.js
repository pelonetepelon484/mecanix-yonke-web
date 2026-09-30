import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

// Server-only: nunca importar desde un componente 'use client' ni desde código que corra en el
// navegador. El Admin SDK ignora TODAS las reglas de seguridad de Firestore/Storage, así que solo
// debe usarse en rutas de servidor (route.js) que validen ellas mismas lo que hace falta.
//
// Credenciales: FIREBASE_SERVICE_ACCOUNT_KEY debe contener el JSON completo de una cuenta de
// servicio (Firebase Console > Configuración del proyecto > Cuentas de servicio > Generar nueva
// clave privada), como una sola línea. NUNCA se commitea — va en .env.local (dev) y en las
// variables de entorno de Vercel (producción). Sin esta variable, getAdminDb()/getAdminAuth()
// devuelven null y el llamador debe degradarse sin romper nada (ver /api/demanda-yonke).
export { FieldValue };

let app = null;

function obtenerApp() {
  if (app) return app;
  if (getApps().length) { app = getApps()[0]; return app; }
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (!raw) return null;
  try {
    const credenciales = JSON.parse(raw);
    app = initializeApp({ credential: cert(credenciales) });
    return app;
  } catch (error) {
    console.error('[firebase-admin] FIREBASE_SERVICE_ACCOUNT_KEY inválida (¿JSON mal formado?)', error?.message);
    return null;
  }
}

// null si no hay credenciales configuradas — el llamador debe manejarlo sin lanzar.
export function getAdminDb() {
  const instancia = obtenerApp();
  return instancia ? getFirestore(instancia) : null;
}

// Verificación de tokens de Firebase Auth del lado servidor (ej. /api/demanda-yonke: confirmar
// quién llama antes de decidir qué estado geográfico consultar). null si no hay credenciales.
export function getAdminAuth() {
  const instancia = obtenerApp();
  return instancia ? getAuth(instancia) : null;
}
