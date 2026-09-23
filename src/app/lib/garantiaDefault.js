// Valores de arranque para las condiciones de garantía de un yonke — se usan (a) como precarga
// del formulario en panel/perfil.js la primera vez que el yonke abre esa sección, y (b) como
// respaldo en NotaGarantiaModal.js si por algún motivo el yonke nunca guardó su configuración
// (nunca debe bloquear la generación de una nota). El "[X]" en el texto de cobertura es literal
// a propósito — el yonke lo reemplaza por su número real de días al editar el texto una vez.
export const GARANTIA_DIAS_DEFAULT = 15;

export const GARANTIA_QUE_CUBRE_DEFAULT =
  'Garantía de [X] días sobre el funcionamiento de la pieza. Si la pieza no funciona ' +
  'correctamente al ser instalada, se cambia o se reembolsa presentando esta nota.';

export const GARANTIA_QUE_NO_CUBRE_DEFAULT =
  'No cubre daños por mala instalación, golpes, mal uso, sobrecalentamiento, ni piezas de ' +
  'desgaste (bandas, baleros, focos, etc.). La garantía se anula si la pieza fue manipulada o ' +
  'instalada por un tercero no calificado.';
