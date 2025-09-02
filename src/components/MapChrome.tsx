// src/components/MapChrome.tsx
import React, { useEffect, useState } from "react";

// 2탭에 표시할 데이터 타입
export type SelectedApt = {
  name: string;               // 단지명
  address?: string;           // 주소
  productName?: string;       // 상품명
  households?: number;        // 세대수
  residents?: number;         // 거주인원
  monitors?: number;          // 모니터수량
  monthlyImpressions?: number;// 월 송출횟수
  hours?: string;             // 운영시간
  lat: number;
  lng: number;
  // (필요시) price, discountedPrice 등을 추가해도 됨
};

type Props = {
  selected?: SelectedApt | null;      // 선택된 단지 (없으면 2탭 숨김)
  onCloseSelected?: () => void;       // 2탭 닫기
  onSearch?: (query: string) => void; // 검색 실행
  initialQuery?: string;              // 초기 검색어 (?q)
};

export default function MapChrome({ selected, onCloseSelected, onSearch, initialQuery }: Props) {
  const [query, setQuery] = useState(initialQuery || "");
  useEffect(() => { setQuery(initialQuery || ""); }, [initialQuery]);

  const runSearch = () => {
    const q = query.trim();
    if (!q) return;
    onSearch?.(q);
  };

  const fmt = (n?: number, suffix = "") =>
    typeof n === "number" && !Number.isNaN(n) ? n.toLocaleString() + (suffix ? ` ${suffix}` : "") : "—";

  return (
    <>
      {/* 상단 바 */}
      <div className="fixed top-0 left-0 right-0 h-16 bg-white border-b border-[#E5E7EB] z-[60]">
        <div className="h-full flex items-center px-6">
          <div className="text-xl font-bold text-black">응답하라-입주민이여</div>
        </div>
      </div>

      {/* 1탭(좌측 패널) */}
      <aside className="hidden md:block fixed top-16 bottom-0 left-0 w-[360px] z-[60] pointer-events-none" data-tab="1">
        <div className="h-full px-6 py-5">
          <div className="pointer-events-auto flex flex-col gap-4">
            {/* 칩들 */}
            <div className="flex items-center gap-2">
              <span className="inline-flex h-8 items-center rounded-full border border-[#E5E7EB] bg-white px-3 text-xs text-[#111827]">시·군·구 단위</span>
              <span className="inline-flex h-8 items-center rounded-full border border-[#E5E7EB] bg-white px-3 text-xs text-[#111827]">패키지 문의</span>
              <span className="inline-flex h-8 items-center rounded-full bg-[#6C2DFF] px-3 text-xs text-white">1551 - 1810</span>
            </div>

            {/* 검색 입력 (동작 연결) */}
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

            {/* 날짜 선택 */}
            <div className="space-y-2">
              <div className="text-sm font-semibold text-black">송출 희망일</div>
              <button
                type="button"
                className="w-full h-12 rounded-[10px] border border-[#E5E7EB] bg-white flex items-center justify-between px-3 text-sm text-[#111827]"
              >
                <span className="text-[#757575]">날짜를 선택하세요</span>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <rect x="3" y="5" width="18" height="16" rx="2" stroke="#757575" strokeWidth="1.5" />
                  <path d="M8 3V7M16 3V7M3 10H21" stroke="#757575" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            {/* 총 비용 */}
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

            {/* 빈 장바구니 카드 */}
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

      {/* 2탭(선택 상세) */}
      {selected && (
        <aside className="hidden md:block fixed top-16 bottom-0 left-[360px] w-[360px] z-[60] pointer-events-none" data-tab="2">
          <div className="h-full px-6 py-5">
            <div className="pointer-events-auto flex flex-col gap-4">
              {/* 썸네일 (샘플 이미지) */}
              <div className="rounded-2xl overflow-hidden border border-[#E5E7EB] bg-[#F3F4F6]">
                <div className="aspect-[4/3] w-full bg-[url('https://images.unsplash.com/photo-1512917774080-9991f1c4c750?q=80&w=1600&auto=format&fit=crop')] bg-cover bg-center" />
              </div>

              {/* 타이틀/메타 + 닫기 */}
              <div>
                <div className="flex items-start justify-between">
                  <div className="text-xl font-bold text-black">{selected.name}</div>
                  <button
                    onClick={onCloseSelected}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-[#E5E7EB] bg-white hover:bg-[#F9FAFB]"
                    aria-label="닫기"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" stroke="currentColor" fill="none">
                      <path d="M6 6L18 18M6 18L18 6" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                  </button>
                </div>
                <div className="mt-1 text-sm text-[#6B7280]">
                  {fmt(selected.households, "세대")} · {fmt(selected.residents, "거주인원")}
                </div>
              </div>

              {/* 가격 영역 (데모: 값 없으면 '—') */}
              <div className="rounded-2xl border border-[#E5E7EB] bg-white p-4">
                <div className="flex items-center justify-between">
                  <div className="text-[#6B7280]">월 광고료</div>
                  <div className="text-lg font-semibold text-black">— (VAT별도)</div>
                </div>
                <div className="mt-4 rounded-xl border border-[#C8B6FF] bg-[#F4F0FB] p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <input type="checkbox" className="accent-[#6C2DFF]" defaultChecked />
                      <span className="text-sm font-medium text-[#6C2DFF]">1년 계약 시 월 광고료</span>
                    </div>
                    <div className="text-base font-bold text-[#6C2DFF]">— (VAT별도)</div>
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
                  <Row label="세대수">{fmt(selected.households, "세대")}</Row>
                  <Row label="거주인원">{fmt(selected.residents, "명")}</Row>
                  <Row label="모니터 수량">{fmt(selected.monitors, "대")}</Row>
                  <Row label="월 송출횟수">{fmt(selected.monthlyImpressions, "회")}</Row>
                  <Row label="운영 시간">{selected.hours || "—"}</Row>
                  <Row label="주소">{selected.address || "—"}</Row>
                </dl>
              </div>
            </div>
          </div>
        </aside>
      )}
    </>
  );
}

/* 내부 전용: 상세정보 행 */
function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-[#F3F4F6] last:border-b-0">
      <dt className="text-[#6B7280]">{label}</dt>
      <dd className="text-black text-right max-w-[55%] truncate">{children}</dd>
    </div>
  );
}
