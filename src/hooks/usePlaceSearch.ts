import { useState, useCallback, useRef } from 'react';
import { getPlacesInBounds } from '@/lib/data/getPlacesInBounds';
import type { PlaceRow, Bounds } from '@/core/types';

interface UsePlaceSearchOptions {
  /** Fields to fetch from the database */
  fields?: string[];
  /** Limit for number of results */
  limit?: number;
  /** Callback when search completes */
  onSearchComplete?: (places: PlaceRow[]) => void;
  /** Callback when search fails */
  onSearchError?: (error: string) => void;
}

interface UsePlaceSearchReturn {
  /** Current places data */
  places: PlaceRow[];
  /** Loading state */
  loading: boolean;
  /** Error message if any */
  error: string | null;
  /** Search for places within bounds */
  search: (bounds: Bounds) => Promise<void>;
  /** Clear current places */
  clear: () => void;
}

/**
 * Hook to search for places within map bounds
 * Handles loading state, error handling, and data management
 */
export function usePlaceSearch(options: UsePlaceSearchOptions = {}): UsePlaceSearchReturn {
  const [places, setPlaces] = useState<PlaceRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const abortControllerRef = useRef<AbortController | null>(null);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const search = useCallback(async (bounds: Bounds) => {
    // Cancel any ongoing search
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    abortControllerRef.current = new AbortController();
    setLoading(true);
    setError(null);

    try {
      const result = await getPlacesInBounds({
        bounds,
        fields: optionsRef.current.fields,
        limit: optionsRef.current.limit,
      });

      // Check if request was aborted
      if (abortControllerRef.current?.signal.aborted) {
        return;
      }

      if (result.error) {
        setError(result.error);
        optionsRef.current.onSearchError?.(result.error);
      } else {
        setPlaces(result.rows);
        optionsRef.current.onSearchComplete?.(result.rows);
      }
    } catch (err) {
      if (abortControllerRef.current?.signal.aborted) {
        return;
      }
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      optionsRef.current.onSearchError?.(errorMessage);
    } finally {
      if (!abortControllerRef.current?.signal.aborted) {
        setLoading(false);
      }
    }
  }, []);

  const clear = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setPlaces([]);
    setError(null);
    setLoading(false);
  }, []);

  return {
    places,
    loading,
    error,
    search,
    clear,
  };
}
