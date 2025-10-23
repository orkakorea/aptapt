import { useEffect, useRef, useState } from 'react';

interface UseUserMarkerOptions {
  kakao: any;
  map: any;
  autoCenter?: boolean;
}

export function useUserMarker(opts: UseUserMarkerOptions) {
  const { kakao, map, autoCenter = false } = opts;
  const markerRef = useRef<any>(null);
  const [userPosition, setUserPosition] = useState<{ lat: number; lng: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!kakao || !map) return;

    const updatePosition = (lat: number, lng: number) => {
      const position = new kakao.maps.LatLng(lat, lng);
      setUserPosition({ lat, lng });

      if (!markerRef.current) {
        // Create user location marker
        const markerImage = new kakao.maps.MarkerImage(
          'data:image/svg+xml;base64,' + btoa(`
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="12" cy="12" r="10" fill="#4285F4" stroke="white" stroke-width="3"/>
              <circle cx="12" cy="12" r="4" fill="white"/>
            </svg>
          `),
          new kakao.maps.Size(24, 24),
          { offset: new kakao.maps.Point(12, 12) }
        );

        markerRef.current = new kakao.maps.Marker({
          position,
          map,
          image: markerImage,
          zIndex: 1000,
        });
      } else {
        markerRef.current.setPosition(position);
      }

      if (autoCenter) {
        map.setCenter(position);
      }
    };

    // Get user's current position
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          updatePosition(position.coords.latitude, position.coords.longitude);
        },
        (err) => {
          setError(err.message);
          console.error('Geolocation error:', err);
        },
        {
          enableHighAccuracy: true,
          timeout: 5000,
          maximumAge: 0,
        }
      );

      // Watch position updates
      const watchId = navigator.geolocation.watchPosition(
        (position) => {
          updatePosition(position.coords.latitude, position.coords.longitude);
        },
        (err) => {
          console.error('Geolocation watch error:', err);
        },
        {
          enableHighAccuracy: true,
          maximumAge: 30000,
        }
      );

      return () => {
        navigator.geolocation.clearWatch(watchId);
        if (markerRef.current) {
          markerRef.current.setMap(null);
          markerRef.current = null;
        }
      };
    } else {
      setError('Geolocation not supported');
    }
  }, [kakao, map, autoCenter]);

  const centerOnUser = () => {
    if (map && userPosition) {
      const position = new kakao.maps.LatLng(userPosition.lat, userPosition.lng);
      map.setCenter(position);
    }
  };

  return {
    userPosition,
    error,
    centerOnUser,
  };
}
