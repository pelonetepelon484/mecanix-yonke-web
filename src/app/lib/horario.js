const DIAS_ORDEN = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'];
const DIAS_LABELS = { lunes: 'Lun', martes: 'Mar', miercoles: 'Mié', jueves: 'Jue', viernes: 'Vie', sabado: 'Sáb', domingo: 'Dom' };

export const metodosPagoLabels = {
  efectivo: 'Efectivo', tarjeta: 'Tarjeta', transferencia: 'Transferencia',
  spei: 'SPEI', codi: 'CoDi', zelle: 'Zelle', paypal: 'PayPal',
};

export function formatearHorario(horario) {
  if (!horario) return null;
  const diasAbiertos = DIAS_ORDEN.filter(d => horario[d]?.abierto);
  if (diasAbiertos.length === 0) return null;
  const grupos = [];
  let grupoActual = null;
  for (const dia of diasAbiertos) {
    const h = `${horario[dia].apertura}–${horario[dia].cierre}`;
    if (grupoActual && grupoActual.horario === h) { grupoActual.hasta = dia; }
    else { grupoActual = { desde: dia, hasta: dia, horario: h }; grupos.push(grupoActual); }
  }
  return grupos.map(g =>
    g.desde === g.hasta ? `${DIAS_LABELS[g.desde]} ${g.horario}` : `${DIAS_LABELS[g.desde]}–${DIAS_LABELS[g.hasta]} ${g.horario}`
  ).join('  ·  ');
}

export function obtenerEstadoAbierto(horario) {
  if (!horario) return null;
  const ahora = new Date();
  const diasSemana = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
  const diaActual = diasSemana[ahora.getDay()];
  const diaData = horario[diaActual];
  if (!diaData || !diaData.abierto) return { abierto: false, texto: 'Cerrado hoy' };
  const [horaAbre, minAbre] = diaData.apertura.split(':').map(Number);
  const [horaCierra, minCierra] = diaData.cierre.split(':').map(Number);
  const minutosAhora = ahora.getHours() * 60 + ahora.getMinutes();
  const minutosAbre = horaAbre * 60 + minAbre;
  const minutosCierra = horaCierra * 60 + minCierra;
  if (minutosAhora >= minutosAbre && minutosAhora < minutosCierra) {
    return { abierto: true, texto: `Abierto · Cierra a las ${diaData.cierre}` };
  }
  if (minutosAhora < minutosAbre) {
    return { abierto: false, texto: `Abre a las ${diaData.apertura}` };
  }
  return { abierto: false, texto: 'Cerrado por hoy' };
}
