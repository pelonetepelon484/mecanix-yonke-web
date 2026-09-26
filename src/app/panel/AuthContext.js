'use client';

import { createContext, useContext, useEffect, useState } from 'react';
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
  const [yonkePlan, setYonkePlan] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const docRef = doc(db, 'usuarios', firebaseUser.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          setUserRole(data.rol);
          setYonkeId(data.yonkeId || null);

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
        }
        setUser(firebaseUser);
      } else {
        setUser(null);
        setUserRole(null);
        setYonkeId(null);
        setYonkePlan(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  return (
    <AuthContext.Provider value={{ user, userRole, yonkeId, yonkePlan, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);