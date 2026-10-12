'use client';

// Avisos en el dispositivo (notificaciones push) del lado del panel del yonke. Solo Android por
// ahora. El token del dispositivo se guarda en dispositivosPush/{yonkeId}_{sha256 del token}
// (las reglas de Firestore dejan crearlo, leerlo y borrarlo solo al dueño del yonke).
import { getApps } from 'firebase/app';
import { deleteToken, getMessaging, getToken } from 'firebase/messaging';
import { deleteDoc, doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

export const RUTA_SW = '/panel/avisos-sw.js';
const ALCANCE_SW = '/panel/';
const VAPID = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY || '';

// ¿Este navegador puede recibir avisos? Android con Chrome (o similar), en https, con service
// worker y push. iPhone y computadoras: por ahora no se ofrece.
export function navegadorCompatible(w = typeof window === 'undefined' ? undefined : window) {
  if (!w || !VAPID) return false;
  return w.isSecureContext === true
    && 'serviceWorker' in w.navigator && 'PushManager' in w && 'Notification' in w
    && /Android/i.test(w.navigator.userAgent || '');
}

// Interruptor de la función: sin config/notificaciones, o con habilitado != true, no se ofrece nada.
export async function avisosHabilitados() {
  try {
    const snap = await getDoc(doc(db, 'config', 'notificaciones'));
    return snap.exists() && snap.data().habilitado === true;
  } catch {
    return false;
  }
}

const clave = (yonkeId) => `mecanix-avisos:${yonkeId}`;
export function dispositivoGuardado(yonkeId) {
  try { return window.localStorage.getItem(clave(yonkeId)); } catch { return null; }
}
function recordar(yonkeId, docId) {
  try {
    if (docId) window.localStorage.setItem(clave(yonkeId), docId);
    else window.localStorage.removeItem(clave(yonkeId));
  } catch { /* sin almacenamiento local: solo se pierde el recordatorio */ }
}

export async function huellaToken(token) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function esperarActivo(registro) {
  const trabajador = registro.installing || registro.waiting;
  if (!trabajador || registro.active) return Promise.resolve(registro);
  return new Promise((resolver) => {
    trabajador.addEventListener('statechange', () => { if (trabajador.state === 'activated') resolver(registro); });
  });
}

// Pide el permiso y, si lo acepta, guarda el token de este dispositivo ligado a su yonke.
// Devuelve { ok: true } o { ok: false, motivo: 'denegado' | 'sinRespuesta' }. Otros errores lanzan.
export async function activarAvisos(yonkeId) {
  const permiso = await Notification.requestPermission();
  if (permiso !== 'granted') return { ok: false, motivo: permiso === 'denied' ? 'denegado' : 'sinRespuesta' };
  const registro = await esperarActivo(await navigator.serviceWorker.register(RUTA_SW, { scope: ALCANCE_SW }));
  const token = await getToken(getMessaging(getApps()[0]), { vapidKey: VAPID, serviceWorkerRegistration: registro });
  const docId = `${yonkeId}_${await huellaToken(token)}`;
  await setDoc(doc(db, 'dispositivosPush', docId), { yonkeId, token, creadoAt: serverTimestamp() });
  recordar(yonkeId, docId);
  return { ok: true };
}

// Apaga los avisos en este dispositivo: borra su token de Firestore (y del navegador).
export async function apagarAvisos(yonkeId) {
  const docId = dispositivoGuardado(yonkeId);
  if (docId) await deleteDoc(doc(db, 'dispositivosPush', docId));
  recordar(yonkeId, null);
  try { await deleteToken(getMessaging(getApps()[0])); } catch { /* ya no había token */ }
}

// Si el yonke quitó el permiso desde los ajustes del navegador, se borra el token guardado.
// Devuelve si los avisos siguen activos en este dispositivo.
export async function revisarDispositivo(yonkeId) {
  if (!dispositivoGuardado(yonkeId)) return false;
  if (Notification.permission === 'granted') return true;
  try { await apagarAvisos(yonkeId); } catch { /* se reintenta la próxima vez */ }
  return false;
}
