// Vocabulario controlado para specs de vehículos y de motores/transmisiones sueltos.
// Un solo archivo importado por panel/inventario y admin/yonke/[id]/inventario (tanto para
// el vehículo completo como para la pieza suelta) — así un valor como "V6" queda idéntico
// en Firestore venga de donde venga, y las búsquedas casan sin importar el origen del dato.
export const OTRO_NO_ESPECIFICADO = 'Otro / No especificado';

export const OPCIONES_TRANSMISION = ['Manual', 'Automática', OTRO_NO_ESPECIFICADO];

export const OPCIONES_CONFIGURACION_MOTOR = [
  '3 cilindros', '4 cilindros', '5 cilindros', '6 cilindros en línea',
  'V6', 'V8', 'V10', 'V12', OTRO_NO_ESPECIFICADO,
];

export const OPCIONES_TRACCION = ['Sencillo', '4x4', 'AWD', OTRO_NO_ESPECIFICADO];
