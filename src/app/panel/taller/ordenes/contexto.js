'use client';

import { createContext, useContext } from 'react';

// Estado compartido de las pantallas de órdenes (lo llena ordenes/layout.js).
// puedeEditar = versión de términos vigente Y taller activo. Sin eso, la pantalla es de solo lectura.
export const OrdenesContext = createContext(null);
export const useOrdenes = () => useContext(OrdenesContext);
