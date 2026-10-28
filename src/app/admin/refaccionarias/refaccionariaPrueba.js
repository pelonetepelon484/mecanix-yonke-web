import { collection, doc, getDocs, serverTimestamp, Timestamp, writeBatch } from 'firebase/firestore';
import { HORARIO_INICIAL, finPruebaDesde } from '../../../lib/refaccionarias';
import { armarIndices } from '../../../lib/buscadorRefacciones';

// Refaccionaria de PRUEBA para revisar la página pública (etapa 3): id fijo, esPrueba: true y 20
// piezas ficticias en un bloque, con su índice del buscador "Piezas nuevas" (etapa 4). La crea y la
// borra el admin desde admin/refaccionarias (las reglas solo dejan al admin crear con esPrueba: true).
// Crear: 1 lote de 3 escrituras. Borrar: lee sus bloques, su índice y sus contadores y los borra
// junto con la refaccionaria en un lote.
export const ID_REFACCIONARIA_PRUEBA = 'prueba-mecanix';
export const SLUG_REFACCIONARIA_PRUEBA = 'refaccionaria-de-prueba-mecanix';

const p = (numeroParte, descripcion, marca, tipo, precio, incluyeIva = true) => ({
  numeroParte, numeroParteNorm: numeroParte.replace(/[^A-Za-z0-9]/g, '').toUpperCase(), descripcion, marca, tipo, precio, incluyeIva,
});
export const PIEZAS_PRUEBA = [
  p('DEMO-0001', 'Balatas delanteras cerámicas (PRUEBA)', 'Marca Demo A', 'marca', 650),
  p('DEMO-0002', 'Balatas traseras (PRUEBA)', 'Genérica', 'generica', 420),
  p('DEMO-0003', 'Filtro de aceite (PRUEBA)', 'Marca Demo B', 'marca', 145),
  p('DEMO-0004', 'Filtro de aire de motor (PRUEBA)', 'Genérica', 'generica', 189),
  p('DEMO-0005', 'Filtro de cabina (PRUEBA)', 'Genérica', 'generica', 210),
  p('DEMO-0006', 'Bujía de iridio (PRUEBA)', 'Marca Demo C', 'marca', 235),
  p('DEMO-0007', 'Bomba de agua (PRUEBA)', 'Marca Demo A', 'marca', 1450),
  p('DEMO-0008', 'Termostato con carcasa (PRUEBA)', 'Genérica', 'generica', 520),
  p('DEMO-0009', 'Banda de distribución (PRUEBA)', 'Marca Demo B', 'marca', 980),
  p('DEMO-0010', 'Tensor de banda (PRUEBA)', 'Genérica', 'generica', 640),
  p('DEMO-0011', 'Amortiguador delantero (PRUEBA)', 'Marca Demo C', 'marca', 1320, false),
  p('DEMO-0012', 'Amortiguador trasero (PRUEBA)', 'Genérica', 'generica', 890, false),
  p('DEMO-0013', 'Rótula inferior (PRUEBA)', 'Genérica', 'generica', 410),
  p('DEMO-0014', 'Terminal de dirección (PRUEBA)', 'Marca Demo A', 'marca', 365),
  p('DEMO-0015', 'Disco de freno delantero (PRUEBA)', 'Marca Demo B', 'marca', 780),
  p('DEMO-0016', 'Sensor de oxígeno (PRUEBA)', 'Marca Demo C', 'marca', 1150, false),
  p('DEMO-0017', 'Bobina de encendido (PRUEBA)', 'Genérica', 'generica', 690),
  p('DEMO-0018', 'Foco delantero H4 (PRUEBA)', 'Genérica', 'generica', 95),
  p('DEMO-0019', 'Plumas limpiaparabrisas par (PRUEBA)', 'Marca Demo A', 'marca', 260),
  p('DEMO-0020', 'Anticongelante 1 galón (PRUEBA)', 'Genérica', 'generica', 175),
];

// adminUid: queda como ownerUid (no hay dueño real). WhatsApp: el de contacto de Mecanix.
export async function crearRefaccionariaPrueba(db, adminUid) {
  const lote = writeBatch(db);
  lote.set(doc(db, 'refaccionarias', ID_REFACCIONARIA_PRUEBA), {
    nombre: 'Refaccionaria de Prueba Mecanix',
    whatsapp: '6611034260',
    estado: 'baja-california',
    ciudad: 'Tijuana',
    logoUrl: '',
    zonaEntrega: { descripcion: 'Entregas de prueba en la zona centro', municipios: ['Tijuana'] },
    horario: HORARIO_INICIAL,
    slug: SLUG_REFACCIONARIA_PRUEBA,
    ownerUid: adminUid,
    activo: true,
    pruebaHasta: Timestamp.fromDate(new Date(`${finPruebaDesde()}T00:00:00`)),
    creadoAt: serverTimestamp(),
    aceptacionVersion: '',
    totalPiezas: PIEZAS_PRUEBA.length,
    numBloques: 1,
    inventarioActualizadoAt: serverTimestamp(),
    esPrueba: true,
  });
  lote.set(doc(db, 'refaccionarias', ID_REFACCIONARIA_PRUEBA, 'bloques', '0'), { piezas: PIEZAS_PRUEBA });
  lote.set(doc(db, 'refaccionarias', ID_REFACCIONARIA_PRUEBA, 'busqueda', '0'), { entradas: armarIndices(PIEZAS_PRUEBA)[0] });
  await lote.commit();
}

export async function borrarRefaccionariaPrueba(db) {
  const base = ['refaccionarias', ID_REFACCIONARIA_PRUEBA];
  const [bloques, indices, contactos] = await Promise.all([
    getDocs(collection(db, ...base, 'bloques')),
    getDocs(collection(db, ...base, 'busqueda')),
    getDocs(collection(db, ...base, 'contactos')),
  ]);
  const lote = writeBatch(db);
  [...bloques.docs, ...indices.docs, ...contactos.docs].forEach((d) => lote.delete(d.ref));
  lote.delete(doc(db, ...base));
  await lote.commit();
}
