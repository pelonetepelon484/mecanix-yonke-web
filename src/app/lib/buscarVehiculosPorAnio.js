import { collection, getDocs, query, where } from 'firebase/firestore';

// Modelos que el cliente nombra con un nombre comercial regional distinto al que normalmente
// captura el yonke en su inventario (mismo vehículo, otro badge) — se revisan ADEMÁS del nombre
// exacto, nunca en vez de él. Cheyenne es el nombre con el que GM vende en México la misma
// plataforma de la pickup Chevrolet Silverado (auditoría 2026-09-24: búsqueda real de "cheyene
// 2010" sin match, aunque el yonke pudo haber registrado el mismo vehículo como "Silverado").
// Agregar aquí a medida que el log de búsquedas muestre otros casos.
const MODELOS_EQUIVALENTES = {
  cheyenne: ['silverado', 'silverado 1500'],
};

// Núcleo de matching compartido entre el buscador manual (page.js, con `db`) y el
// inteligente (lib/busqueda/consultarInventario.js, con `dbServer`) — antes duplicado casi
// palabra por palabra en ambos archivos. Un cambio futuro a esta lógica (ej. cómo se
// compara marca/modelo) aplica a los dos con solo editar aquí.
//
// modelo=null: cualquier modelo de esa marca (búsqueda solo por marca, ej. "nissan 2015").
// marca=null: cualquier marca (usado solo por la búsqueda de motores/transmisiones por
// cilindrada sin marca, ej. "motor 3.6" — el buscador de vehículos siempre resuelve una marca
// antes de llegar aquí, así que este caso nunca lo afecta).
// anio=null: cualquier año (usado por el nivel "cualquier año").
// subcoleccion: 'vehiculos' (default) o 'motores' — mismo matching de marca/modelo/año sirve
// para buscar motores/transmisiones sueltos (consultarInventario.js), sin duplicar la
// comparación para que "V6"/marca/modelo casen igual venga de un vehículo o de un motor suelto.
// Devuelve pares {yonkeDoc, vDoc} SIN calificación ni forma final — cada buscador arma el
// resultado a su manera (el inteligente, por ejemplo, quita fechaIngreso porque cruza a
// JSON; el manual no lo necesita).
export async function buscarVehiculosPorAnio(dbInstancia, yonkesDocs, marca, modelo, anio, subcoleccion = 'vehiculos') {
  const encontrados = [];
  for (const yonkeDoc of yonkesDocs) {
    const yonkeData = yonkeDoc.data();
    if (!yonkeData.activo) continue;
    const vehiculosRef = collection(dbInstancia, 'yonkes', yonkeDoc.id, subcoleccion);
    const q = anio != null ? query(vehiculosRef, where('ano', '==', anio)) : vehiculosRef;
    const snap = await getDocs(q);
    // DEUDA TÉCNICA: el filtrado de marca/modelo se hace client-side tras traer por año, lo que
    // desperdicia lecturas de Firestore. Irrelevante con ~14 yonkes; revisar si se acerca a ~100
    // yonkes o si el bot de WhatsApp genera tráfico alto, moviendo el filtro a la query (requiere
    // índices compuestos marca+modelo+ano).
    const coincidentes = snap.docs.filter((vDoc) => {
      const data = vDoc.data();
      // disponible !== false (ausente o true = disponible) — mismo criterio ya usado para
      // motores/piezasSueltas y ya implementado en getInventarioDeTenant (lib/getTenant.js).
      // Filtrado client-side a propósito, junto con marca/modelo (ver DEUDA TÉCNICA arriba):
      // agregar esto como where() de Firestore junto al where('ano') existente pediría un
      // índice compuesto nuevo (igualdad + desigualdad en campos distintos); así, cero índices
      // nuevos (auditoría 2026-09-24, "vehículos vendidos ya no se borran").
      if (data.disponible === false) return false;
      const marcaOk = marca == null || data.marca?.toLowerCase() === marca.trim().toLowerCase();
      const modeloBuscado = modelo?.trim().toLowerCase();
      const modeloDatoOk = modelo == null || data.modelo?.toLowerCase() === modeloBuscado;
      const modeloEquivalenteOk = modelo != null
        && (MODELOS_EQUIVALENTES[modeloBuscado] || []).includes(data.modelo?.toLowerCase());
      return marcaOk && (modeloDatoOk || modeloEquivalenteOk);
    });
    for (const vDoc of coincidentes) {
      encontrados.push({ yonkeDoc, vDoc });
    }
  }
  return encontrados;
}

// Consulta varios años EN PARALELO (Promise.all) en vez de uno por uno — este era
// exactamente el cuello de botella del buscador manual (84 round-trips secuenciales para
// 6 años cercanos con 14 yonkes, con el rango de ±3 de entonces: ~9.7s; en paralelo por
// año, mismo número de lecturas, ~1.8s).
//
// Reordena el resultado a "yonke primero, año después" (el mismo orden que producía el
// loop secuencial original) aunque las consultas se disparan en paralelo por año — así el
// orden final que ve el usuario no cambia, solo el tiempo de ejecución.
export async function buscarVehiculosEnAniosParalelo(dbInstancia, yonkesDocs, marca, modelo, anios, subcoleccion = 'vehiculos') {
  const listasPorAnio = await Promise.all(
    anios.map((anio) => buscarVehiculosPorAnio(dbInstancia, yonkesDocs, marca, modelo, anio, subcoleccion))
  );
  const indiceYonke = new Map(yonkesDocs.map((d, i) => [d.id, i]));
  const plano = listasPorAnio.flat();
  plano.sort((a, b) => indiceYonke.get(a.yonkeDoc.id) - indiceYonke.get(b.yonkeDoc.id));
  return plano;
}
