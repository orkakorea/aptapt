import { useEffect, useRef, useState } from "react";

declare global { interface Window { kakao: any } }

export default function MapPage() {
  const mapDivRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const placesRef = useRef<any>(null);
  const clustererRef = useRef<any>(null);
  const [kw, setKw] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const q = params.get("q") || "";
    setKw(q);

    const KAKAO_JS_KEY = "a53075efe7a2256480b8650cec67ebae"; // JavaScript 키
    const SDK = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${KAKAO_JS_KEY}&libraries=services,clusterer&autoload=false`;

    const load = () => (window as any).kakao.maps.load(init);
    const exist = document.querySelector(`script[src^="${SDK}"]`) as HTMLScriptElement | null;
    if (exist) exist.addEventListener("load", load);
    else {
      const s = document.createElement("script");
      s.src = SDK; s.async = true; s.onload = load;
      document.head.appendChild(s);
    }

    function init() {
      const { kakao } = window;
      const center = new kakao.maps.LatLng(37.5665, 126.9780); // 기본값(서울시청)
      const map = new kakao.maps.Map(mapDivRef.current!, { center, level: 5 });
      mapRef.current = map;

      placesRef.current = new kakao.maps.services.Places();
      clustererRef.current = new kakao.maps.MarkerClusterer({
        map, averageCenter: true, minLevel: 7
      });

      if (q) runSearch(q); // ← URL에서 q가 오면 즉시 검색
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function runSearch(query: string) {
    const { kakao } = window;
    const map = mapRef.current;
    const places = placesRef.current;
    const clusterer = clustererRef.current;
    if (!map || !places || !clusterer) return;

    places.keywordSearch(query, (data: any[], status: string) => {
      if (status === kakao.maps.services.Status.OK && data.length) {
        clusterer.clear();
        const markers = data.map(d => {
          const pos = new kakao.maps.LatLng(d.y, d.x);
          const m = new kakao.maps.Marker({ position: pos });
          const iw = new kakao.maps.InfoWindow({
            content: `<div style="padding:8px 10px;min-width:180px;">
                <strong>${escapeHtml(d.place_name)}</strong><br/>
                ${d.road_address_name || d.address_name || ""}<br/>
                <a target="_blank" href="https://map.kakao.com/link/to/${encodeURIComponent(d.place_name)},${d.y},${d.x}">길찾기</a>
              </div>`
          });
          kakao.maps.event.addListener(m, "click", () => iw.open(map, m));
          return m;
        });
        clusterer.addMarkers(markers);

        const bounds = new kakao.maps.LatLngBounds();
        data.forEach(d => bounds.extend(new kakao.maps.LatLng(d.y, d.x)));
        map.setBounds(bounds); // 🔥 결과 범위로 화면 이동
      } else {
        // 장소검색 결과 없으면 주소 지오코딩으로 1점 이동
        const geocoder = new kakao.maps.services.Geocoder();
        geocoder.addressSearch(query, (res: any[], stat: string) => {
          if (stat === kakao.maps.services.Status.OK && res[0]) {
            clusterer.clear();
            const { y, x, address_name } = res[0];
            const pos = new kakao.maps.LatLng(y, x);
            const m = new kakao.maps.Marker({ position: pos });
            clusterer.addMarkers([m]);
            map.setLevel(4);
            map.setCenter(pos);
            new kakao.maps.InfoWindow({
              content: `<div style="padding:8px 10px;min-width:180px;"><strong>${escapeHtml(address_name)}</strong></div>`
            }).open(map, m);
          } else {
            alert("검색 결과가 없습니다.");
          }
        });
      }
    }, { size: 15 });
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const q = kw.trim();
    if (!q) return;
    runSearch(q);
    // 주소창도 동기화(새로고침해도 유지)
    const u = new URL(window.location.href);
    u.searchParams.set("q", q);
    window.history.replaceState({}, "", u.toString());
  }

  return (
    <div style={{ width: "100%", minHeight: "100vh" }}>
      {/* 상단 재검색 바 (선택) */}
      <form onSubmit={onSubmit}
        style={{position:"absolute",zIndex:10,top:12,left:"50%",transform:"translateX(-50%)",
                background:"#fff",borderRadius:12,padding:8,boxShadow:"0 4px 16px rgba(0,0,0,.12)",
                display:"flex",gap:8,alignItems:"center"}}>
        <input value={kw} onChange={e=>setKw(e.target.value)}
               placeholder="지역/아파트/단지명 검색"
               style={{width:300,padding:"8px 10px",border:"1px solid #e5e7eb",borderRadius:8}}/>
        <button type="submit" style={{padding:"8px 12px",border:0,borderRadius:8,background:"#5b21b6",color:"#fff",cursor:"pointer"}}>검색</button>
      </form>

      <div ref={mapDivRef} style={{ width: "100%", height: "100vh" }} />
    </div>
  );
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
