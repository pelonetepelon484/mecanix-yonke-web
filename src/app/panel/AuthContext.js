'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';

const AuthContext = createContext({});

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [yonkeId, setYonkeId] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
  console.log('AuthContext: montando, escuchando onAuthStateChanged');
  const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
    console.log('AuthContext: onAuthStateChanged disparado, firebaseUser =', firebaseUser);
    if (firebaseUser) {
      const docRef = doc(db, 'usuarios', firebaseUser.uid);
      const docSnap = await getDoc(docRef);
      console.log('AuthContext: documento de usuario existe?', docSnap.exists());
      if (docSnap.exists()) {
        const data = docSnap.data();
        setUserRole(data.rol);
        setYonkeId(data.yonkeId || null);
      }
      setUser(firebaseUser);
    } else {
      console.log('AuthContext: firebaseUser es null, no hay sesión');
      setUser(null);
      setUserRole(null);
      setYonkeId(null);
    }
    setLoading(false);
  });
  return unsubscribe;
}, []);

  return (
    <AuthContext.Provider value={{ user, userRole, yonkeId, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);