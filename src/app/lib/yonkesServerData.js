import { collection, getDocs, query, where } from 'firebase/firestore';
import { dbServer } from './firebase-server';
import { CIUDADES_BC } from './ciudades';

export async function getRatingParaYonke(yonkeId) {
  const q = query(collection(dbServer, 'calificaciones'), where('yonkeId', '==', yonkeId));
  const snap = await getDocs(q);
  if (snap.empty) return { promedio: null, total: 0 };
  let suma = 0;
  snap.forEach((doc) => { suma += doc.data().estrellas || 0; });
  const total = snap.size;
  const promedio = (suma / total).toFixed(1);
  return { promedio, total };
}

function toYonkePublico(doc) {
  const d = doc.data();
  return {
    id: doc.id,
    nombre: d.nombre || '',
    direccion: d.direccion || '',
    telefono: d.telefono || '',
    whatsapp: d.whatsapp || d.telefono || '',
    ciudad: d.ciudad || '',
    plan: d.plan || 'freemium',
    metodosPago: d.metodosPago || [],
    horario: d.horario || null,
  };
}

// Usado por [ciudad]/page.js. Yonkes activos de una ciudad, con calificación, premium primero.
export async function getYonkesPorCiudad(ciudadKey) {
  const snap = await getDocs(collection(dbServer, 'yonkes'));
  const activos = snap.docs
    .filter((doc) => {
      const d = doc.data();
      return d.activo === true && d.ciudad === ciudadKey;
    })
    .map(toYonkePublico);

  const conRating = await Promise.all(
    activos.map(async (y) => ({ ...y, calificacion: await getRatingParaYonke(y.id) }))
  );

  return conRating.sort((a, b) => {
    if (a.plan === 'premium' && b.plan !== 'premium') return -1;
    if (a.plan !== 'premium' && b.plan === 'premium') return 1;
    return a.nombre.localeCompare(b.nombre, 'es');
  });
}

// Usado por generateStaticParams: ciudades con al menos un yonke activo, para pre-generar en build.
export async function getCiudadesConYonkesActivos() {
  const snap = await getDocs(collection(dbServer, 'yonkes'));
  const ciudades = new Set();
  snap.docs.forEach((doc) => {
    const d = doc.data();
    if (d.activo === true && d.ciudad) ciudades.add(d.ciudad);
  });
  return [...ciudades];
}

// Usado por la página índice /yonkes: conteo de yonkes activos por ciudad (0 si no hay).
export async function getConteoYonkesPorCiudad() {
  const snap = await getDocs(collection(dbServer, 'yonkes'));
  const conteo = {};
  CIUDADES_BC.forEach((c) => { conteo[c.key] = 0; });
  snap.docs.forEach((doc) => {
    const d = doc.data();
    if (d.activo === true && d.ciudad && conteo[d.ciudad] !== undefined) {
      conteo[d.ciudad] += 1;
    }
  });
  return conteo;
}
