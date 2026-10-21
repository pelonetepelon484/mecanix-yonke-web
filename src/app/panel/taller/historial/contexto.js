'use client';

import { createContext, useContext } from 'react';

// Estado compartido de las pantallas del historial (lo llena historial/layout.js).
// puedeEscribir = agregar servicios: términos vigentes, taller activo y Premium vigente.
// Ver y borrar vehículos: siempre (el dueño borra aunque tenga términos viejos o sin Premium).
export const HistorialContext = createContext(null);
export const useHistorial = () => useContext(HistorialContext);
