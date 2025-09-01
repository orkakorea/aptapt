import React, { useEffect, useRef, useState, FormEvent } from "react";

/* ============== 아이콘 ============== */
const SearchIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" aria-hidden="true" {...props}>
    <path d="M21 21l-4.2-4.2m1.2-4.8a7 7 0 11-14 0 7 7 0 0114 0z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
const CalendarIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true" {...props}>
    <rect x="3" y="5" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.8"/>
    <path d="M3 9h18M8 3v4M16 3v4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
  </svg>
);
const DotsIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true" {...props}>
    <circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/>
  </svg>
);

/* ============== 작은 UI ============== */
function Chip({ children, active = false }: { children: React.ReactNode; active?: boolean }) {
  const base = "h-8 px-3 rounded-full text-sm inline-flex items-center justify-center";
  return active
    ? <button type="button" className={`${base} bg-[#7B61FF] text-white hover:bg-[#6A52FF] transition-colors`}>{children}</button>
    : <button type="button" className={`${base} border border-[#E5E7EB] text-[#111827] bg-white`}>{children}</button>;
}
function EmptyCart() {
  return (
    <div className="flex h-[220px] flex-col items-center justify-center">
      <svg width="56" height="56" viewBox="0 0 56 56" aria-hidden="true">
        <defs>
          <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#D9CFFF"/><stop offset="100%" stopColor="#BFA6FF"/>
          </linearGradient>
        </defs>
        <rect x="4" y="18" width="16" height="30" rx="4" fill="url(#g1)" />
        <rect x="22" y="10" width="20" height="38" rx="4" fill="url(#g1)" />
        <rect x="44" y="22" width="12" height="26" rx="4" fill="url(#g1)" />
      </svg>
      <p className="mt-4 text-sm text-[#9CA3AF] text-center">광고를 원하는 아파트단지를 담아주세요!</p>
    </div>
  );
}

/* ============== 지도 SDK 로더 ============== */
function ensureKakao(appkey: string) {
  return new Promise<any>((resolve, reject) => {
    const w: any = window;
    if (w.kakao?.maps) {
      if (typeof w.kakao.maps.load === "function") w.kakao.maps.load(() => resolve(w.kakao));
      else resolve(w.kakao);
      return;
    }
    const exist = document.querySelector<HTMLScriptElement>('script[src*="dapi.kakao.com/v2/maps/sdk.js"]');
    const onLoad = () => {
      if (typeof w.kakao?.maps?.load === "function") w.kakao.maps.load(() => resolve(w.kakao));
      else resolve(w.kakao);
    };
    if (exist) {
      exist.addEventListener("load", onLoad, { once: true });
      setTimeout(() => { if (w.kakao?.maps) onLoad(); }, 0);
      return;
    }
    const s = document.createElement("script");
    s.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${appkey}&autoload=false&libraries=services`;
    s.async = true;
    s.onerror = () => reject(new Error("Kakao SDK load failed"));
    s.onload = onLoad;
    document.head.appendChild(s);
  });
}
function ensureNaver(clientId: string) {
  return new Promise<any>((resolve, reject) => {
    const w: any = window;
    if (w.naver?.maps) return resolve(w.naver);
    const exist = document.querySelector<HTMLScriptElement>('script[src*="openapi/v3/maps.js"]');
    const onLoad = () => resolve((window as any).naver);
    if (exist) {
      exist.addEventListener("load", onLoad, { once: true });
      setTimeout(() => { if (w.naver?.maps) onLoad(); }, 0);
      return;
    }
    const s = document.createElement("script");
    s.src = `https://oapi.map.naver.com/openapi/v3/maps.js?ncpClientId=${clientId}`;
    s.async = true;
    s.defer = true;
    s.onerror = () => reject(new Error("Naver SDK load failed"));
    s.onload = onLoad;
    document.head.appendChild(s);
  });
}

/* ============== URL 파라미터 헬퍼 ============== */
function getParams() {
  const p = new URLSearchParams(window.location.search);
  const q = (p.get("q") || "").trim();
  const latRaw = Number(p.get("lat"));
  const lngRaw = Number(p.get("lng"));
  const lat = Number.isFinite(latRaw) ? latRaw : null;
  const lng = Number.isFinite(lngRaw) ? lngRaw : null;
  return { q, lat, lng };
}

/* ============== 지도 캔버스 (지오코딩 포함) ============== */
function MapCanvas() {
  const ref = useRef<HTMLDivElement>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    (async () => {
      try {
        setLoaded(false);
        setError(null);

        const kakaoKey = import.meta.env.VITE_KAKAO_JS_KEY as string | undefined;
        const naverId  = import.meta.env.VITE_NAVER_CLIENT_ID as string | undefined;

        // Kakao 우선
        if (kakaoKey) {
          const kakao = await ensureKakao(kakaoKey);

          const map = new kakao.maps.Map(el, {
            center: new kakao.maps.LatLng(37.5665, 126.9780), // 기본: 시청
            level: 6,
          });

          const { q, lat, lng } = getParams();
          const centerTo = (la: number, ln: number) => {
            const pt = new kakao.maps.LatLng(la, ln);
            map.setCenter(pt);
            new kakao.maps.Marker({ position: pt }).setMap(map);
          };

          if (lat != null && lng != null) {
            centerTo(lat, lng);
          } else if (q) {
            // 주소 → 좌표
            const geocoder = new kakao.maps.services.Geocoder();
            geocoder.addressSearch(q, (result: any[], status: string) => {
              if (status === kakao.maps.services.Status.OK && result.length) {
                const r0 = result[0];
                centerTo(Number(r0.y), Number(r0.x));
              } else {
                // 키워드(역/건물명 등) → 좌표
                const places = new kakao.maps.services.Places();
                places.keywordSearch(q, (data: any[], stat: string) => {
                  if (stat === kakao.maps.services.Status.OK && data.length) {
                    const d0 = data[0];
                    centerTo(Number(d0.y), Number(d0.x));
                  }
                });
              }
            });
          }

          setLoaded(true);
          return;
        }

        // Naver만 쓰는 경우 (기본 중심)
        if (naverId) {
          const naver = await ensureNaver(naverId);
          new naver.maps.Map(el, {
            center: new naver.maps.LatLng(37.5665, 126.9780),
            zoom: 12,
          });
          setLoaded(true);
          return;
        }

        setError("지도를 불러오려면 .env에 VITE_KAKAO_JS_KEY 또는 VITE_NAVER_CLIENT_ID를 설정하세요.");
      } catch (e: any) {
        setError(e?.message || "지도 로딩 실패");
      }
    })();
  }, []);

  return (
    <div className="relative w-full h-full">
      {!loaded && !error && (
        <div className="absolute inset-0 flex items-center justify-center text-sm text-[#6B7280]">
          지도를 불러오는 중…
        </div>
      )}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center px-4 text-center text-sm text-red-600">
          {error}
        </div>
      )}
      <div ref={ref} className={`w-full h-full ${loaded ? "" : "opacity-0"}`} />
    </div>
  );
}

/* ============== /map 페이지 ============== */
export default function MapPage() {
  const params = getParams();

  const onSearch = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const q = new FormData(e.currentTarget).get("q") as string;
    if (q?.trim()) window.location.href = "/map?q=" + encodeURIComponent(q.trim());
  };

  return (
    <div className="bg-white min-h-[100svh]">
      {/* 상단 툴바 */}
      <div className="sticky top-0 z-10 bg-white border-b border-[#E5E7EB]">
        <div className="mx-auto max-w-[1280px] h-16 flex items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <Chip>시·군·구 단위</Chip>
            <Chip>패키지 문의</Chip>
            <Chip active>1551 - 1810</Chip>
          </div>
          <div /> {/* 오른쪽 비움 */}
        </div>
      </div>

      {/* 본문 2열 레이아웃 */}
      <div className="mx-auto max-w-[1280px] px-4 py-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-[320px,1fr]">
          {/* 왼쪽 사이드바 */}
          <aside className="md:sticky md:top-16 md:self-start">
            <div className="flex flex-col gap-4">
              {/* 검색 */}
              <form onSubmit={onSearch} className="relative">
                <input
                  name="q"
                  defaultValue={params.q}
                  type="text"
                  placeholder="지역명, 아파트 이름, 단지명, 건물명을 입력해주세요"
                  className="w-full h-10 rounded-lg border border-[#E5E7EB] bg-white px-4 pr-10 text-[16px] leading-[24px] text-[#111827] placeholder:text-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#C7B8FF]"
                  aria-label="검색어 입력"
                />
                <button
                  type="submit"
                  aria-label="검색"
                  className="absolute right-1 top-1 h-8 w-8 rounded-md flex items-center justify-center text-[#9CA3AF] hover:text-[#6B7280] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C7B8FF]"
                >
                  <SearchIcon />
                </button>
              </form>

              {/* 카드 1 — 송출 희망일 */}
              <section className="rounded-2xl border border-[#E5E7EB] bg-white p-4">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-[16px] font-semibold text-[#111827]">송출 희망일</h3>
                  <button className="text-[#9CA3AF] hover:text-[#6B7280]" aria-label="더보기">
                    <DotsIcon />
                  </button>
                </div>
                <button
                  type="button"
                  className="w-full h-10 rounded-lg border border-[#E5E7EB] bg-white px-3 text-left text-[#111827] hover:border-[#D1D5DB] flex items-center gap-2"
                >
                  <CalendarIcon className="text-[#9CA3AF]" />
                  <span>날짜를 선택하세요</span>
                </button>
              </section>

              {/* 카드 2 — 송 비용 */}
              <section className="rounded-2xl border border-[#E5E7EB] bg-white p-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-[16px] font-semibold text-[#111827]">송 비용</h3>
                  <span className="text-sm text-[#6B7280]">총 0건</span>
                </div>
              </section>

              {/* 장바구니 */}
              <section className="rounded-2xl border border-[#E5E7EB] bg-white overflow-hidden">
                <div className="h-9 flex items-center px-3 bg-[#F3EEFF] text-[#111827] text-sm">
                  0원 (VAT별도)
                </div>
                <EmptyCart />
              </section>
            </div>
          </aside>

          {/* 우측 지도 */}
          <section
            className="rounded-2xl border border-[#E5E7EB] overflow-hidden"
            style={{ height: "calc(100svh - 160px)", minHeight: 560 }}
          >
            <MapCanvas />
          </section>
        </div>
      </div>
    </div>
  );
}
