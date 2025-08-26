import { useEffect, useRef, useState } from "react";

declare global { interface Window { kakao: any } }

export default function MapPage() {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapObj = useRef<any>(null);
  const [kw, setKw] = useState("");

  useEffect(() => {
    // URL ?q=... 읽기
    const params = new URLSearchParams(window.location.search);
    const q = params.get("q") || "";
    setKw(q);

    // Kakao SDK 로드 (services 포함)
    const JS_KEY = "a53075efe7a2256480b8650cec67ebae"; // ← JS 키(REST 아님)
    const SDK = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${JS_KEY}&libraries=services&autoload=false`;

    const onload = () => window.kakao.maps.load(init);
    const exist = document.querySelector(`script[src^="${SDK}"]`) as HTMLScriptElement | null;
    if (exist) exist.addEventListener("load", onload);
    else {
      const s = document.createElement("script");
      s.src = SDK; s.async = true; s.onload = onload;
      document.head.appendChild(s);
    }

    function init() {
      if (!mapRef.current) return;
      const { kakao } = window;

      // 초기 맵(임시로 서울시청 중심, 마커는 만들지 않음)
      const map = new kakao.maps.Map(mapRef.current, {
        center: new kakao.maps.LatLng(37.5665, 126.9780),
        level: 5,
      });
      mapObj.current = map;

      // 최초 진입 시 q가 있으면 바로 검색 실행
      if (q) runSearch(q);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 검색 실행: 장소검색 → 실패 시 주소 지오코딩
  function runSearch(query: string) {
    const { kakao } = window;
    const map = mapObj.current;
    if (!map) return;

    const places = new kakao.maps.services.Places();
    places.keywordSearch(query, (data: any[], status: string) => {
      if (status === kakao.maps.services.Status.OK && data.length) {
        // 결과 마커(첫 결과 기준으로 이동)
        const d = data[0];
        const pos = new kakao.maps.LatLng(d.y, d.x);
        new kakao.maps.Marker({ position: pos }).setMap(map);
        map.setLevel(4);
        map.setCenter(pos);

        // 여러 결과를 모두 보여주고 싶으면 아래 주석 해제
        // const bounds = new kakao.maps.LatLngBounds();
        // data.forEach(it => bounds.extend(new kakao.maps.LatLng(it.y, it.x)));
        // map.setBounds(bounds);
      } else {
        // 장소검색 결과 없으면 주소 지오코딩
        const geocoder = new kakao.maps.services.Geocoder();
        geocoder.addressSearch(query, (res: any[], stat: string) => {
          if (stat === kakao.maps.services.Status.OK && res[0]) {
            const { y, x } = res[0];
            const pos = new kakao.maps.LatLng(y, x);
            new kakao.maps.Marker({ position: pos }).setMap(map);
            map.setLevel(4);
            map.setCenter(pos);
          } else {
            alert("검색 결과가 없습니다.");
          }
        });
      }
    }, { size: 15 });
  }

  // 맵 상단에서 재검색 가능(선택사항)
  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const q = kw.trim();
    if (!q) return;
    runSearch(q);
    const u = new URL(window.location.href);
    u.searchParams.set("q", q);
    window.history.replaceState({}, "", u.toString());
  }

  return (
    <div style={{ width: "100%", minHeight: "100vh" }}>
      {/* 재검색 바 (원하면 숨겨도 됨) */}
      <form onSubmit={onSubmit}
        style={{position:"absolute",zIndex:10,top:12,left:"50%",transform:"translateX(-50%)",
                background:"#fff",borderRadius:12,padding:8,boxShadow:"0 4px 16px rgba(0,0,0,.12)",
                display:"flex",gap:8,alignItems:"center"}}>
        <input
          value={kw}
          onChange={e=>setKw(e.target.value)}
          placeholder="지역/아파트/단지명 검색"
          style={{width:300,padding:"8px 10px",border:"1px solid #e5e7eb",borderRadius:8}}
        />
        <button type="submit" style={{padding:"8px 12px",border:0,borderRadius:8,background:"#5b21b6",color:"#fff",cursor:"pointer"}}>
          검색
        </button>
      </form>

      <div ref={mapRef} style={{ width: "100%", height: "100vh" }} />
    </div>
  );
}
