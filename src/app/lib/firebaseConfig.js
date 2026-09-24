// Config de Firebase compartida por los 3 puntos donde se inicializa una app (cliente en
// firebase.js, servidor en firebase-server.js, y la app secundaria aislada de
// crearUsuarioYonke.js) — una sola fuente de verdad para que los tres nunca puedan apuntar a
// proyectos distintos por un typo o un olvido.
//
// TODO(env-split): los valores de "mecanix-yonke-virtual" de abajo son el fallback TEMPORAL
// mientras las variables NEXT_PUBLIC_FIREBASE_* no estén cargadas en Vercel — quitar el
// fallback (dejar solo process.env.NEXT_PUBLIC_FIREBASE_*) una vez que David confirme que ya
// están cargadas en Vercel Production. Ver .env.local.example para la lista completa.
//
// Los valores de un firebaseConfig del SDK cliente de Firebase no son secretos (viajan en el
// bundle del navegador de cualquier forma) — por eso llevan el prefijo NEXT_PUBLIC_, y por eso
// es seguro reusar las mismas variables también del lado servidor (firebase-server.js).
export const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyAuWJajKo8NuJT_SGD4tvvc6jZa6DMDBCQ",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "mecanix-yonke-virtual.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "mecanix-yonke-virtual",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "mecanix-yonke-virtual.firebasestorage.app",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "650815226147",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:650815226147:web:1629984619db0659b00c96",
};
