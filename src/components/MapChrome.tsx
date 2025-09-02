// src/components/MapChrome.tsx
import React, { useEffect, useRef, useState } from "react";

export type SelectedApt = {
  name: string;               // 단지명
  address?: string;           // 주소
  productName?: string;       // 상품명
  households?: number;        // 세대수
  residents?: number;         // 거주인원
  monitors?: number;          // 모니터수량
  monthlyImpressions?: number;// 월 송출횟수
  hours?: string;             // 운영시간
  monthlyFee?: number;        // 월 광고료 (VAT별도)
  monthlyFeeY1?: number;      // 1년 계약 시 월 광고료 (VAT별도)
  imageUrl?: string;          // DB 이미지 URL(있으면 최우선 폴백)
  lat: number;
  lng: number;
};

type Props = {
  selected?: SelectedApt | null;
  onCloseSelected?: () => void;
  onSearch?: (query: string) => void;
  initialQuery?: string;
};

// (옵션) 상품명 → 이미지 폴백 매핑
const PRODUCT_IMAGE_MAP = [
  { match: (n: string) => n.includes("타운보드s") || n.includes("townboards"), src: "/products/townboard-s.jpg" },
  { match: (n: string) => n.includes("타운보드l") || n.includes("townboardl"), src: "/products/townboard-l.jpg" },
  { match: (n: string) => n.includes("엘리베이터tv") || n.includes("elevatortv") || n.includes("elevator"), src: "/products/elevator-tv.jpg" },
];

function imageByProductName(name?: string): string | undefined {
  if (!name) return;
  const norm = name.replace(/\s+/g, "").toLowerCase();
  const hit = PRODUCT_IMAGE_MAP.find((r) => r.match(norm));
  return hit?.src;
}

export default function MapChrome({ selected, onCloseSelected, onSearch, initialQuery }: Props) {
  const [query, setQuery] = useState(initialQuery || "");
  useEffect(() => { setQuery(initialQuery || ""); }, [initialQuery]);

  const runSearch = () => {
    const q = query.trim();
    if (!q) return;
    onSearch?.(q);
  };

  const fmtNum = (n?: number, unit = "") =>
    typeof n === "number" && Number.isFinite(n) ? n.toLocaleString() + unit : "—";
  const fmtWon = (n?: number) =>
    typeof n === "number" && Number.isFinite(n) ? n.toLocaleString() : "—";

  // ---------- 로드뷰 ----------
  const roadviewRef = useRef<HTMLDivElement | null>(null);
  const [rvReady, setRvReady] = useState(false);   // 로드뷰가 성공적으로 로드됐는지
  const [rvErr, setRvErr] = useState<string | null>(null);

  // 선택이 바뀔 때마다 로드뷰 시도
  useEffect(() => {
    setRvReady(false);
    setRvErr(null);
    const w = window as any;
    const kakao = w?.kakao;
    if (!selected || !kakao?.maps?.Roadview || !roadviewRef.current) return;

    const container = roadviewRef.current;
    container.innerHTML = ""; // 이전 인스턴스 흔적 제거

    const rv = new kakao.maps.Roadview(container);
    const rvClient = new kakao.maps.RoadviewClient();
    const pos = new kakao.maps.LatLng(selected.lat, selected.lng);

    // 반경을 넓혀가며 가장 가까운 파노라마 탐색
    const radii = [50, 100, 200, 400];
    let canceled = false;

    function tryFind(i: number) {
      if (canceled) return;
      if (i >= radii.length) {
        setRvReady(false);
        setRvErr("no pano");
        return;
      }
      rvClient.getNearestPanoId(pos, radii[i], (panoId: number | null) => {
        if (canceled) return;
        if (!panoId) return tryFind(i + 1);
        try {
          rv.setPanoId(panoId, pos);
          setRvReady(true);
          // 컨테이너가 레이아웃 잡힌 뒤 리레이아웃
          setTimeout(() => { try { rv.relayout(); } catch {} }, 0);
        } catch (e: any) {
          setRvReady(false);
          setRvErr(e?.message || "rv set failed");
        }
      });
    }
    tryFind(0);

    const onResize = () => { try { rv.relayout(); } catch {} };
    window.addEventListener("resize", onResize);

    return () => {
      canceled = true;
      window.removeEventListener("resize", onResize);
    };
  }, [selected?.lat, selected?.lng]);

  // 최종 폴백 이미지 (로드뷰 실패 시 사용)
  const fallbackImg =
    selected?.imageUrl ||
    imageByProductName(selected?.productName) ||
    "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?q=80&w=1600&auto=format&fit=crop";

  return (
    <>
      {/* 상단 바 */}
      <div className="fixed top-0 left-0 right-0 h-16 bg-white border-b border-[#E5E7EB] z-[60]">
        <div className="h-full flex items-center px-6">
          <div className="text-xl font-bold text-black">응답하라-입주민이여</div>
        </div>
      </div>

      {/* 1탭 */}
      <aside className="hidden md:block fixed top-16 bottom-0 left-0 w-[360px] z-[60] pointer-events-none" data-tab="1">
        <div className="h-full px-6 py-5">
          <div className="pointer-events-auto flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <span className="inline-flex h-8 items-center rounded-full border border-[#E5E7EB] bg-white px-3 text-xs text-[#111827]">시·군·구 단위</span>
              <span className="inline-flex h-8 items-center rounded-full border border-[#E5E7EB] bg-white px-3 text-xs text-[#111827]">패키지 문의</span>
              <span className="inline-flex h-8 items-center rounded-full bg-[#6C2DFF] px-3 text-xs text-white">1551 - 1810</span>
            </div>

            {/* 검색 */}
            <div className="relative">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && runSearch()}
                className="w-full h-12 rounded-[10px] border border-[#E5E7EB] bg-white pl-4 pr-12 text-sm placeholder:text-[#757575] outline-none focus:ring-2 focus:ring-[#C7B8FF]"
                placeholder="지역명, 아파트 이름, 단지명, 건물명을 입력해주세요"
              />
              <button
                type="button"
                onClick={runSearch}
                className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex h-8 w-8 items-center justify-center rounded-md bg-[#6C2DFF]"
                aria-label="검색"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <circle cx="11" cy="11" r="7" stroke="white" strokeWidth="2" />
                  <path d="M20 20L17 17" stroke="white" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            {/* 총 비용 자리 */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold text-black">
                  총 비용 <span className="text-xs text-[#757575]">(VAT별도)</span>
                </div>
                <div className="text-xs text-[#757575]">총 0건</div>
              </div>
              <div className="h-10 rounded-[10px] bg-[#F4F0FB] flex items-center px-3 text-sm font-semibold text-[#6C2DFF]">
                0원 (VAT별도)
              </div>
            </div>

            {/* 빈 카드 */}
            <div className="rounded-2xl border border-[#E5E7EB] bg-white p-5">
              <div className="h-60 rounded-xl border border-[#E5E7EB] bg-[#FAFAFA] flex flex-col items-center justify-center text-[#6B7280]">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="#6C2DFF" className="mb-2">
                  <path d="M3 21V8a1 1 0 0 1 1-1h6V4a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v17H3Z" opacity=".2" />
                  <path d="M3 21V8a1 1 0 0 1 1-1h6V4a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v17" fill="none" stroke="#6C2DFF" strokeWidth="1.5"/>
                  <path d="M6 10h2M6 13h2M6 16h2M13 7h2M13 10h2M13 13h2M13 16h2" stroke="#6C2DFF" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
                <div className="text-sm text-center leading-relaxed">
                  광고를 원하는<br/>아파트단지를 담아주세요!
                </div>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* 2탭 */}
      {selected && (
        <aside className="hidden md:block fixed top-16 bottom-0 left-[360px] w-[360px] z-[60] pointer-events-none" data-tab="2">
          <div className="h-full px-6 py-5">
            <div className="pointer-events-auto flex flex-col gap-4">
              {/* 🔹 썸네일: 로드뷰 우선, 실패시 이미지 폴백 */}
              <div className="rounded-2xl overflow-hidden border border-[#E5E7EB] bg-[#F3F4F6]">
                <div className="relative w-full aspect-[4/3]">
                  {/* 로드뷰 컨테이너 */}
                  <div
                    ref={roadviewRef}
                    className={`absolute inset-0 ${rvReady ? "" : "hidden"}`}
                    aria-label="roadview"
                  />
                  {/* 폴백 이미지 */}
                  {!rvReady && (
                    <img
                      src={fallbackImg}
                      alt=""
                      className="absolute inset-0 w-full h-full object-cover"
                    />
                  )}
                </div>
              </div>

              {/* 타이틀 + 메타 + 닫기 */}
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="text-xl font-bold text-black truncate">{selected.name}</div>
                  <div className="mt-1 text-sm text-[#6B7280]">
                    {fmtNum(selected.households, "세대")} · {fmtNum(selected.residents, "명")}
                  </div>
                </div>
                <button
                  onClick={onCloseSelected}
                  className="ml-3 inline-flex h-8 w-8 items-center justify-center rounded-md border border-[#E5E7EB] bg-white hover:bg-[#F9FAFB]"
                  aria-label="닫기"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" stroke="currentColor" fill="none">
                    <path d="M6 6L18 18M6 18L18 6" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                </button>
              </div>

              {/* 가격 */}
              <div className="rounded-2xl border border-[#E5E7EB] bg-white p-4">
                <div className="flex items-center justify-between">
                  <div className="text-[#6B7280]">월 광고료</div>
                  <div className="text-lg font-semibold text-black">
                    {fmtWon(selected.monthlyFee)} <span className="font-normal text-[#111827]">(VAT별도)</span>
                  </div>
                </div>
                <div className="mt-4 rounded-xl border border-[#C8B6FF] bg-[#F4F0FB] p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <input type="checkbox" className="accent-[#6C2DFF]" defaultChecked />
                      <span className="text-sm font-medium text-[#6C2DFF]">1년 계약 시 월 광고료</span>
                    </div>
                    <div className="text-base font-bold text-[#6C2DFF]">
                      {fmtWon(selected.monthlyFeeY1)} <span className="font-medium text-[#6C2DFF]">(VAT별도)</span>
                    </div>
                  </div>
                </div>
                <button className="mt-4 h-12 w-full rounded-xl bg-[#6C2DFF] text-white font-semibold">
                  아파트 담기
                </button>
              </div>

              {/* 상세정보 */}
              <div className="rounded-2xl border border-[#E5E7EB] bg-white">
                <div className="px-4 py-3 text-base font-semibold text-black border-b border-[#F3F4F6]">상세정보</div>
                <dl className="px-4 py-2 text-sm">
                  <Row label="상품명">
                    <span className="text-[#6C2DFF] font-semibold">{selected.productName || "—"}</span>
                    <button className="ml-2 inline-flex h-7 px-2 rounded border border-[#E5E7EB] text-xs">상세보기</button>
                  </Row>
                  <Row label="세대수">{fmtNum(selected.households, "세대")}</Row>
                  <Row label="거주인원">{fmtNum(selected.residents, "명")}</Row>
                  <Row label="모니터 수량">{fmtNum(selected.monitors, "대")}</Row>
                  <Row label="월 송출횟수">{fmtNum(selected.monthlyImpressions, "회")}</Row>
                  <Row label="운영 시간">{selected.hours || "—"}</Row>
                  <Row label="주소">{selected.address || "—"}</Row>
                </dl>
              </div>

              {/* 로드뷰 실패 안내(옵션) */}
              {!rvReady && rvErr && (
                <div className="text-xs text-[#9CA3AF] px-1">
                  주변 로드뷰가 없어 준비된 이미지를 표시했습니다.
                </div>
              )}
            </div>
          </div>
        </aside>
      )}
    </>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-[#F3F4F6] last:border-b-0">
      <dt className="text-[#6B7280]">{label}</dt>
      <dd className="text-black text-right max-w-[55%] truncate">{children}</dd>
    </div>
  );
}
