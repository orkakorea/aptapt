import React, { useEffect, useRef, useState, FormEvent } from "react";
import { createClient } from "@supabase/supabase-js";

/* ====== Env ====== */
const SUPABASE_URL   = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_ANON  = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
const POINTS_TABLE   = (import.meta.env.VITE_POINTS_TABLE as string | undefined) || "apt_points";
const supabase = SUPABASE_URL && SUPABASE_ANON ? createClient(SUPABASE_URL, SUPABASE_ANON) : null;

/* ====== Small UI ====== */
const SearchIcon = (p: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" aria-hidden="true" {...p}>
    <path d="M21 21l-4.2-4.2m1.2-4.8a7 7 0 11-14 0 7 7 0 0114 0z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
const CalendarIcon = (p: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true" {...p}>
    <rect x="3" y="5" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.8"/>
    <path d="M3 9h18M8 3v4M16 3v4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
  </svg>
);
const DotsIcon = (p: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true" {...p}>
    <circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/>
  </svg>
);
function Chip({ children, active=false }:{children:React.ReactNode;active?:boolean}) {
  const base = "h-8 px-3 rounded-full text-sm inline-flex items-center justify-center";
  return active
    ? <button type="button" className={`${base} bg-[#7B61FF] text-white hover:bg-[#6A52FF]`}>{children}</button>
    : <button type="button" className={`${base} border border-[#E5E7EB] text-[#111827] bg-white`}>{children}</button>;
}
function EmptyCart() {
  return (
    <div className="flex h-[220px] flex-col items-center justify-center">
      <svg width="56" height="56" viewBox="0 0 56 56" aria-hidden="true">
        <defs><linearGradient id="g1" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#D9CFFF"/><stop offset="100%" stopColor="#BFA6FF"/></linearGradient></defs>
        <rect x="4" y="18" width="16" height="30" rx="4" fill="url(#g1)"/><rect x="22" y="10" width="20" height="38" rx="4" fill="url(#g1)"/><rect x="44" y="22" width="12" height="26" rx="4" fill="url(#g1)"/>
      </svg>
      <p className="mt-4 text-sm text-[#9CA3AF] text-center">광고를 원하는 아파트단지를 담아주세요!</p>
    </div>
  );
}

/* ====== SDK Loader ====== */
function ensureKakao(appkey: string) {
  return new Promise<any>((resolve, reject) => {
    const w: any = window;
    if (w.kakao?.maps) { if (typeof w.kakao.maps.load==="function") w.kakao.maps.load(()=>resolve(w.kakao)); else resolve(w.kakao); return; }
    const exist = document.querySelector<HTMLScriptElement>('script[src*="dapi.kakao.com/v2/maps/sdk.js"]');
    const onLoad = () => { if (typeof w.kakao?.maps?.load==="function") w.kakao.maps.load(()=>resolve(w.kakao)); else resolve(w.kakao); };
    if (exist) { exist.addEventListener("load", onLoad, { once: true }); setTimeout(()=>{ if (w.kakao?.maps) onLoad(); },0); return; }
    const s = document.createElement("script");
    s.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${appkey}&autoload=false&libraries=services,clusterer`;
    s.async = true; s.onerror = () => reject(new Error("Kakao SDK load failed")); s.onload = onLoad; document.head.appendChild(s);
  });
}

/* ====== Helpers ====== */
function getParams() {
  const p = new URLSearchParams(window.location.search);
  const q = (p.get("q")||"").trim();
  const lat = Number(p.get("lat")); const lng = Number(p.get("lng"));
  return { q, lat: Number.isFinite(lat)?lat:null, lng: Number.isFinite(lng)?lng:null };
}
function pickLatLng(row:any) {
  const lat = Number(row.lat ?? row.latitude ?? row.y);
  const lng = Number(row.lng ?? row.longitude ?? row.x);
  return Number.isFinite(lat) && Number.isFinite(lng) ? {lat,lng} : null;
}

/* ====== Map Canvas ====== */
function MapCanvas() {
  const ref = useRef<HTMLDivElement>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError]   = useState<string|null>(null);
  const [count, setCount]   = useState<number|null>(null);

  useEffect(() => {
    const el = ref.current; if (!el) return;

    (async () => {
      try {
        setLoaded(false); setError(null);

        const kakaoKey = import.meta.env.VITE_KAKAO_JS_KEY as string | undefined;
        if (!kakaoKey) { setError(".env의 VITE_KAKAO_JS_KEY가 필요합니다."); return; }

        // 1) Kakao init
        const kakao = await ensureKakao(kakaoKey);
        const map = new kakao.maps.Map(el, {
          center: new kakao.maps.LatLng(37.5665,126.9780),
          level: 6,
        });
        map.setMapTypeId(kakao.maps.MapTypeId.ROADMAP);
        setTimeout(()=>map.relayout(),0);

        // 2) URL 중심 이동 (지오코딩)
        const { q, lat, lng } = getParams();
        const centerTo = (la:number, ln:number, label?:string) => {
          const pt = new kakao.maps.LatLng(la, ln);
          map.setCenter(pt);
          const mk = new kakao.maps.Marker({ position: pt }); mk.setMap(map);
          if (label) new kakao.maps.InfoWindow({ content:`<div style="padding:6px 10px;font-size:12px;">${label}</div>` }).open(map, mk);
        };
        if (lat!=null && lng!=null) {
          centerTo(lat,lng);
        } else if (q) {
          const geocoder = new kakao.maps.services.Geocoder();
          geocoder.addressSearch(q, (res:any[], status:string) => {
            if (status===kakao.maps.services.Status.OK && res.length) centerTo(Number(res[0].y), Number(res[0].x), q);
            else {
              const places = new kakao.maps.services.Places();
              places.keywordSearch(q, (data:any[], st:string) => {
                if (st===kakao.maps.services.Status.OK && data.length) centerTo(Number(data[0].y), Number(data[0].x), data[0].place_name||q);
              });
            }
          });
        }

        // 3) Supabase에서 포인트 불러오기 (테이블/칼럼 유연 매핑)
        if (!supabase) {
          console.warn("Supabase env 없음: 포인트 로드 생략");
        } else {
          const { data, error:se } = await supabase
            .from(POINTS_TABLE) // ← 여기서 .env로 테이블명 결정
            .select("id, apt_name, name, addr, address, lat, lng, latitude, longitude, x, y")
            .limit(20000);
          if (se) { console.error(se); setError(`Supabase 에러: ${se.message}`); }
          const rows = (data||[])
            .map((r:any) => {
              const ll = pickLatLng(r); if (!ll) return null;
              return { id:r.id, nm: r.apt_name || r.name || "(무제)", addr: r.addr || r.address || "", ...ll };
            })
            .filter(Boolean) as Array<{id:any;nm:string;addr:string;lat:number;lng:number}>;
          setCount(rows.length);

          if (rows.length) {
            const clusterer = new kakao.maps.MarkerClusterer({ map, averageCenter:true, minLevel:7, disableClickZoom:false });
            const info = new kakao.maps.InfoWindow({ zIndex:2 });
            const markers = rows.map((r) => {
              const m = new kakao.maps.Marker({ position:new kakao.maps.LatLng(r.lat, r.lng) });
              kakao.maps.event.addListener(m,"click",()=> {
                info.setContent(`<div style="padding:6px 10px;font-size:12px;max-width:220px;">
                  <div style="font-weight:600;margin-bottom:2px;">${r.nm}</div>
                  <div style="color:#6B7280;">${r.addr}</div>
                </div>`);
                info.open(map,m);
              });
              return m;
            });
            clusterer.addMarkers(markers);

            if (!q && lat==null && lng==null) {
              const bounds = new kakao.maps.LatLngBounds();
              markers.slice(0,5000).forEach(m => bounds.extend(m.getPosition()));
              if (!bounds.isEmpty()) map.setBounds(bounds);
            }
          }
        }

        setLoaded(true);
      } catch (e:any) {
        console.error(e);
        setError(e?.message || "지도 로딩 실패");
      }
    })();
  }, []);

  return (
    <div className="relative w-full h-full">
      {!loaded && !error && <div className="absolute inset-0 flex items-center justify-center text-sm text-[#6B7280]">지도를 불러오는 중…</div>}
      {error && <div className="absolute inset-0 flex items-center justify-center px-4 text-center text-sm text-red-600">{error}</div>}
      {count!=null && <div className="absolute left-2 bottom-2 text-xs bg-white/80 border border-gray-200 rounded px-2 py-1">points: {count}</div>}
      <div ref={ref} className={`w-full h-full ${loaded ? "" : "opacity-0"}`} />
    </div>
  );
}

/* ====== Page ====== */
function getParamsForPage(){ const p=new URLSearchParams(window.location.search); return { q:(p.get("q")||"").trim() }; }

export default function MapPage() {
  const { q } = getParamsForPage();
  const onSearch = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const nq = (new FormData(e.currentTarget).get("q") as string)?.trim();
    if (nq) window.location.href = "/map?q=" + encodeURIComponent(nq);
  };

  return (
    <div className="bg-white min-h-[100svh]">
      <div className="sticky top-0 z-10 bg-white border-b border-[#E5E7EB]">
        <div className="mx-auto max-w-[1280px] h-16 flex items-center justify-between px-4">
          <div className="flex items-center gap-2"><Chip>시·군·구 단위</Chip><Chip>패키지 문의</Chip><Chip active>1551 - 1810</Chip></div>
          <div/>
        </div>
      </div>

      <div className="mx-auto max-w-[1280px] px-4 py-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-[320px,1fr]">
          <aside className="md:sticky md:top-16 md:self-start">
            <div className="flex flex-col gap-4">
              <form onSubmit={onSearch} className="relative">
                <input name="q" defaultValue={q} className="w-full h-10 rounded-lg border border-[#E5E7EB] bg-white px-4 pr-10 text-[16px] leading-[24px] text-[#111827] placeholder:text-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#C7B8FF]" placeholder="지역명, 아파트 이름, 단지명, 건물명을 입력해주세요"/>
                <button type="submit" className="absolute right-1 top-1 h-8 w-8 rounded-md flex items-center justify-center text-[#9CA3AF] hover:text-[#6B7280]" aria-label="검색"><SearchIcon/></button>
              </form>

              <section className="rounded-2xl border border-[#E5E7EB] bg-white p-4">
                <div className="mb-3 flex items-center justify-between"><h3 className="text-[16px] font-semibold text-[#111827]">송출 희망일</h3><button className="text-[#9CA3AF] hover:text-[#6B7280]" aria-label="더보기"><DotsIcon/></button></div>
                <button type="button" className="w-full h-10 rounded-lg border border-[#E5E7EB] bg-white px-3 text-left text-[#111827] hover:border-[#D1D5DB] flex items-center gap-2"><CalendarIcon className="text-[#9CA3AF]"/><span>날짜를 선택하세요</span></button>
              </section>

              <section className="rounded-2xl border border-[#E5E7EB] bg-white p-4">
                <div className="flex items-center justify-between"><h3 className="text-[16px] font-semibold text-[#111827]">송 비용</h3><span className="text-sm text-[#6B7280]">총 0건</span></div>
              </section>

              <section className="rounded-2xl border border-[#E5E7EB] bg-white overflow-hidden">
                <div className="h-9 flex items-center px-3 bg-[#F3EEFF] text-[#111827] text-sm">0원 (VAT별도)</div>
                <EmptyCart/>
              </section>
            </div>
          </aside>

          <section className="rounded-2xl border border-[#E5E7EB] overflow-hidden" style={{ height:"calc(100svh - 160px)", minHeight:560 }}>
            <MapCanvas/>
          </section>
        </div>
      </div>
    </div>
  );
}
