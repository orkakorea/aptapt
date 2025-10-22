import { useState, useEffect } from 'react';
import { loadKakao } from '@/lib/loadKakao';

/**
 * Hook to load Kakao Maps SDK
 * Returns the kakao object once loaded, or an error if failed
 */
export function useKakaoLoader() {
  const [kakao, setKakao] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadKakao()
      .then((k) => {
        setKakao(k);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load Kakao SDK:', err);
        setError(err.message || 'Failed to load Kakao Maps SDK');
        setLoading(false);
      });
  }, []);

  return { kakao, error, loading };
}
