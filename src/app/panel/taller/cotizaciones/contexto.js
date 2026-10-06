'use client';

import { createContext, useContext } from 'react';

// Estado compartido de las pantallas de cotizaciones (lo llena cotizaciones/layout.js).
// puedeEditar = versión de términos vigente Y taller activo. Sin eso, la pantalla es de solo lectura.
export const CotizacionesContext = createContext(null);
export const useCotizaciones = () => useContext(CotizacionesContext);
