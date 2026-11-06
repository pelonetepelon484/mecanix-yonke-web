'use client';

import { createContext, useContext } from 'react';

// Estado compartido de las pantallas de contactos (lo llena contactos/layout.js).
// puedeEscribir = agregar y editar: términos vigentes y taller activo (cualquier plan).
// premium = sin límite de contactos; sin Premium, hasta 25 (lugares c01 ... c25).
// Ver, escribir por WhatsApp y borrar: siempre.
export const ContactosContext = createContext(null);
export const useContactos = () => useContext(ContactosContext);
