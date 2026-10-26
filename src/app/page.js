import { cache } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { dbServer } from './lib/firebase-server';
import { obtenerEstadosCombinado, estadoDeYonke, ESTADO_DEFAULT } from './lib/busqueda/estadosServer';
import HomeClient from './HomeClient';
import { textoConteoRedYonkes } from './lib/conteoRedYonkes';
import { leerConfigPortada } from '../lib/configPortada';
import { rangoAniosServer } from './lib/busqueda/configBuscadorServer';

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
// cache(): dedupea la lectura entre generateMetadata() y Home() dentro del mismo request —
// mismo patrón que resolveDemo() en tenant-demo/page.js — para no leer "yonkes" dos veces.
// totalYonkes (todos los registrados) sale de esta misma lectura para la línea de confianza
// del buscador, sin lecturas extra.
const obtenerCobertura = cache(async function obtenerCobertura() {
  const [estados, yonkesSnap] = await Promise.all([
    obtenerEstadosCombinado(),
    getDocs(collection(dbServer, 'yonkes')),
  ]);
  const estadosConYonkes = new Set(yonkesSnap.docs.map((d) => estadoDeYonke(d.data())));
  return { estadosConCobertura: estados.filter((e) => estadosConYonkes.has(e.id)), totalYonkes: yonkesSnap.size };
});

// Nada de "title" aquí a propósito: se deja heredar el default rico en keywords de layout.js.
// Solo se enriquece la description con la cobertura real (dinámica), sin tocar openGraph/
// twitter/robots/keywords, que ya vienen bien desde el layout raíz.
export async function generateMetadata() {
  let estadosConCobertura;
  try {
    ({ estadosConCobertura } = await obtenerCobertura());
  } catch {
    estadosConCobertura = [];
  }
  const textoSeoEstados = construirTextoSeoEstados(estadosConCobertura);
  const description = textoSeoEstados
    ? `Encuentra autopartes y refacciones usadas entre los yonkes y deshuesaderos afiliados en México. ${textoSeoEstados} Busca por marca, modelo y año. Reserva en línea al instante.`
    : undefined; // undefined = hereda la description del layout raíz
  return description ? { description } : {};
}

export default async function Home() {
  let estadosConCobertura;
  // Sin conteo (la lectura falló), la línea "N yonkes registrados en N estados" no se muestra.
  let conteo = null;
  try {
    const cobertura = await obtenerCobertura();
    estadosConCobertura = cobertura.estadosConCobertura;
    conteo = { yonkes: cobertura.totalYonkes, estados: cobertura.estadosConCobertura.length };
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
  // config/portada se lee aquí, en el servidor, con la misma cadencia de 10 min (revalidate):
  // ninguna lectura extra por visitante. Un cambio en la consola tarda hasta 10 min en verse.
  const { botonPanel, ecosistema } = await leerConfigPortada(dbServer);
  // Rango de años de la búsqueda avanzada (config/buscador; null = el de siempre). Misma cadencia.
  const rangoAnios = await rangoAniosServer();

  return <HomeClient textoSeoEstados={textoSeoEstados} textoConteoRed={textoConteoRedYonkes(conteo)} botonPanel={botonPanel} ecosistema={ecosistema} rangoAnios={rangoAnios} />;
}
