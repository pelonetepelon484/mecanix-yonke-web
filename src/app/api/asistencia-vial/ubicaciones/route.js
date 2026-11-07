import { NextResponse } from 'next/server';
import { collection, getDocs } from 'firebase/firestore';
import { dbServer } from '../../../lib/firebase-server';
import { leerConfigPortada } from '../../../../lib/configPortada';
import { COLECCION_UBICACIONES, ubicacionVigente } from '../../../../lib/ubicacionAsistencia';

// Ubicaciones vigentes para el mapa de /asistencia-vial. Una sola lectura de la colección y la
// respuesta se guarda 2 minutos en la red de Vercel: muchas visitas = pocas lecturas de Firestore
// (el mapa puede ir hasta ~2 minutos atrasado). Sin las banderas: lista vacía.
export const dynamic = 'force-dynamic';

const CACHE = 'public, s-maxage=120, stale-while-revalidate=60';

export async function GET() {
  const { asistenciaVialActiva, asistenciaVialMapa } = await leerConfigPortada(dbServer);
  if (!asistenciaVialActiva || !asistenciaVialMapa) {
    return NextResponse.json({ ubicaciones: [] }, { headers: { 'Cache-Control': CACHE } });
  }
  try {
    const ahora = Date.now();
    const snap = await getDocs(collection(dbServer, COLECCION_UBICACIONES));
    const ubicaciones = snap.docs
      .map((d) => ({ proveedorId: d.id, ...d.data() }))
      .filter((u) => ubicacionVigente(u, ahora))
      .map((u) => ({
        proveedorId: u.proveedorId, lat: u.lat, lng: u.lng, hastaAt: u.hastaAt.toMillis(), actualizadoAt: u.actualizadoAt?.toMillis?.() ?? null,
      }));
    return NextResponse.json({ ubicaciones }, { headers: { 'Cache-Control': CACHE } });
  } catch (error) {
    console.warn('[asistencia-vial/ubicaciones] No se pudieron leer.', error?.code || error?.message);
    return NextResponse.json({ ubicaciones: [] }, { headers: { 'Cache-Control': 'no-store' } });
  }
}
