import React, { useEffect, useRef, FormEvent, useState } from "react";

declare global { interface Window { kakao: any } }

export default function MapPage() {
  const mapDivRef = useRef<HTMLDivElement>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const KAKAO_JS_KEY = "YOUR_KAKAO_JS_KEY";
    const url = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${KAKAO_JS_KEY}&libraries=services,clusterer&autoload=false`;

    const onload = () => window.kakao.maps.load(() => {
      if (!mapDivRef.current) return;
      const { kakao } = window;
      const map = new kakao.maps.Map(
        mapDivRef.current,
        { center: new kakao.maps.LatLng(37.5665, 126.9780), level: 5 }
      );
      new kakao.maps.Marker({ position: new kakao.maps.LatLng(37.5665, 126.9780) }).setMap(map);
      setLoaded(true);
    });

    const exist = document.querySelector(`script[src^="${url}"]`) as HTMLScriptElement | null;
    if (exist) exist.addEventListener("load", onload);
    else {
      const s = document.createElement("script");
      s.src = url; s.async = true; s.onload = onload;
      document.head.appendChild(s);
    }
  }, []);

  return (
    <div style={{ width: "100%", minHeight: "100vh" }}>
      {!loaded && <div style={{padding:12}}>지도를 불러오는 중…</div>}
      <div ref={mapDivRef} style={{ width: "100%", height: "100vh" }} />
    </div>
  );
}
