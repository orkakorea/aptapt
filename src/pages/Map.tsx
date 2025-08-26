import { useEffect, useRef } from "react";

export default function MapPage() {
  const mapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // 카카오 SDK 스크립트 동적 로드
    const script = document.createElement("script");
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=a53075efe7a2256480b8650cec67ebae&autoload=false`;
    script.async = true;
    script.onload = () => {
      (window as any).kakao.maps.load(() => {
        if (mapRef.current) {
          const center = new (window as any).kakao.maps.LatLng(37.5665, 126.9780); // 서울시청
          const map = new (window as any).kakao.maps.Map(mapRef.current, {
            center,
            level: 5,
          });

          const marker = new (window as any).kakao.maps.Marker({ position: center });
          marker.setMap(map);
        }
      });
    };
    document.head.appendChild(script);
  }, []);

  return <div ref={mapRef} style={{ width: "100%", height: "100vh" }} />;
}
