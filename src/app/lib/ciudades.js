export const CIUDADES_BC = [
  { key: 'tijuana', label: 'Tijuana' },
  { key: 'mexicali', label: 'Mexicali' },
  { key: 'ensenada', label: 'Ensenada' },
  { key: 'tecate', label: 'Tecate' },
  { key: 'rosarito', label: 'Playas de Rosarito' },
  { key: 'sanquintin', label: 'San Quintín' },
];

export function getCiudadLabel(key) {
  return CIUDADES_BC.find(c => c.key === key)?.label ?? key;
}

export function isCiudadValida(key) {
  return CIUDADES_BC.some(c => c.key === key);
}
