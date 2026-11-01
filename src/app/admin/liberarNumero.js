'use client';

import { auth } from '../lib/firebase';

// Libera el WhatsApp de una cuenta interna antes de borrar su yonke: el servidor borra la huella y
// la cuenta. Devuelve qué quedó hecho; nunca lanza, para no frenar el borrado en cascada.
export async function liberarNumero(usuarioId) {
  try {
    const token = await auth.currentUser?.getIdToken();
    const res = await fetch('/api/admin/liberar-numero', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ usuarioId }),
    });
    const datos = await res.json().catch(() => null);
    return { huella: datos?.huella === true, cuenta: datos?.cuenta === true };
  } catch (error) {
    console.error(error);
    return { huella: false, cuenta: false };
  }
}
