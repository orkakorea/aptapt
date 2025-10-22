import { useEffect, useRef, useState } from 'react';

interface UseKakaoMapOptions {
  kakao: any;
  containerId: string;
  center?: { lat: number; lng: number };
  level?: number;
}

/**
 * Hook to initialize and manage a Kakao Map instance
 */
export function useKakaoMap({ kakao, containerId, center, level = 7 }: UseKakaoMapOptions) {
  const mapRef = useRef<any>(null);
  const [isMapReady, setIsMapReady] = useState(false);

  useEffect(() => {
    if (!kakao?.maps) return;

    const container = document.getElementById(containerId);
    if (!container) return;

    const defaultCenter = center || { lat: 37.5665, lng: 126.9780 }; // Seoul

    const options = {
      center: new kakao.maps.LatLng(defaultCenter.lat, defaultCenter.lng),
      level,
    };

    const map = new kakao.maps.Map(container, options);
    mapRef.current = map;
    setIsMapReady(true);

    return () => {
      mapRef.current = null;
      setIsMapReady(false);
    };
  }, [kakao, containerId, center, level]);

  return { map: mapRef.current, isMapReady };
}
