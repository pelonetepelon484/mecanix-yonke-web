// Escrituras que agregan campos/documentos NUEVOS (ventasPublicas, privado/contacto, campos de
// aceptación legal, expiraEn…) pueden ser rechazadas por las reglas de Firestore mientras estas no
// se hayan actualizado (permission-denied). Como esas escrituras nuevas van en el mismo batch o
// documento que la operación principal, un rechazo tumbaría TODA la operación (guardar un yonke,
// registrar una venta, reservar, registrarse). Esta función intenta primero la versión completa y,
// solo ante permission-denied, reintenta la versión básica (la de siempre) para no bloquear el
// flujo. Cualquier otro error se propaga tal cual. Si la operación básica también es rechazada
// (un permiso real), ese error sí llega al llamador.
export async function conFallbackDePermisos(intentoCompleto, intentoBasico, etiqueta = '') {
  try {
    return await intentoCompleto();
  } catch (error) {
    if (error?.code !== 'permission-denied') throw error;
    console.warn(`[conFallbackDePermisos] ${etiqueta} rechazado por reglas de Firestore; se reintenta sin los campos nuevos.`);
    return intentoBasico();
  }
}
