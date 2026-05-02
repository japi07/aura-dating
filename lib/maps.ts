/**
 * Open native Maps app for directions to a venue.
 * iOS → Apple Maps, Android → Google Maps.
 */
import { Linking, Platform } from 'react-native';

interface MapsTarget {
  name: string;
  address?: string;
  postcode?: string;
  lat?: number;
  lng?: number;
}

export async function openInMaps(target: MapsTarget): Promise<boolean> {
  const label = encodeURIComponent(target.name);
  const fullAddress = [target.address, target.postcode, 'London'].filter(Boolean).join(', ');
  const query = encodeURIComponent(fullAddress || target.name);

  // Prefer coordinates when we have them — most accurate
  const hasCoords = typeof target.lat === 'number' && typeof target.lng === 'number';

  let url: string;

  if (Platform.OS === 'ios') {
    url = hasCoords
      ? `maps://?q=${label}&ll=${target.lat},${target.lng}`
      : `maps://?q=${query}`;
    const supported = await Linking.canOpenURL(url);
    if (supported) {
      return Linking.openURL(url).then(() => true).catch(() => false);
    }
    // Fall back to Apple Maps web (which redirects to native on iOS)
    url = hasCoords
      ? `https://maps.apple.com/?q=${label}&ll=${target.lat},${target.lng}`
      : `https://maps.apple.com/?q=${query}`;
  } else if (Platform.OS === 'android') {
    url = hasCoords
      ? `geo:${target.lat},${target.lng}?q=${target.lat},${target.lng}(${label})`
      : `geo:0,0?q=${query}`;
    const supported = await Linking.canOpenURL(url);
    if (supported) {
      return Linking.openURL(url).then(() => true).catch(() => false);
    }
    url = `https://www.google.com/maps/search/?api=1&query=${query}`;
  } else {
    url = `https://www.google.com/maps/search/?api=1&query=${query}`;
  }

  return Linking.openURL(url).then(() => true).catch(() => false);
}

/** Open the dialer for a venue's phone number (or any phone) */
export async function callPhone(phone: string): Promise<boolean> {
  return Linking.openURL(`tel:${phone.replace(/[^\d+]/g, '')}`).then(() => true).catch(() => false);
}
