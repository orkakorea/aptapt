import { useEffect, useRef, FormEvent } from "react";

/** 전역 지도 SDK(카카오/네이버) 타입 안전용 */
declare global {
  interface Window {
    kakao?: any;
    naver?: any;
  }
}

/** 아이콘들 (SVG 인라인) */
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

/** 칩 버튼 */
function Chip({
  children,
  active = false,
  onClick,
}: { children: React.ReactNode; active?: boolean; onClick?: () => void }) {
  const base = "h-8 px-3 rounded-full text-sm inline-flex items-center justify-center";
  return active ? (
    <button
      type="button"
      onClick={onClick}
      className={`${base} bg-[#7B61FF] text-white hover:bg-[#6A52FF] transition-colors`}
    >
      {children}
    </button>
  ) : (
    <button
      type="button"
      onClick={onClick}
      className={`${base} border border-[#E5E7EB] text-[#111827] bg-white`}
    >
      {children}
    </button>
  );
}

/** 지도 캔버스: 카카오 있으면 카카오, 없고 네이버 있으면 네이버, 없으면 플레이스홀더 */
function MapCanvas() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (window.kakao?.maps) {
      const { kakao } = window as any;
      const center = new kakao.maps.LatLng(37.5665, 126.9780); // 서울시청
      // level: 6 정도가 스샷 느낌
      const map = new kakao.maps.Map(el, { center, level: 6 });
      // TODO: 마커/클러스터는 추후 데이터 연동 시 추가
      void map;
    } else if (window.naver?.maps) {
      const { naver } = window as any;
      const map = new naver.maps.Map(el, {
        center: new naver.maps.LatLng(37.5665, 126.9780),
        zoom: 12,
      });
      void map;
    }
  }, []);

  return <div ref={ref} className="w-full h-full" />;
}

/** 빈 장바구니(아이코닉 일러스트) */
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
        <rect x="8" y="24" width="8" height="4" rx="2" fill="#fff" opacity=".9"/>
        <rect x="26" y="16" width="8" height="4" rx="2" fill="#fff" opacity=".9"/>
        <rect x="36" y="16" width="8" height="4" rx="2" fill="#fff" opacity=".9"/>
        <rect x="48" y="28" width="8" height="4" rx="2" fill="#fff" opacity=".9"/>
      </svg>
      <p className="mt-4 text-sm text-[#9CA3AF] text-center">광고를 원하는 아파트단지를 담아주세요!</p>
    </div>
  );
}

/** /map 페이지 */
export default function MapPage() {
  const onSearch = (e: FormEvent) => e.preventDefault();

  return (
    <div className="bg-white min-h-[100svh]">
      {/* 상단 툴바 (칩 3개) */}
      <div className="sticky top-0 z-10 bg-white border-b border-[#E5E7EB]">
        <div className="mx-auto max-w-[1280px] h-16 flex items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <Chip>시·군·구 단위</Chip>
            <Chip>패키지 문의</Chip>
            <Chip active>1551 - 1810</Chip>
          </div>
          {/* 요구사항: /map 툴바 오른쪽엔 검색 없음 (사이드바에 배치) */}
          <div />
        </div>
      </div>

      {/* 본문 2열 레이아웃 */}
      <div className="mx-auto max-w-[1280px] px-4 py-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-[320px,1fr]">
          {/* 사이드바 */}
          <aside className="md:sticky md:top-16 md:self-start">
            <div className="flex flex-col gap-4">
              {/* 사이드 검색 */}
              <form onSubmit={onSearch} className="relative">
                <input
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

              {/* 카드 1: 송출 희망일 */}
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

              {/* 카드 2: 송 비용 */}
              <section className="rounded-2xl border border-[#E5E7EB] bg-white p-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-[16px] font-semibold text-[#111827]">송 비용</h3>
                  <span className="text-sm text-[#6B7280]">총 0건</span>
                </div>
                {/* 바디 비워둠 (스펙상 Placeholder) */}
              </section>

              {/* 장바구니 영역 */}
              <section className="rounded-2xl border border-[#E5E7EB] bg-white overflow-hidden">
                <div className="h-9 flex items-center px-3 bg-[#F3EEFF] text-[#111827] text-sm">
                  0원 (VAT별도)
                </div>
                <EmptyCart />
              </section>
            </div>
          </aside>

          {/* 지도 영역 */}
          <section
            className="rounded-2xl border border-[#E5E7EB] overflow-hidden"
            style={{
              // Nav(약 56) + Toolbar(64) + 여백(24~40) 보정치. 프로젝트마다 다를 수 있어요.
              height: "calc(100svh - 160px)",
              minHeight: 560,
            }}
          >
            <MapCanvas />
          </section>
        </div>
      </div>
    </div>
  );
}
