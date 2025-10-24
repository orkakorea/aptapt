import { useEffect, useMemo, useRef, useState } from "react";

type LatLng = { lat: number; lng: number };
type Options = {
  kakao: any;
  center: LatLng;
  level?: number;
  /** 참고용 옵션(이 훅 내부에선 이벤트 바인딩을 하지 않음) */
  idleDebounceMs?: number;
};

/**
 * Kakao Map 안전 훅
 * - 훅 호출 순서를 깨지 않기 위해 "조기 return"을 절대 하지 않음
 * - kakao/map 준비 상태 체크는 effect 내부에서만 수행
 * - map/clusterer 생성 시 setState로 알리고, 이후에는 ref를 통해서만 변경
 */
export function useKakaoMap(
  containerRef: React.RefObject<HTMLDivElement | null>,
  { kakao, center, level = 6 }: Options,
) {
  // ✅ 항상 같은 순서로 호출되는 훅들
  const [map, setMap] = useState<any>(null);
  const [clusterer, setClusterer] = useState<any>(null);

  // LatLng 객체 메모
  const centerLatLng = useMemo(() => {
    const lt = Number(center?.lat);
    const lg = Number(center?.lng);
    if (!kakao?.maps || !Number.isFinite(lt) || !Number.isFinite(lg)) return null;
    try {
      return new kakao.maps.LatLng(lt, lg);
    } catch {
      return null;
    }
  }, [kakao, center?.lat, center?.lng]);

  // 지도 생성/업데이트
  useEffect(() => {
    // 준비 안 됐으면 아무것도 하지 않음 (조기 return으로 훅을 건너뛰지 않음)
    if (!kakao?.maps) return;
    const el = containerRef.current;
    if (!el) return;

    // 최초 생성
    if (!map) {
      try {
        const m = new kakao.maps.Map(el, {
          center: centerLatLng ?? new kakao.maps.LatLng(37.5665, 126.978),
          level,
        });
        setMap(m);
      } catch {
        // 실패 시 setMap 안 함
      }
      return;
    }

    // 이미 맵이 있으면 중심/레벨만 갱신
    try {
      if (centerLatLng) map.setCenter(centerLatLng);
      if (typeof level === "number") map.setLevel(level);
    } catch {
      /* noop */
    }
  }, [kakao, containerRef, centerLatLng, level, map]);

  // 클러스터러 생성(있을 때만 1회)
  useEffect(() => {
    if (!kakao?.maps || !map) return;
    if (clusterer) return;

    try {
      // kakao.maps.MarkerClusterer 가 없는 환경도 있으므로 가드
      const C = (kakao.maps as any).MarkerClusterer;
      if (typeof C === "function") {
        const cl = new C({
          map,
          averageCenter: true,
          minLevel: 5,
          // 기타 옵션은 필요 시 여기서 조정
        });
        setClusterer(cl);
      } else {
        setClusterer(null);
      }
    } catch {
      setClusterer(null);
    }
  }, [kakao, map, clusterer]);

  // 언마운트/의존 변경 시 정리
  useEffect(() => {
    return () => {
      try {
        if (clusterer && typeof clusterer.clear === "function") clusterer.clear();
        // 마커 개별 setMap(null)은 useMarkers 에서 처리
      } catch {}
      // map 자체는 DOM이 사라지면 자동 정리되므로 명시 해제 생략
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 항상 동일 shape 반환
  return { map, clusterer };
}

export default useKakaoMap;
