// Compartido por yonkes/[ciudad]/page.js y yonkes/[ciudad]/[yonkeId]/page.js — extraído para
// que el detalle de un yonke individual reuse exactamente el mismo schema.org que ya usaba el
// listado por ciudad, sin duplicar la lógica.
const DIA_SCHEMA = {
  lunes: 'https://schema.org/Monday',
  martes: 'https://schema.org/Tuesday',
  miercoles: 'https://schema.org/Wednesday',
  jueves: 'https://schema.org/Thursday',
  viernes: 'https://schema.org/Friday',
  sabado: 'https://schema.org/Saturday',
  domingo: 'https://schema.org/Sunday',
};

function buildOpeningHoursSpecification(horario) {
  return Object.keys(DIA_SCHEMA)
    .filter((dia) => horario[dia]?.abierto)
    .map((dia) => ({
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: DIA_SCHEMA[dia],
      opens: horario[dia].apertura,
      closes: horario[dia].cierre,
    }));
}

// pageUrl: URL de ESTE yonke (antes se le pasaba la URL de la página de ciudad completa —
// ahora que existe un detalle por yonke, cada entrada debe apuntar a su propia URL).
export function buildYonkeJsonLd(yonke, ciudadLabel, pageUrl) {
  const entry = {
    '@type': 'AutoPartsStore',
    name: yonke.nombre,
    address: {
      '@type': 'PostalAddress',
      streetAddress: yonke.direccion,
      addressLocality: ciudadLabel,
      addressRegion: 'Baja California',
      addressCountry: 'MX',
    },
    url: pageUrl,
  };

  if (yonke.telefono) {
    entry.telephone = `+52${yonke.telefono.replace(/\D/g, '')}`;
  }

  if (yonke.horario) {
    const spec = buildOpeningHoursSpecification(yonke.horario);
    if (spec.length) entry.openingHoursSpecification = spec;
  }

  if (yonke.calificacion.total > 0) {
    entry.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: yonke.calificacion.promedio,
      reviewCount: yonke.calificacion.total,
    };
  }

  return entry;
}
