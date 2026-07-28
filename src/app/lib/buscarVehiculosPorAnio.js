import { collection, getDocs, query, where } from 'firebase/firestore';

// Núcleo de matching compartido entre el buscador manual (page.js, con `db`) y el
// inteligente (lib/busqueda/consultarInventario.js, con `dbServer`) — antes duplicado casi
// palabra por palabra en ambos archivos. Un cambio futuro a esta lógica (ej. cómo se
// compara marca/modelo) aplica a los dos con solo editar aquí.
//
// modelo=null: cualquier modelo de esa marca (búsqueda solo por marca, ej. "nissan 2015").
// anio=null: cualquier año (usado por el nivel "cualquier año").
// Devuelve pares {yonkeDoc, vDoc} SIN calificación ni forma final — cada buscador arma el
// resultado a su manera (el inteligente, por ejemplo, quita fechaIngreso porque cruza a
// JSON; el manual no lo necesita).
export async function buscarVehiculosPorAnio(dbInstancia, yonkesDocs, marca, modelo, anio) {
  const encontrados = [];
  for (const yonkeDoc of yonkesDocs) {
    const yonkeData = yonkeDoc.data();
    if (!yonkeData.activo) continue;
    const vehiculosRef = collection(dbInstancia, 'yonkes', yonkeDoc.id, 'vehiculos');
    const q = anio != null ? query(vehiculosRef, where('ano', '==', anio)) : vehiculosRef;
    const snap = await getDocs(q);
    // DEUDA TÉCNICA: el filtrado de marca/modelo se hace client-side tras traer por año, lo que
    // desperdicia lecturas de Firestore. Irrelevante con ~14 yonkes; revisar si se acerca a ~100
    // yonkes o si el bot de WhatsApp genera tráfico alto, moviendo el filtro a la query (requiere
    // índices compuestos marca+modelo+ano).
    const coincidentes = snap.docs.filter((vDoc) => {
      const data = vDoc.data();
      const marcaOk = data.marca?.toLowerCase() === marca.trim().toLowerCase();
      const modeloOk = modelo == null || data.modelo?.toLowerCase() === modelo.trim().toLowerCase();
      return marcaOk && modeloOk;
    });
    for (const vDoc of coincidentes) {
      encontrados.push({ yonkeDoc, vDoc });
    }
  }
  return encontrados;
}

// Consulta varios años EN PARALELO (Promise.all) en vez de uno por uno — este era
// exactamente el cuello de botella del buscador manual (84 round-trips secuenciales para
// ±3 años con 14 yonkes: ~9.7s: en paralelo por año, mismo número de lecturas, ~1.8s).
//
// Reordena el resultado a "yonke primero, año después" (el mismo orden que producía el
// loop secuencial original) aunque las consultas se disparan en paralelo por año — así el
// orden final que ve el usuario no cambia, solo el tiempo de ejecución.
export async function buscarVehiculosEnAniosParalelo(dbInstancia, yonkesDocs, marca, modelo, anios) {
  const listasPorAnio = await Promise.all(
    anios.map((anio) => buscarVehiculosPorAnio(dbInstancia, yonkesDocs, marca, modelo, anio))
  );
  const indiceYonke = new Map(yonkesDocs.map((d, i) => [d.id, i]));
  const plano = listasPorAnio.flat();
  plano.sort((a, b) => indiceYonke.get(a.yonkeDoc.id) - indiceYonke.get(b.yonkeDoc.id));
  return plano;
}
