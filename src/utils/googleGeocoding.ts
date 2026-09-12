export interface GeocodeResult {
  lat: number;
  lng: number;
  formattedAddress?: string;
  source: 'google_js_sdk' | 'google_api' | 'fallback';
}

const MAPS_API_KEY = String(
  import.meta.env?.VITE_GOOGLE_MAPS_API_KEY || ''
).trim();

/**
 * Automatically fetches GPS coordinates (latitude, longitude) for a given address
 * using the Google Maps Geocoding API / Google Maps JS SDK Geocoder.
 */
export async function geocodeAddressWithGoogleMaps(
  address: string
): Promise<GeocodeResult | null> {
  if (!address || !address.trim()) return null;

  const cleanAddress = address.trim();

  // 1. Primary: Use Google Maps JS SDK Geocoder if loaded in the DOM
  if (
    typeof window !== 'undefined' &&
    (window as any).google &&
    (window as any).google.maps &&
    (window as any).google.maps.Geocoder
  ) {
    try {
      const geocoder = new (window as any).google.maps.Geocoder();
      const response = await new Promise<any>((resolve) => {
        geocoder.geocode({ address: cleanAddress }, (results: any, status: string) => {
          if (status === 'OK' && results && results[0]) {
            resolve(results[0]);
          } else {
            resolve(null);
          }
        });
      });

      if (response && response.geometry && response.geometry.location) {
        const loc = response.geometry.location;
        const lat = typeof loc.lat === 'function' ? loc.lat() : loc.lat;
        const lng = typeof loc.lng === 'function' ? loc.lng() : loc.lng;
        return {
          lat,
          lng,
          formattedAddress: response.formatted_address,
          source: 'google_js_sdk',
        };
      }
    } catch (e) {
      console.warn('Google Maps JS Geocoder failed, trying HTTP API fallback:', e);
    }
  }

  // 2. Secondary: Direct fetch to Google Maps Geocoding REST API (if key present)
  if (MAPS_API_KEY) {
    try {
      const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
        cleanAddress
      )}&key=${MAPS_API_KEY}`;

      const res = await fetch(url);
      const data = await res.json();

      if (data.status === 'OK' && data.results && data.results.length > 0) {
        const location = data.results[0].geometry.location;
        return {
          lat: location.lat,
          lng: location.lng,
          formattedAddress: data.results[0].formatted_address,
          source: 'google_api',
        };
      }
    } catch (err) {
      console.warn('Google Maps HTTP Geocoding API call encountered issue:', err);
    }
  }

  // 3. Fallback: OpenStreetMap Nominatim for dev/demo fallback if key is a mock key
  try {
    const fallbackRes = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(
        cleanAddress
      )}`
    );
    const fallbackData = await fallbackRes.json();
    if (fallbackData && fallbackData.length > 0) {
      return {
        lat: parseFloat(fallbackData[0].lat),
        lng: parseFloat(fallbackData[0].lon),
        formattedAddress: fallbackData[0].display_name,
        source: 'fallback',
      };
    }
  } catch (err) {
    console.error('All geocoding attempts failed:', err);
  }

  return null;
}

/**
 * Reverse-geocodes GPS coordinates (latitude, longitude) into a physical address
 * using the Google Maps Geocoding API / Google Maps JS SDK Geocoder, with a Nominatim fallback.
 */
export async function reverseGeocodeWithGoogleMaps(
  lat: number,
  lng: number
): Promise<string | null> {
  // 1. Primary: Use Google Maps JS SDK Geocoder if loaded in the DOM
  if (
    typeof window !== 'undefined' &&
    (window as any).google &&
    (window as any).google.maps &&
    (window as any).google.maps.Geocoder
  ) {
    try {
      const geocoder = new (window as any).google.maps.Geocoder();
      const response = await new Promise<any>((resolve) => {
        geocoder.geocode({ location: { lat, lng } }, (results: any, status: string) => {
          if (status === 'OK' && results && results[0]) {
            resolve(results[0]);
          } else {
            resolve(null);
          }
        });
      });

      if (response && response.formatted_address) {
        return response.formatted_address;
      }
    } catch (e) {
      console.warn('Google Maps JS Reverse Geocoder failed, trying HTTP API fallback:', e);
    }
  }

  // 2. Secondary: Direct fetch to Google Maps Geocoding REST API (if key present)
  if (MAPS_API_KEY) {
    try {
      const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${MAPS_API_KEY}`;

      const res = await fetch(url);
      const data = await res.json();

      if (data.status === 'OK' && data.results && data.results.length > 0) {
        return data.results[0].formatted_address;
      }
    } catch (err) {
      console.warn('Google Maps HTTP Reverse Geocoding API call encountered issue:', err);
    }
  }

  // 3. Fallback: OpenStreetMap Nominatim for dev/demo fallback
  try {
    const fallbackRes = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`
    );
    const fallbackData = await fallbackRes.json();
    if (fallbackData && fallbackData.display_name) {
      return fallbackData.display_name;
    }
  } catch (err) {
    console.error('All reverse geocoding attempts failed:', err);
  }

  return null;
}
