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

// 컨테이너가 준비될 때까지(존재 + 너비/높이 > 0) 대기
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
  // ResizeObserver 또는 정리용 디스커넥터를 보관
  const resizeObsRef = useRef<{ disconnect: () => void } | null>(null);

  useEffect(() => {
    let cancelled = false;
    let m: any = null;
    let c: any = null;

    (async () => {
      if (!kakao?.maps || createdRef.current) return;

      // ✅ 모바일: 컨테이너가 실제로 보일(크기 > 0) 때까지 기다림
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

        // ✅ 컨테이너 크기 변화 감지 → 자동 relayout
        if ("ResizeObserver" in window) {
          // 타입 이슈 없이 안전하게 any로 캐스팅
          const RO: any = (window as any).ResizeObserver;
          const ro = new RO(() => {
            try {
              m.relayout();
            } catch {}
          });
          ro.observe(el);
          resizeObsRef.current = { disconnect: () => ro.disconnect?.() };
        } else {
          // 일부 환경(아주 오래된 브라우저)용 폴백: window 이벤트 사용
          const w: any = window;
          const onResize = () => {
            try {
              m.relayout();
            } catch {}
          };
          w.addEventListener?.("resize", onResize);
          w.addEventListener?.("orientationchange", onResize);
          resizeObsRef.current = {
            disconnect: () => {
              w.removeEventListener?.("resize", onResize);
              w.removeEventListener?.("orientationchange", onResize);
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
        resizeObsRef.current?.disconnect();
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
      resizeObsRef.current = null;
    };
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
