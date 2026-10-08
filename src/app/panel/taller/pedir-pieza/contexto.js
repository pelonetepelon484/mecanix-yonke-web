'use client';

import { createContext, useContext } from 'react';

// Estado compartido de las pantallas de "pedir una pieza" (lo llena pedir-pieza/layout.js).
export const PedirPiezaContext = createContext(null);
export const usePedirPieza = () => useContext(PedirPiezaContext);
