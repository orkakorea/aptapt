import { MutableRefObject, useCallback, useEffect, useRef, useState } from "react";

type UseKakaoMapOpts = {
  kakao: any;
  center: { lat: number; lng: number };
  level?: number;
  idleDebounceMs?: number;
};

export function useKakaoMap(
  mapRef: MutableRefObject<HTMLDivElement | null>,
  { kakao, center, level = 6 }: UseKakaoMapOpts,
) {
  const [map, setMap] = useState<any>(null);
  const [clusterer, setClusterer] = useState<any>(null);
  const createdRef = useRef(false);

  useEffect(() => {
    const el = mapRef.current;
    // ❗ kakao/maps 혹은 DOM 이 준비되지 않았으면 아무것도 하지 않음
    if (!el || !kakao?.maps || createdRef.current) return;

    let m: any = null;
    let c: any = null;

    try {
      const { maps } = kakao;
      const centerLL = new maps.LatLng(center.lat, center.lng);
      m = new maps.Map(el, { center: centerLL, level });
      setMap(m);

      // clusterer 라이브러리가 없는 경우도 안전 처리
      const MC = (maps as any).MarkerClusterer;
      if (typeof MC === "function") {
        try {
          c = new MC({
            map: m,
            averageCenter: true,
            minLevel: 6,
            disableClickZoom: true,
            gridSize: 80,
          });
          setClusterer(c);
        } catch {
          setClusterer(null);
        }
      } else {
        setClusterer(null);
      }

      createdRef.current = true;
    } catch (err) {
      console.error("[useKakaoMap] init failed:", err);
      setMap(null);
      setClusterer(null);
      createdRef.current = false;
    }

    return () => {
      // 안전한 정리
      try {
        c?.setMap?.(null);
      } catch {}
      try {
        m?.setMap?.(null);
      } catch {}
      setClusterer(null);
      setMap(null);
      createdRef.current = false;
    };
    // kakao/maps 가 준비된 이후에만 한번 실행
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kakao]);

  const relayout = useCallback(() => {
    try {
      map?.relayout?.();
    } catch {}
  }, [map]);

  return { map, clusterer, relayout };
}

export default useKakaoMap;
