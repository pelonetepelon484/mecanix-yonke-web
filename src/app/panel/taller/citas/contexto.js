'use client';

import { createContext, useContext } from 'react';

// Estado compartido de las pantallas de citas (lo llena citas/layout.js).
// puedeEscribir = agendar, editar y cambiar estado: términos vigentes, taller activo y, si
// config/citas.requierePremium, Premium vigente. Ver, escribir por WhatsApp y borrar: siempre.
export const CitasContext = createContext(null);
export const useCitas = () => useContext(CitasContext);
