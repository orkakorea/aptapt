import { useRef, useCallback } from 'react';
import type { PlaceRow } from '@/core/types';

interface MarkerCache {
  [key: string]: any; // Kakao marker object
}

/**
 * Hook to manage Kakao map markers
 */
export function useMarkers() {
  const markerCacheRef = useRef<MarkerCache>({});
  const clustererRef = useRef<any>(null);

  const initClusterer = useCallback((kakao: any, map: any) => {
    if (clustererRef.current) {
      clustererRef.current.clear();
    }
    clustererRef.current = new kakao.maps.MarkerClusterer({
      map,
      averageCenter: true,
      minLevel: 5,
    });
  }, []);

  const clearMarkers = useCallback(() => {
    Object.values(markerCacheRef.current).forEach((marker) => {
      marker.setMap(null);
    });
    markerCacheRef.current = {};
    if (clustererRef.current) {
      clustererRef.current.clear();
    }
  }, []);

  const addMarker = useCallback((key: string, marker: any) => {
    markerCacheRef.current[key] = marker;
  }, []);

  const getMarker = useCallback((key: string) => {
    return markerCacheRef.current[key];
  }, []);

  const removeMarker = useCallback((key: string) => {
    const marker = markerCacheRef.current[key];
    if (marker) {
      marker.setMap(null);
      delete markerCacheRef.current[key];
    }
  }, []);

  return {
    markerCache: markerCacheRef.current,
    clusterer: clustererRef.current,
    initClusterer,
    clearMarkers,
    addMarker,
    getMarker,
    removeMarker,
  };
}
