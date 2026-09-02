import { collection, getDocs } from 'firebase/firestore';
import { dbServer } from './lib/firebase-server';
import { obtenerEstadosCombinado, estadoDeYonke, ESTADO_DEFAULT } from './lib/busqueda/estadosServer';
import HomeClient from './HomeClient';

// Misma cadencia que el caché en memoria de estadosServer.js (10 min) — sin esto, Next.js
// generaría esta página como estática en el build y el texto SEO de cobertura quedaría
// congelado con los estados que existían al momento del deploy, sin ver los que David agregue
// después en /admin/estados. Mismo patrón ya usado en /yonkes y /yonkes/[ciudad] (revalidate).
// Esta misma cadencia es la que mantiene barata la lectura completa de "yonkes" de abajo: solo
// corre una vez cada 10 min (o en frío), nunca en cada visita real a la página.
export const revalidate = 600;

// Arma la frase de cobertura dinámica para el bloque SEO del pie, ej.:
// "Con cobertura en Baja California y creciendo en todo el país." (1 estado)
// "Con cobertura en Baja California, Jalisco y creciendo en todo el país." (varios)
// Server-side para que quede en el HTML inicial (SEO real, no depende de JS del cliente).
function construirTextoSeoEstados(estados) {
  const nombres = (estados || []).map((e) => e?.nombre).filter(Boolean);
  if (nombres.length === 0) return '';
  return `Con cobertura en ${nombres.join(', ')} y creciendo en todo el país.`;
}

// Solo cuentan como "con cobertura" los estados que tienen al menos un yonke real registrado
// (estadoDeYonke() aplica la misma regla de compatibilidad de siempre: ausente = Baja
// California) — la colección "estados" puede tener estados de preparación sin ningún yonke
// todavía, y esos no deben prometerse en el SEO. Una sola lectura de "yonkes" (misma colección
// completa que ya lee consultarInventario.js en cada búsqueda), agrupada en memoria — barata,
// y aquí encima solo se ejecuta cada 10 min gracias al revalidate de arriba.
async function obtenerEstadosConCobertura() {
  const [estados, yonkesSnap] = await Promise.all([
    obtenerEstadosCombinado(),
    getDocs(collection(dbServer, 'yonkes')),
  ]);
  const estadosConYonkes = new Set(yonkesSnap.docs.map((d) => estadoDeYonke(d.data())));
  return estados.filter((e) => estadosConYonkes.has(e.id));
}

export default async function Home() {
  let estadosConCobertura;
  try {
    estadosConCobertura = await obtenerEstadosConCobertura();
  } catch (error) {
    // Fail-open: si Firestore falla (yonkes o estados), el mensaje de marca amplio se queda sin
    // la parte de cobertura rota — mínimo Baja California, igual que el resto del sistema.
    console.error('[page] No se pudo calcular estados con cobertura real, usando solo Baja California', {
      code: error?.code,
      message: error?.message,
    });
    estadosConCobertura = [{ id: ESTADO_DEFAULT, nombre: 'Baja California' }];
  }
  const textoSeoEstados = construirTextoSeoEstados(estadosConCobertura);

  return <HomeClient textoSeoEstados={textoSeoEstados} />;
}
