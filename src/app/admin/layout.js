'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AuthProvider, useAuth } from '../panel/AuthContext';

function AdminGuard({ children }) {
  const { user, userRole, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && (!user || userRole !== 'admin')) {
      router.push('/panel');
    }
  }, [user, userRole, loading]);

  if (loading) {
    return (
      <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#1A3C5E' }}>
        <p style={{ color: '#fff', fontSize: '16px' }}>Cargando...</p>
      </main>
    );
  }

  if (!user || userRole !== 'admin') return null;

  return <>{children}</>;
}

export default function AdminLayout({ children }) {
  return (
    <AuthProvider>
      <AdminGuard>{children}</AdminGuard>
    </AuthProvider>
  );
}