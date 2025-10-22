/**
 * Kakao 키워드 장소검색 훅 (가벼운 버전)
 * - kakao.maps.services.Places 를 내부에서 1회 생성해 재사용합니다.
 * - 검색 성공 시 지도를 해당 위치로 이동하고(또는 바로 중심 설정) 레벨(줌)을 조정합니다.
 *
 * 사용 예)
 * const search = usePlaceSearch({ kakao, map, defaultLevel: 4 });
 * await search.run("송파 헬리오시티"); // true면 지도 이동 완료
 */

import { useCallback, useEffect, useRef } from "react";

type UsePlaceSearchOptions = {
  /** useKakaoLoader().kakao */
  kakao?: any;
  /** useKakaoMap() 등으로 만든 지도 인스턴스 */
  map?: any | null;
  /** 검색 성공 시 적용할 기본 줌 레벨(기본 4) */
  defaultLevel?: number;
  /** panTo(부드럽게 이동) 대신 setCenter(즉시 이동) 사용 여부(기본 true: panTo) */
  smoothPan?: boolean;
  /** 검색 결과를 외부에서 활용하고 싶을 때 */
  onSearched?: (query: string, results: any[] | null, status: string) => void;
};

export function usePlaceSearch(opts: UsePlaceSearchOptions) {
  const placesRef = useRef<any | null>(null);
  const lastQueryRef = useRef<string>("");

  // Places 인스턴스 준비
  useEffect(() => {
    if (!opts.kakao?.maps?.services?.Places) {
      placesRef.current = null;
      return;
    }
    // 지도 인스턴스가 없어도 Places 생성은 가능
    placesRef.current = new opts.kakao.maps.services.Places();
  }, [opts.kakao]);

  const run = useCallback(
    (query: string): Promise<boolean> => {
      const q = `${query ?? ""}`.trim();
      lastQueryRef.current = q;

      return new Promise<boolean>((resolve) => {
        const kakao = opts.kakao;
        const map = opts.map;
        const Places = kakao?.maps?.services;
        const inst = placesRef.current;

        if (!q || !Places?.Status || !inst || !map) {
          opts.onSearched?.(q, null, "NOT_READY");
          resolve(false);
          return;
        }

        inst.keywordSearch(q, (results: any[], status: string) => {
          try {
            opts.onSearched?.(q, results ?? null, status);
          } catch {
            /* no-op */
          }

          if (status !== Places.Status.OK || !results?.length) {
            resolve(false);
            return;
          }

          const first = results[0];
          const lat = Number(first?.y);
          const lng = Number(first?.x);
          if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
            resolve(false);
            return;
          }

          const pos = new kakao.maps.LatLng(lat, lng);
          const level = Number.isFinite(opts.defaultLevel as number) ? (opts.defaultLevel as number) : 4;

          try {
            map.setLevel(level);
            if (opts.smoothPan === false) map.setCenter(pos);
            else map.panTo(pos);
          } catch {
            /* no-op */
          }

          resolve(true);
        });
      });
    },
    [opts.kakao, opts.map, opts.defaultLevel, opts.smoothPan, opts.onSearched],
  );

  return {
    /** 마지막 검색어 */
    lastQuery: lastQueryRef.current,
    /** 키워드 검색 실행 → 성공 시 지도 이동 */
    run,
  };
}

export default usePlaceSearch;
