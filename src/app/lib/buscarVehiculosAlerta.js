import { buscarVehiculosPorAnio } from './buscarVehiculosPorAnio';
import { esPremiumVigente } from '../../lib/planes';
import { disponibleParaPieza } from '../../lib/vehiculosAlerta';

// Vehículos completos que los yonkes confirmaron al responder alertas (yonkes/{id}/vehiculosAlerta),
// vigentes y sin esa pieza vendida. Compartido por el buscador inteligente (/api/buscar, con
// dbServer) y el avanzado (HomeClient, con db). Solo con marca, modelo, año y pieza: misma marca,
// mismo modelo y mismo año exacto, nada de años cercanos.
//
// Reutiliza buscarVehiculosPorAnio (mismo matching de marca/modelo que el inventario normal): una
// consulta por yonke activo con where('ano' == año), sin índices nuevos. Con ~15 yonkes son unas
// 30 lecturas por búsqueda. SI CRECE (cientos de yonkes): cambiar ESTA función por una sola
// consulta collectionGroup('vehiculosAlerta') con where('ano') + where('marca') (pide un índice
// compuesto de grupo de colecciones y una regla match /{path=**}/vehiculosAlerta/{id}).
export async function buscarVehiculosAlerta(dbInstancia, yonkesDocs, { marca, modelo, anio, pieza }, ahora = new Date()) {
  if (!marca || !modelo || anio == null || !pieza) return [];
  const pares = await buscarVehiculosPorAnio(dbInstancia, yonkesDocs, marca, modelo, anio, 'vehiculosAlerta');
  return pares
    .filter(({ vDoc }) => disponibleParaPieza(vDoc.data(), pieza, ahora))
    .map(({ yonkeDoc, vDoc }) => {
      const y = yonkeDoc.data();
      const v = vDoc.data();
      return {
        yonkeId: yonkeDoc.id, vehiculoAlertaId: vDoc.id,
        yonkeNombre: y.nombre || '', logoUrl: y.logoUrl || null, ciudad: y.ciudad || '', whatsapp: y.whatsapp || '',
        verificado: y.verificado === true, enviosNacionales: y.enviosNacionales === true, premiumVigente: esPremiumVigente(y),
        vehiculo: { marca: v.marca, modelo: v.modelo, ano: v.ano },
      };
    })
    // Premium primero, igual que el resto de los resultados.
    .sort((a, b) => Number(b.premiumVigente) - Number(a.premiumVigente));
}

// Quita los yonkes que ya salen en los resultados normales con un vehículo del mismo año (no
// duplicar tarjetas). Un resultado de otro año (años cercanos) no la quita.
export function sinYonkesYaMostrados(vehiculosAlerta, resultados) {
  const claves = new Set((resultados || []).map((r) => `${r.yonkeId}_${r.vehiculo?.ano}`));
  return vehiculosAlerta.filter((v) => !claves.has(`${v.yonkeId}_${v.vehiculo?.ano}`));
}
