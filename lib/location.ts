/**
 * Location service: real device location, permission flow, distance helpers.
 * Used to compute "X km away" for proposals based on actual user position.
 */
import * as Location from 'expo-location';
import * as SecureStore from 'expo-secure-store';
import { LONDON_CENTER } from '@/constants/london';

const LOCATION_KEY = 'lastKnownLocation';

export interface Coords {
  lat: number;
  lng: number;
  accuracy?: number;
  timestamp: number;
}

/**
 * Request foreground location permission.
 * Returns the granted status; does not throw.
 */
export async function requestLocationPermission(): Promise<'granted' | 'denied' | 'undetermined'> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    return status as any;
  } catch {
    return 'denied';
  }
}

/** Has the user already granted permission? */
export async function getLocationPermissionStatus() {
  const { status } = await Location.getForegroundPermissionsAsync();
  return status;
}

/**
 * Get current device coordinates. Falls back to last cached, then London centre.
 * `silent` = don't request permission, just read what's available.
 */
export async function getCurrentLocation({ silent = false } = {}): Promise<Coords> {
  try {
    if (!silent) {
      const status = await getLocationPermissionStatus();
      if (status !== 'granted') {
        const granted = await requestLocationPermission();
        if (granted !== 'granted') {
          return await getCachedLocation();
        }
      }
    } else {
      const status = await getLocationPermissionStatus();
      if (status !== 'granted') return await getCachedLocation();
    }

    const pos = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    const coords: Coords = {
      lat: pos.coords.latitude,
      lng: pos.coords.longitude,
      accuracy: pos.coords.accuracy ?? undefined,
      timestamp: Date.now(),
    };
    await SecureStore.setItemAsync(LOCATION_KEY, JSON.stringify(coords));
    return coords;
  } catch (e) {
    return await getCachedLocation();
  }
}

async function getCachedLocation(): Promise<Coords> {
  try {
    const raw = await SecureStore.getItemAsync(LOCATION_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { ...LONDON_CENTER, timestamp: 0 };
}

/**
 * Haversine formula — straight-line distance in km between two coords.
 */
export function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const sin1 = Math.sin(dLat / 2);
  const sin2 = Math.sin(dLng / 2);
  const h = sin1 * sin1 + Math.cos(lat1) * Math.cos(lat2) * sin2 * sin2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Format a distance with sensible UK-friendly precision */
export function formatDistance(km: number): string {
  if (km < 0.1) return 'Right here';
  if (km < 1) return `${Math.round(km * 1000)} m away`;
  if (km < 10) return `${km.toFixed(1)} km away`;
  return `${Math.round(km)} km away`;
}
