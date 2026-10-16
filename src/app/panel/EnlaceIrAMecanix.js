'use client';

// "← Ir a Mecanix" arriba del panel (yonke, taller y admin), para volver a la portada sin cerrar
// sesión. Solo con config/portada.botonPanel encendido y con sesión iniciada; se lee una vez por
// carga, después de saber que hay sesión (un visitante en la pantalla de acceso no lee nada).
// No aparece en el acceso ni en los registros.
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { db } from '../lib/firebase';
import { leerConfigPortada } from '../../lib/configPortada';
import { useAuth } from './AuthContext';

const RUTAS_SIN_ENLACE = ['/panel', '/panel/registro', '/panel/taller/registro'];

export default function EnlaceIrAMecanix() {
  const { user, loading } = useAuth();
  const pathname = usePathname();
  const [activo, setActivo] = useState(false);

  useEffect(() => {
    if (loading || !user) return undefined;
    let cancelado = false;
    leerConfigPortada(db).then(({ botonPanel }) => { if (!cancelado) setActivo(botonPanel); });
    return () => { cancelado = true; };
  }, [user, loading]);

  if (!activo || !user || RUTAS_SIN_ENLACE.includes(pathname)) return null;
  return (
    <div style={barra}>
      <Link href="/" style={enlace}>← Ir a Mecanix</Link>
    </div>
  );
}

const barra = { backgroundColor: '#13304B', padding: '6px 16px' };
const enlace = { color: '#cdd9e4', fontSize: '12px', fontWeight: '600', textDecoration: 'none' };
