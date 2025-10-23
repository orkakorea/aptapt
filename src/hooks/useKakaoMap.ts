import { MutableRefObject, useCallback, useEffect, useRef, useState } from "react";

type UseKakaoMapOpts = {
  kakao: any;
  center: { lat: number; lng: number };
  level?: number;
  idleDebounceMs?: number;
};

// 연한 보라(파스텔) 통일 스타일: 모든 구간 동일 적용
const ORKA_CLUSTER_STYLE = {
  width: "40px",
  height: "40px",
  background: "rgba(111, 75, 242, 0.12)", // #6F4BF2의 아주 연한 보라
  color: "#6F4BF2",
  textAlign: "center" as const,
  lineHeight: "40px",
  fontSize: "13px",
  fontWeight: "700",
  borderRadius: "20px",
  // 필요시 살짝 테두리 느낌
  // boxShadow: "0 0 0 1px #E8E0FF inset",
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

            // ★ 연한 보라 클러스터 색상/모양 통일
            styles: [
              ORKA_CLUSTER_STYLE,
              ORKA_CLUSTER_STYLE,
              ORKA_CLUSTER_STYLE,
              ORKA_CLUSTER_STYLE,
              ORKA_CLUSTER_STYLE,
            ],

            // (선택) 단계별 집계 경계는 유지하되 스타일은 동일
            calculator: [50, 100, 200],
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
