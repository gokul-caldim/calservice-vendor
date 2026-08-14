/**
 * useReverseGeocode.js
 *
 * Ported and adapted from location_service_share/frontend/useReverseGeocode.js.
 * Resolves GPS coordinates to a structured address using Google Maps Geocoding API
 * with Nominatim as fallback.
 *
 * API key is read from import.meta.env.VITE_GOOGLE_MAPS_KEY (never hardcoded).
 */

import { useState, useCallback, useRef } from 'react';

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/reverse';
const CACHE = new Map(); // simple in-memory cache keyed by rounded coords

function roundCoord(val, decimals = 4) {
  return parseFloat(val.toFixed(decimals));
}

function cacheKey(lat, lng) {
  return `${roundCoord(lat)},${roundCoord(lng)}`;
}

/**
 * Stateless reverse geocoder. Returns a structured address object or null.
 * Tries Google Maps Geocoding API first, falls back to Nominatim.
 */
export async function reverseGeocode(latitude, longitude) {
  const key = cacheKey(latitude, longitude);
  if (CACHE.has(key)) return CACHE.get(key);

  const googleKey = import.meta.env.VITE_GOOGLE_MAPS_KEY;

  // --- Google Maps Geocoding API ---
  if (googleKey) {
    try {
      const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${googleKey}`;
      const resp = await fetch(url);
      const data = await resp.json();

      if (data.status === 'OK' && data.results?.length) {
        const first = data.results[0];
        const comps = first.address_components || [];

        let sublocality = '', route = '', city = '', state = '', pincode = '', country = '';
        for (const c of comps) {
          const types = c.types || [];
          if (types.includes('sublocality') || types.includes('sublocality_level_1'))
            sublocality = c.long_name;
          if (types.includes('route')) route = c.long_name;
          if (types.includes('locality')) city = c.long_name;
          if (types.includes('administrative_area_level_1')) state = c.long_name;
          if (types.includes('postal_code')) pincode = c.long_name;
          if (types.includes('country')) country = c.long_name;
        }

        const area = [sublocality, route].filter(Boolean).join(', ') || sublocality || route || '';
        const result = {
          locality: area,
          city,
          state,
          pincode,
          country: country || 'India',
          formatted_address: first.formatted_address || '',
          area,
        };
        CACHE.set(key, result);
        return result;
      }
    } catch {
      // fall through to Nominatim
    }
  }

  // --- Nominatim fallback ---
  try {
    const params = new URLSearchParams({
      lat: latitude,
      lon: longitude,
      format: 'json',
      addressdetails: '1',
      'accept-language': 'en',
    });
    const resp = await fetch(`${NOMINATIM_URL}?${params}`, {
      headers: { 'User-Agent': 'WorkforceApp/1.0' },
    });
    const data = await resp.json();
    const addr = data.address || {};

    const areaParts = [
      addr.building,
      addr.house_number,
      addr.road,
      addr.suburb,
      addr.neighbourhood,
      addr.city_district,
    ].filter(Boolean);

    const uniqueParts = [...new Set(areaParts)];
    const area = uniqueParts.slice(0, 2).join(', ');
    const city = addr.city || addr.town || addr.village || addr.county || '';
    const result = {
      locality: area,
      city,
      state: addr.state || '',
      pincode: addr.postcode || '',
      country: addr.country || 'India',
      formatted_address: data.display_name || '',
      area,
    };
    CACHE.set(key, result);
    return result;
  } catch {
    return null;
  }
}

/**
 * useReverseGeocode hook.
 *
 * Provides a `resolveAddress(lat, lng)` function that:
 *  - Returns a structured address object
 *  - Caches results to avoid redundant API calls
 *  - Exposes loading and error state
 *
 * Returns { resolveAddress, address, loading, error, clearAddress }
 */
export function useReverseGeocode() {
  const [address, setAddress] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const abortRef = useRef(false);

  const resolveAddress = useCallback(async (latitude, longitude) => {
    if (latitude == null || longitude == null) return null;
    setLoading(true);
    setError(null);
    abortRef.current = false;

    const result = await reverseGeocode(latitude, longitude);

    if (!abortRef.current) {
      if (result) {
        setAddress(result);
      } else {
        setError({ message: 'Could not resolve address for these coordinates.' });
      }
      setLoading(false);
    }
    return result;
  }, []);

  const clearAddress = useCallback(() => {
    abortRef.current = true;
    setAddress(null);
    setError(null);
  }, []);

  return { resolveAddress, address, loading, error, clearAddress };
}
