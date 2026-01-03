import type { EstablishmentCategory } from '../types/establishment';

/**
 * Local fallback images (bundled) to ensure lists always show a "real" preview image.
 * This avoids the SVG data-url placeholder issue on React Native.
 */
export function getPlaceFallbackImage(category?: EstablishmentCategory | string | null): any {
  const c = String(category || '').toLowerCase();

  if (c === 'restaurant') return require('../assets/restaurant-template.jpg');
  if (c === 'lounge') return require('../assets/lounge.jpg');
  if (c === 'bar' || c === 'maquis') return require('../assets/bars.jpg');
  if (c === 'cave') return require('../assets/caves.jpg');
  if (c === 'pharmacy') return require('../assets/clinique.jpg');
  if (c === 'hospital' || c === 'emergency') return require('../assets/clinique.jpg');
  if (c === 'police') return require('../assets/commissariat.jpg');
  if (c === 'organizer') return require('../assets/lounge.jpg');

  return require('../assets/bars.jpg');
}








