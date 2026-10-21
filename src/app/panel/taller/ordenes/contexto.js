'use client';

import { createContext, useContext } from 'react';

// Estado compartido de las pantallas de órdenes (lo llena ordenes/layout.js).
// puedeEditar = crear y editar: versión de términos vigente, taller activo y, con
//   config/ordenes.requierePremium, Premium vigente. Sin eso, la pantalla es de solo lectura.
// puedeBorrar = eliminar y quitar datos del cliente: términos vigentes y taller activo (NO pide
//   Premium: con el Premium vencido el taller sigue pudiendo borrar).
export const OrdenesContext = createContext(null);
export const useOrdenes = () => useContext(OrdenesContext);
