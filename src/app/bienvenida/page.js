import { notFound } from 'next/navigation';
import { doc, getDoc } from 'firebase/firestore';
import { dbServer } from '../lib/firebase-server';
import { obtenerEstadosCombinado } from '../lib/busqueda/estadosServer';
import { buscadorRefaccionesEncendido } from '../lib/refaccionariaPublica';
import { leerConfigPortada } from '../../lib/configPortada';
import { leerConfigPlanes } from '../../lib/planes';
import { talleresHabilitados } from '../../lib/talleresHabilitados';
import { leerPromoTalleres } from '../../lib/premiumGratis';
import { IMAGEN_PORTADA } from '../../lib/imagenPortada';
import { SITIO_OFICIAL } from '../../lib/sitioOficial';
import { META_BIENVENIDA } from '../../lib/textosBienvenida';
import BienvenidaClient from './BienvenidaClient';

// /bienvenida: página para mandar por WhatsApp a yonkes y talleres. Detrás de
// config/portada.bienvenida (solo true exacto; apagada o si falla la lectura, 404). Sin índice en
// buscadores y fuera del sitemap. Lee las mismas banderas que la portada para no anunciar nada que
// la portada no anuncie: planes (config/planes), búsquedas activas (config/pedidosClientes),
// estados con captura a domicilio (tieneVisitas), buscador de piezas nuevas y talleres (variable).
// Misma cadencia que la portada: un cambio en la consola tarda hasta 10 min en verse.
export const revalidate = 600;

const url = `${SITIO_OFICIAL}/bienvenida`;

export const metadata = {
  title: { absolute: META_BIENVENIDA.titulo },
  description: META_BIENVENIDA.descripcion,
  alternates: { canonical: '/bienvenida' },
  robots: { index: false, follow: false, googleBot: { index: false, follow: false } },
  openGraph: {
    title: META_BIENVENIDA.titulo, description: META_BIENVENIDA.descripcion, url,
    siteName: 'Mecanix Yonke Virtual', locale: 'es_MX', type: 'website', images: [IMAGEN_PORTADA],
  },
  twitter: { card: 'summary_large_image', title: META_BIENVENIDA.titulo, description: META_BIENVENIDA.descripcion, images: [IMAGEN_PORTADA] },
};

// Un documento de config; si no existe o falla la lectura, {} (todo lo que dependa de él, apagado).
async function leerConfig(nombre) {
  try {
    const snap = await getDoc(doc(dbServer, 'config', nombre));
    return snap.exists() ? snap.data() : {};
  } catch (error) {
    console.warn(`[bienvenida] No se pudo leer config/${nombre}; sus funciones quedan apagadas.`, error?.code || error?.message);
    return {};
  }
}

// Banderas que cambian los pasos y las preguntas. Las de config/pedidosClientes siguen las reglas de
// lib/banderaPedidosClientes.js (todas exigen habilitado); avisos, las de config/notificaciones
// (habilitado); seguimiento, config/ordenes.seguimientoHabilitado. Solo true exacto.
async function banderasPasos() {
  const [c, notificaciones, ordenes] = await Promise.all([leerConfig('pedidosClientes'), leerConfig('notificaciones'), leerConfig('ordenes')]);
  const consultas = c.habilitado === true;
  return {
    consultas, otrosEstados: consultas && c.otrosEstados === true, vehiculosCompletos: consultas && c.inventarioVehiculos === true,
    formularioAbierto: consultas && c.formularioAbierto === true,
    avisos: notificaciones.habilitado === true, seguimiento: ordenes.seguimientoHabilitado === true,
  };
}

export default async function Bienvenida() {
  const { bienvenida } = await leerConfigPortada(dbServer);
  if (!bienvenida) notFound();

  const [planes, banderas, estados, buscadorRefacciones, mesesPromoTaller] = await Promise.all([
    leerConfigPlanes(dbServer), banderasPasos(), obtenerEstadosCombinado(), buscadorRefaccionesEncendido(), leerPromoTalleres(dbServer),
  ]);
  // Captura a domicilio: solo donde hay visitas, igual que la tarjeta de la portada.
  const estadosConVisitas = estados.filter((e) => e.tieneVisitas === true).map((e) => e.nombre).filter(Boolean)
    .sort((a, b) => a.localeCompare(b, 'es'));

  return (
    <BienvenidaClient
      talleres={talleresHabilitados()} planes={planes} banderas={banderas}
      estadosConVisitas={estadosConVisitas} buscadorRefacciones={buscadorRefacciones} mesesPromoTaller={mesesPromoTaller}
    />
  );
}
