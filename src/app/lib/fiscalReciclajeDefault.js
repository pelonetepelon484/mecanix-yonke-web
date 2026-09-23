// Valores por defecto de la sección fiscal de la nota de reciclaje — el yonke los ajusta una vez
// en su perfil (ver panel/perfil/page.js) y cada compra los copia como punto de partida editable
// (mismo patrón que garantiaDefault.js: default configurable + snapshot editable por documento).
export const IVA_PORCENTAJE_DEFAULT = 16;
export const IVA_RETENIDO_PORCENTAJE_DEFAULT = 16;
export const ISR_PORCENTAJE_DEFAULT = 5;

// Apagado por defecto: varios yonkes no emiten factura, así que el aviso no debe aparecer hasta
// que el yonke lo prenda explícitamente en su perfil.
export const INCLUIR_AVISO_FACTURA_DEFAULT = false;

export const AVISO_FACTURA_TEXTO = 'La emisión de este ticket es provisional, solicite su factura dentro de las próximas 24 horas presentando su identificación oficial.';
