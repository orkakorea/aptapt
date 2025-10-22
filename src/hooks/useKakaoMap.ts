/**
 * Kakao Map/Clusterer 생성 훅 (공용)
 * - 컨테이너 ref만 주면 지도/클러스터러를 만들어줍니다.
 * - onIdle(지도가 멈췄을 때) 콜백을 디바운스해서 호출합니다.
 * - SSR 안전(브라우저에서만 동작)
 *
 * 사용 예)
 * const { kakao, map, clusterer } = useKakaoMap(containerRef, {
 *   kakao,                           // useKakaoLoader().kakao 전달
 *   center: { lat: 37.5665, lng: 126.9780 },
 *   level: 6,
 *   onIdle: () => { /* 바운드로 데이터 조회 *\/ },
 *   idleDebounceMs: 150,
 *   clusterer: { enable: true, options: { gridSize: 80, minLevel: 6, averageCenter: true } }
 * });
 */

import { useEffect, useMemo, useRef, useState } from "react";

type LatLng = { lat: number; lng: number };

export type UseKakaoMapOptions = {
  /** useKakaoLoader().kakao 결과 (필수) */
  kakao?: any;
  /** 초기 중심 좌표 (기본: 서울시청) */
  center?: LatLng;
  /** 초기 레벨(줌) (기본: 6) — 값이 바뀌면 setLevel 수행 */
  level?: number;
  /** 드래그 가능 여부 (기본: true) */
  draggable?: boolean;
  /** 마우스 휠 줌 (기본: true) */
  scrollwheel?: boolean;

  /** 지도가 처음 준비됐을 때 1회 호출 */
  onReady?: (map: any) => void;
  /** idle 이벤트(이동/줌 종료 후) — 디바운싱됨 */
  onIdle?: (map: any) => void;
  /** idle 디바운스 ms (기본 120ms) */
  idleDebounceMs?: number;

  /** 클러스터러 옵션 (기본: enable=true) */
  clusterer?: {
    enable?: boolean;
    options?: {
      gridSize?: number;
      averageCenter?: boolean;
      minLevel?: number;
      disableClickZoom?: boolean;
    };
  };
};

export function useKakaoMap(containerRef: React.RefObject<HTMLDivElement>, opts: UseKakaoMapOptions) {
  const [map, setMap] = useState<any | null>(null);
  const [clusterer, setClusterer] = useState<any | null>(null);
  const [kakaoReady, setKakaoReady] = useState<any | null>(null);

  const idleCbRef = useRef<((m: any) => void) | undefined>(undefined);
  const optionsRef = useRef<UseKakaoMapOptions>(opts);
  optionsRef.current = opts;
  idleCbRef.current = opts.onIdle;

  // 디바운스 유틸(참조 동일성 유지)
  const debounceRef = useRef<(fn: () => void, ms: number) => () => void>();
  if (!debounceRef.current) {
    debounceRef.current = (fn, ms) => {
      let t: number | undefined;
      return () => {
        if (t) window.clearTimeout(t);
        // @ts-expect-error setTimeout 타입 브라우저/노드 차이 무시
        t = window.setTimeout(() => fn(), ms);
      };
    };
  }

  // kakao 객체 준비 감지
  useEffect(() => {
    if (!opts.kakao?.maps || typeof opts.kakao.maps.LatLng !== "function") {
      setKakaoReady(null);
      return;
    }
    setKakaoReady(opts.kakao);
  }, [opts.kakao]);

  // 지도/클러스터러 생성 및 이벤트 바인딩
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!kakaoReady?.maps) return;
    const maps = kakaoReady.maps;
    const container = containerRef.current;
    if (!container) return;

    // 초기 옵션
    const center = toLatLng(maps, opts.center ?? { lat: 37.5665, lng: 126.978 });
    const level = Number.isFinite(opts.level) ? (opts.level as number) : 6;

    const mapInst = new maps.Map(container, {
      center,
      level,
      draggable: opts.draggable ?? true,
      scrollwheel: opts.scrollwheel ?? true,
    });

    // 클러스터러(옵션 기본값)
    let clusterInst: any | null = null;
    const wantCluster = opts.clusterer?.enable ?? true;
    if (wantCluster && maps.MarkerClusterer) {
      clusterInst = new maps.MarkerClusterer({
        map: mapInst,
        gridSize: opts.clusterer?.options?.gridSize ?? 80,
        averageCenter: opts.clusterer?.options?.averageCenter ?? true,
        minLevel: opts.clusterer?.options?.minLevel ?? 6,
        disableClickZoom: opts.clusterer?.options?.disableClickZoom ?? true,
      });
    }

    setMap(mapInst);
    setClusterer(clusterInst);
    opts.onReady?.(mapInst);

    // idle 이벤트(디바운스)
    const debouncedIdle = debounceRef.current!(
      () => {
        const cb = idleCbRef.current;
        if (cb) cb(mapInst);
      },
      Math.max(0, opts.idleDebounceMs ?? 120),
    );
    const idleHandler = maps.event.addListener(mapInst, "idle", debouncedIdle);

    // 리사이즈 대응
    const onResize = () => {
      try {
        mapInst.relayout();
      } catch {
        /* no-op */
      }
    };
    window.addEventListener("resize", onResize);

    // 클린업
    return () => {
      try {
        if (idleHandler) maps.event.removeListener(idleHandler);
      } catch {
        /* no-op */
      }
      window.removeEventListener("resize", onResize);

      try {
        if (clusterInst) {
          clusterInst.clear();
          clusterInst.setMap(null);
        }
      } catch {
        /* no-op */
      }
      try {
        mapInst.setLevel(6);
        mapInst.setMap(null);
      } catch {
        /* no-op */
      }
      setClusterer(null);
      setMap(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kakaoReady, containerRef]);

  // 옵션 변경 반영: center/level
  useEffect(() => {
    if (!map || !kakaoReady?.maps) return;
    const maps = kakaoReady.maps;

    if (opts.center) {
      try {
        const c = toLatLng(maps, opts.center);
        map.setCenter(c);
      } catch {
        /* no-op */
      }
    }
    if (Number.isFinite(opts.level)) {
      try {
        map.setLevel(opts.level as number);
      } catch {
        /* no-op */
      }
    }
  }, [map, kakaoReady, opts.center?.lat, opts.center?.lng, opts.level]);

  // 조작용 헬퍼
  const api = useMemo(() => {
    return {
      kakao: kakaoReady,
      map,
      clusterer,
      /** 현재 지도 레벨 반환 */
      getLevel: () => (map?.getLevel ? map.getLevel() : undefined),
      /** 지도 레벨 설정 */
      setLevel: (lv: number) => {
        if (!map) return;
        try {
          map.setLevel(lv);
        } catch {
          /* no-op */
        }
      },
      /** 지도 중심 이동(애니메이션) */
      panTo: (lat: number, lng: number) => {
        if (!map || !kakaoReady?.maps) return;
        try {
          const pos = new kakaoReady.maps.LatLng(lat, lng);
          map.panTo(pos);
        } catch {
          /* no-op */
        }
      },
      /** 지도 중심 즉시 설정 */
      setCenter: (lat: number, lng: number) => {
        if (!map || !kakaoReady?.maps) return;
        try {
          const pos = new kakaoReady.maps.LatLng(lat, lng);
          map.setCenter(pos);
        } catch {
          /* no-op */
        }
      },
      /** 바운드 반환 */
      getBounds: () => (map?.getBounds ? map.getBounds() : undefined),
      /** 레이아웃 재계산(컨테이너 크기 변화 시) */
      relayout: () => {
        if (!map) return;
        try {
          map.relayout();
        } catch {
          /* no-op */
        }
      },
    };
  }, [map, clusterer, kakaoReady]);

  return api;
}

/* ---------------------------------------------
 * 내부: 좌표 객체 생성
 * -------------------------------------------- */
function toLatLng(maps: any, c: LatLng) {
  const lat = Number(c.lat);
  const lng = Number(c.lng);
  return new maps.LatLng(Number.isFinite(lat) ? lat : 37.5665, Number.isFinite(lng) ? lng : 126.978);
}
