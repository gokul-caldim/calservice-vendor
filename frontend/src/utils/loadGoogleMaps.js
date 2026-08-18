/**
 * loadGoogleMaps.js
 *
 * Authoritative, robust singleton loader for Google Maps JavaScript API.
 * Ensures window.google.maps.Map is fully initialized before resolving.
 */

let mapsApiPromise = null;

export function loadMapsApi(apiKey) {
  if (typeof window === 'undefined') return Promise.reject(new Error('No browser window available.'));
  if (!apiKey) return Promise.reject(new Error('Google Maps API key is not configured.'));

  const isMapsReady = () => {
    return Boolean(
      window.google &&
      window.google.maps &&
      typeof window.google.maps.Map === 'function' &&
      window.google.maps.ControlPosition &&
      typeof window.google.maps.Marker === 'function'
    );
  };

  if (isMapsReady()) {
    return Promise.resolve(window.google.maps);
  }

  if (!mapsApiPromise) {
    mapsApiPromise = new Promise((resolve, reject) => {
      if (isMapsReady()) {
        resolve(window.google.maps);
        return;
      }

      const existingScript = document.getElementById('gmap-script');
      if (existingScript) {
        const interval = setInterval(() => {
          if (isMapsReady()) {
            clearInterval(interval);
            resolve(window.google.maps);
          }
        }, 80);
        setTimeout(() => {
          clearInterval(interval);
          if (isMapsReady()) resolve(window.google.maps);
          else reject(new Error('Google Maps initialization timeout.'));
        }, 12000);
        return;
      }

      window.__initGoogleMapsWorkforce = () => {
        const checkReady = () => {
          if (isMapsReady()) {
            resolve(window.google.maps);
          } else {
            setTimeout(checkReady, 50);
          }
        };
        checkReady();
      };

      const script = document.createElement('script');
      script.id = 'gmap-script';
      script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&libraries=places,geometry&loading=async&callback=__initGoogleMapsWorkforce`;
      script.async = true;
      script.defer = true;
      script.onerror = (e) => reject(new Error(`Failed to load Google Maps script: ${e?.message || 'Network error'}`));
      document.head.appendChild(script);

      const interval = setInterval(() => {
        if (isMapsReady()) {
          clearInterval(interval);
          resolve(window.google.maps);
        }
      }, 80);

      setTimeout(() => {
        clearInterval(interval);
        if (isMapsReady()) {
          resolve(window.google.maps);
        } else {
          reject(new Error('Google Maps script load timeout.'));
        }
      }, 12000);
    });
  }

  return mapsApiPromise;
}
