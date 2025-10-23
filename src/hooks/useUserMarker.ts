import { useEffect, useRef, useState } from "react";

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
  const getMarkerImage = () => {
    if (!kakao?.maps) return null;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28">
         <circle cx="14" cy="14" r="8" fill="#1a73e8"/>
         <circle cx="14" cy="14" r="11.5" fill="none" stroke="white" stroke-width="3"/>
       </svg>`;
    const url = "data:image/svg+xml;utf8," + encodeURIComponent(svg);
    return new kakao.maps.MarkerImage(url, new kakao.maps.Size(28, 28), {
      offset: new kakao.maps.Point(14, 14),
    });
  };

  const ensureOverlays = () => {
    if (!kakao?.maps || !map) return;
    if (!markerRef.current) {
      markerRef.current = new kakao.maps.Marker({
        zIndex: 999999,
        clickable: false,
      });
      try {
        markerRef.current.setImage(getMarkerImage());
      } catch {}
    }
    if (!circleRef.current) {
      circleRef.current = new kakao.maps.Circle({
        strokeWeight: 1,
        strokeColor: "#4285F4",
        strokeOpacity: 0.6,
        strokeStyle: "solid",
        fillColor: "#4285F4",
        fillOpacity: 0.15,
        zIndex: 999998,
      });
      circleRef.current.setMap(map);
    }
    markerRef.current.setMap(map);
  };

  const updatePosition = (lat: number, lng: number, accuracy?: number) => {
    if (!kakao?.maps || !map) return;
    ensureOverlays();
    const pos = new kakao.maps.LatLng(lat, lng);
    markerRef.current?.setPosition(pos);

    if (circleRef.current) {
      circleRef.current.setPosition(pos);
      circleRef.current.setRadius(Math.max(0, Math.min(Number(accuracy) || 0, 500)));
    }

    if (autoCenterOnFirstFix && !centeredOnceRef.current) {
      centeredOnceRef.current = true;
      try {
        map.panTo(pos);
      } catch {}
    }
  };

  // 한 번만 요청(버튼에서 호출)
  const locateNow = () => {
    if (!navigator.geolocation) {
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
        setError(err.message || "위치 정보를 가져오지 못했습니다.");
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 10000 },
    );
  };

  useEffect(() => {
    if (!kakao?.maps || !map) return;
    if (!watch || !navigator.geolocation) return;

    const id = navigator.geolocation.watchPosition(
      (res) => {
        const { latitude, longitude, accuracy } = res.coords;
        setHasFix(true);
        setError(null);
        updatePosition(latitude, longitude, accuracy);
      },
      (err) => {
        setError(err.message || "위치 추적 실패");
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 5000 },
    );
    watchIdRef.current = id as unknown as number;

    return () => {
      if (watchIdRef.current != null && navigator.geolocation.clearWatch) {
        try {
          navigator.geolocation.clearWatch(watchIdRef.current);
        } catch {}
      }
      watchIdRef.current = null;

      try {
        markerRef.current?.setMap(null);
        circleRef.current?.setMap(null);
      } catch {}
      markerRef.current = null;
      circleRef.current = null;
      centeredOnceRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kakao, map, watch]);

  return {
    hasFix,
    error,
    locateNow, // ✅ 버튼에서 호출
  };
}
