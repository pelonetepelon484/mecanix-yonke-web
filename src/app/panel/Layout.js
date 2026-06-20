'use client';

import { AuthProvider } from './AuthContext';

export default function PanelLayout({ children }) {
  return (
    <AuthProvider>
      {children}
    </AuthProvider>
  );
}