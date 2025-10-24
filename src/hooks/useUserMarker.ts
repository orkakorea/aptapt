import { useCallback, useEffect, useRef, useState } from "react";

type UseUserMarkerArgs = {
  kakao: any;
  map: any;
  autoCenterOnFirstFix?: boolean; // 최초 위치 수신 시 지도 중앙 이동
  watch?: boolean; // 지속 추적 여부
};

export default function useUserMarker({ kakao, map, autoCenterOnFirstFix = true, watch = true }: UseUserMarkerArgs) {
  const markerRef = useRef<any>(null);
  const circleRef = useRef<any>(null);
  const watchIdRef = useRef<number | null>(null);
  const centeredOnceRef = useRef(false);

  const [hasFix, setHasFix] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 파란 점 마커 이미지 (SVG data URL)
  const getMarkerImage = useCallback(() => {
    if (!kakao?.maps) return null;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28">
      <circle cx="14" cy="14" r="8" fill="#1a73e8"/>
      <circle cx="14" cy="14" r="11.5" fill="none" stroke="white" stroke-width="3"/>
    </svg>`;
    const url = "data:image/svg+xml;utf8," + encodeURIComponent(svg);
    try {
      return new kakao.maps.MarkerImage(url, new kakao.maps.Size(28, 28), {
        offset: new kakao.maps.Point(14, 14),
      });
    } catch {
      return null;
    }
  }, [kakao]);

  // 오버레이 생성/정리 (준비 전이면 아무 것도 안 함)
  useEffect(() => {
    if (!kakao?.maps || !map) return;

    if (!markerRef.current) {
      try {
        markerRef.current = new kakao.maps.Marker({
          zIndex: 999999,
          clickable: false,
        });
        const img = getMarkerImage();
        if (img) markerRef.current.setImage(img);
      } catch {
        markerRef.current = null;
      }
    }
    if (!circleRef.current) {
      try {
        circleRef.current = new kakao.maps.Circle({
          strokeWeight: 1,
          strokeColor: "#4285F4",
          strokeOpacity: 0.6,
          strokeStyle: "solid",
          fillColor: "#4285F4",
          fillOpacity: 0.15,
          zIndex: 999998,
        });
      } catch {
        circleRef.current = null;
      }
    }

    try {
      markerRef.current?.setMap?.(map);
      circleRef.current?.setMap?.(map);
    } catch {}

    return () => {
      try {
        markerRef.current?.setMap?.(null);
        circleRef.current?.setMap?.(null);
      } catch {}
      markerRef.current = null;
      circleRef.current = null;
      centeredOnceRef.current = false;
    };
  }, [kakao, map, getMarkerImage]);

  // 위치 업데이트(최초 fix에는 자동 센터)
  const updatePosition = useCallback(
    (lat: number, lng: number, accuracy?: number) => {
      if (!kakao?.maps || !map || !markerRef.current) return;
      try {
        const pos = new kakao.maps.LatLng(lat, lng);
        markerRef.current.setPosition(pos);

        if (circleRef.current) {
          circleRef.current.setPosition(pos);
          // 반경 0~500m로 클램프
          const r = Math.max(0, Math.min(Number(accuracy) || 0, 500));
          circleRef.current.setRadius(r);
        }

        if (autoCenterOnFirstFix && !centeredOnceRef.current) {
          centeredOnceRef.current = true;
          map.panTo?.(pos);
        }
      } catch {}
    },
    [kakao, map, autoCenterOnFirstFix],
  );

  // 한 번만 요청(버튼에서 호출)
  const locateNow = useCallback(() => {
    if (!navigator?.geolocation) {
      setError("이 브라우저에서 위치 정보를 지원하지 않습니다.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (res) => {
        const { latitude, longitude, accuracy } = res.coords;
        setHasFix(true);
        setError(null);
        updatePosition(latitude, longitude, accuracy);
        try {
          map?.setLevel?.(5);
          map?.panTo?.(new kakao.maps.LatLng(latitude, longitude));
        } catch {}
      },
      (err) => {
        setError(err?.message || "위치 정보를 가져오지 못했습니다.");
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 10000 },
    );
  }, [map, updatePosition]);

  // 지속 추적(watch)
  useEffect(() => {
    if (!watch || !navigator?.geolocation) return;

    const id = navigator.geolocation.watchPosition(
      (res) => {
        const { latitude, longitude, accuracy } = res.coords;
        setHasFix(true);
        setError(null);
        updatePosition(latitude, longitude, accuracy);
      },
      (err) => {
        setError(err?.message || "위치 추적 실패");
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 5000 },
    );
    watchIdRef.current = id as unknown as number;

    return () => {
      try {
        if (watchIdRef.current != null) navigator.geolocation.clearWatch(watchIdRef.current);
      } catch {}
      watchIdRef.current = null;
    };
  }, [watch, updatePosition]);

  return { hasFix, error, locateNow };
}
