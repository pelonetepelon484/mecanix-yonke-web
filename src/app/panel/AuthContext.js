'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { debeRegistrarActividad } from '../../lib/inventoryStatus';
import { registrarActividadYonke } from '../../lib/registrarActividadYonke';

const AuthContext = createContext({});

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [yonkeId, setYonkeId] = useState(null);
  const [tallerId, setTallerId] = useState(null);
  const [yonkePlan, setYonkePlan] = useState(null);
  const [loading, setLoading] = useState(true);
  // true cuando ya se leyó usuarios/{uid} (con o sin documento). Mientras sea false, el rol
  // todavía no se sabe y no hay que decidir redirecciones por rol.
  const [rolListo, setRolListo] = useState(false);

  // Lee usuarios/{uid} y sus datos derivados. Se puede volver a llamar (recargarRol) cuando el
  // documento se acaba de crear, por ejemplo al terminar un registro. Devuelve el rol leído.
  const cargarUsuario = useCallback(async (firebaseUser) => {
    const docRef = doc(db, 'usuarios', firebaseUser.uid);
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) {
      setUserRole(null);
      setYonkeId(null);
      setTallerId(null);
      setYonkePlan(null);
      setRolListo(true);
      return null;
    }

    const data = docSnap.data();
    setUserRole(data.rol);
    setYonkeId(data.yonkeId || null);
    setTallerId(data.tallerId || null);
    setRolListo(true);

    // Leer el plan del yonke
    if (data.yonkeId) {
      const yonkeRef = doc(db, 'yonkes', data.yonkeId);
      const yonkeSnap = await getDoc(yonkeRef);
      if (yonkeSnap.exists()) {
        setYonkePlan(yonkeSnap.data().plan || 'freemium');
        // ultimaActividadAt: SOLO cuando quien entra es el dueño (rol 'yonke'). Este
        // AuthProvider también envuelve /admin (admin/layout.js), y el admin nunca debe
        // marcar actividad de un yonke. Se decide con el documento que ya se leyó arriba
        // (cero lecturas extra) y solo si pasaron más de 12 h; falla en silencio.
        if (data.rol === 'yonke' && debeRegistrarActividad(yonkeSnap.data().ultimaActividadAt)) {
          registrarActividadYonke(db, data.yonkeId);
        }
      } else {
        setYonkePlan('freemium');
      }
    } else {
      setYonkePlan(null);
    }
    return data.rol;
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        await cargarUsuario(firebaseUser);
        setUser(firebaseUser);
      } else {
        setUser(null);
        setUserRole(null);
        setYonkeId(null);
        setTallerId(null);
        setYonkePlan(null);
        setRolListo(false);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, [cargarUsuario]);

  // Vuelve a leer el rol de la sesión actual. Úsalo justo después de crear usuarios/{uid}.
  const recargarRol = useCallback(async () => {
    if (!auth.currentUser) return null;
    return cargarUsuario(auth.currentUser);
  }, [cargarUsuario]);

  return (
    <AuthContext.Provider value={{ user, userRole, yonkeId, tallerId, yonkePlan, loading, rolListo, recargarRol }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
