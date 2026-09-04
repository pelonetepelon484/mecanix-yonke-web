import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from './firebase';

// Limpia texto a subdominio válido: minúsculas, sin acentos/diacríticos, solo [a-z0-9] — junta
// palabras (sin espacios ni guiones internos). Ej. "Autopartes Pacífico" -> "autopartespacifico".
export function limpiarParaSubdominio(texto) {
  return (texto || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

async function subdominioExiste(candidato) {
  const q = query(collection(db, 'yonkes'), where('subdominio', '==', candidato));
  const snap = await getDocs(q);
  return !snap.empty;
}

// Genera un subdominio único para un yonke (nuevo o migrado):
// 1. nombre limpio ("autopartespacifico").
// 2. si colisiona, + ciudad limpia con guión ("autopartespacifico-hermosillo").
// 3. si aún colisiona, + número al final.
// 4. si el nombre limpio queda vacío (solo símbolos), usa "yonke-" + parte del ID como base.
export async function generarSubdominioUnico(nombre, ciudad, yonkeIdFallback) {
  const idLimpio = limpiarParaSubdominio(yonkeIdFallback).slice(0, 10) || 'x';
  const base = limpiarParaSubdominio(nombre) || `yonke-${idLimpio}`;

  if (!(await subdominioExiste(base))) return base;

  const ciudadLimpia = limpiarParaSubdominio(ciudad);
  const conCiudad = ciudadLimpia ? `${base}-${ciudadLimpia}` : null;
  if (conCiudad && !(await subdominioExiste(conCiudad))) return conCiudad;

  const raizNumerada = conCiudad || base;
  let intento = 2;
  while (await subdominioExiste(`${raizNumerada}-${intento}`)) intento++;
  return `${raizNumerada}-${intento}`;
}
