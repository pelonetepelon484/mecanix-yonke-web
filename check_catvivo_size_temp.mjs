import { dbServer } from './src/app/lib/firebase-server.js';
import { doc, getDoc } from 'firebase/firestore';

const snap = await getDoc(doc(dbServer, 'config', 'catalogoVehiculos'));
const data = snap.data();
const catalogo = data.catalogo || {};
const marcas = Object.keys(catalogo);
let totalModelos = 0;
marcas.forEach(m => totalModelos += catalogo[m].length);
console.log('Marcas en catálogo vivo:', marcas.length);
console.log('Total modelos:', totalModelos);
console.log('Tamaño aproximado JSON (bytes):', JSON.stringify(data).length);
console.log('actualizado:', data.actualizado?.toDate?.() || data.actualizado);
process.exit(0);
