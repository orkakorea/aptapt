import { useEffect, useRef } from "react";

declare global {
  interface Window { kakao: any }
}

export default function MapPage() {
  const mapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const KAKAO_JS_KEY = "YOUR_KAKAO_JS_KEY";
    const SDK = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${KAKAO_JS_KEY}&autoload=false`;

    const s = document.createElement("script");
    s.src = SDK; s.async = true;
    s.onload = () => {
      window.kakao.maps.load(() => {
        if (!mapRef.current) return;
        const { kakao } = window;
        const map = new kakao.maps.Map(mapRef.current, {
          center: new kakao.maps.LatLng(37.5665, 126.9780),
          level: 5,
        });
        new kakao.maps.Marker({ position: new kakao.maps.LatLng(37.5665, 126.9780) }).setMap(map);
      });
    };
    document.head.appendChild(s);
  }, []);

  return <div ref={mapRef} style={{ width: "100%", height: "100vh" }} />;
}
