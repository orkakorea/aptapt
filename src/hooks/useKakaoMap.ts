import { MutableRefObject, useCallback, useEffect, useRef, useState } from "react";

type UseKakaoMapOpts = {
  kakao: any;
  center: { lat: number; lng: number };
  level?: number;
  idleDebounceMs?: number;
};

// 연한 보라(파스텔) 통일 스타일
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
};

// 컨테이너가 준비될 때까지(존재 + 너비/높이 > 0) 기다리기
async function waitForContainer(
  ref: MutableRefObject<HTMLDivElement | null>,
  timeoutMs = 3000,
): Promise<HTMLDivElement | null> {
  const start = performance.now();
  return new Promise((resolve) => {
    const tick = () => {
      const el = ref.current;
      const ready = !!el && el.clientWidth > 0 && el.clientHeight > 0;
      if (ready) return resolve(el!);
      if (performance.now() - start > timeoutMs) return resolve(el ?? null);
      requestAnimationFrame(tick);
    };
    tick();
  });
}

export function useKakaoMap(
  mapRef: MutableRefObject<HTMLDivElement | null>,
  { kakao, center, level = 6 }: UseKakaoMapOpts,
) {
  const [map, setMap] = useState<any>(null);
  const [clusterer, setClusterer] = useState<any>(null);
  const createdRef = useRef(false);
  const resizeObsRef = useRef<ResizeObserver | null>(null);

  useEffect(() => {
    let cancelled = false;
    let m: any = null;
    let c: any = null;

    (async () => {
      // kakao SDK 미준비면 보류
      if (!kakao?.maps || createdRef.current) return;

      // ✅ 모바일: 컨테이너가 렌더/표시될 때까지 대기
      const el = await waitForContainer(mapRef, 4000);
      if (cancelled || !el) return;

      try {
        const { maps } = kakao;
        const centerLL = new maps.LatLng(center.lat, center.lng);

        // 지도 생성
        m = new maps.Map(el, { center: centerLL, level });
        setMap(m);

        // 클러스터러(있을 때만)
        const MC = (maps as any).MarkerClusterer;
        if (typeof MC === "function") {
          c = new MC({
            map: m,
            averageCenter: true,
            minLevel: 6,
            disableClickZoom: true,
            gridSize: 80,
            styles: [
              ORKA_CLUSTER_STYLE,
              ORKA_CLUSTER_STYLE,
              ORKA_CLUSTER_STYLE,
              ORKA_CLUSTER_STYLE,
              ORKA_CLUSTER_STYLE,
            ],
            calculator: [50, 100, 200],
          });
          setClusterer(c);
        } else {
          setClusterer(null);
        }

        // ✅ 컨테이너 크기 변화 시 자동 relayout (바텀시트 열림/닫힘 등)
        if ("ResizeObserver" in window) {
          const ro = new ResizeObserver(() => {
            try {
              m.relayout();
            } catch {}
          });
          ro.observe(el);
          resizeObsRef.current = ro;
        } else {
          const onResize = () => {
            try {
              m.relayout();
            } catch {}
          };
          window.addEventListener("resize", onResize);
          window.addEventListener("orientationchange", onResize);
          // 정리 시 제거는 아래에서 ResizeObserver가 없을 때만 필요
          (resizeObsRef as any).current = {
            disconnect: () => {
              window.removeEventListener("resize", onResize);
              window.removeEventListener("orientationchange", onResize);
            },
          };
        }

        createdRef.current = true;
      } catch (err) {
        console.error("[useKakaoMap] init failed:", err);
        setMap(null);
        setClusterer(null);
        createdRef.current = false;
      }
    })();

    return () => {
      cancelled = true;
      try {
        resizeObsRef.current?.disconnect?.();
      } catch {}
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
    // kakao SDK 준비 후 1회만 시도 (컨테이너는 waitForContainer로 대기 처리)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kakao]);

  const relayout = useCallback(() => {
    try {
      if (map) {
        map.relayout();
      }
    } catch {}
  }, [map]);

  return { map, clusterer, relayout };
}

export default useKakaoMap;
