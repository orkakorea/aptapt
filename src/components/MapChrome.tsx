// src/components/MapChrome.tsx
import React, { useEffect, useState } from "react";

export type SelectedApt = {
  // 기본 정보
  name: string;                // 단지명
  address?: string;            // 주소

  // 상품/운영 정보
  productName?: string;        // 상품명
  installLocation?: string;    // 설치 위치
  monitors?: number;           // 모니터 수량
  monthlyImpressions?: number; // 월 송출횟수
  costPerPlay?: number;        // 송출 1회당 비용
  hours?: string;              // 운영 시간

  // 지표
  households?: number;         // 세대수
  residents?: number;          // 거주인원

  // 가격
  monthlyFee?: number;         // 월 광고료 (VAT별도)
  monthlyFeeY1?: number;       // 1년 계약 시 월 광고료 (VAT별도)

  // 이미지
  imageUrl?: string;           // DB 썸네일

  // 좌표
  lat: number;
  lng: number;
};

type Props = {
  selected?: SelectedApt | null;
  onCloseSelected?: () => void;
  onSearch?: (query: string) => void;
  initialQuery?: string;
};

/** 정적 에셋 베이스 (Vite: public 폴더는 루트로 서빙됨) */
const ASSET_BASE = (import.meta as any).env?.VITE_ASSET_BASE || "/products/";
const PLACEHOLDER = "/placeholder.svg";

/** ✅ 상품명 키워드 → 이미지 파일 매핑
 *  - 좌측 키워드는 공백제거/소문자 기준으로 includes 매칭
 *  - 파일은 public/products/ 에 넣고 GitHub로 커밋
 *  - 필요시 자유롭게 추가/수정
 */
const PRODUCT_IMAGE_MAP: { keywords: string[]; file: string }[] = [
  { keywords: ["엘리베이터tv", "elevatortv", "elevator"], file: "elevator-tv.png" },
  { keywords: ["타운보드l", "townboardl", "townboard l", "tbl"], file: "townboard-l.png" },
  { keywords: ["타운보드s", "townboards", "townboard s", "tbs"], file: "townboard-s.png" },
  { keywords: ["하이포스트", "hipost", "hi-post"], file: "hi-post.png" },
  { keywords: ["스페이스", "space", "거실", "living"], file: "space-living.png" },
  { keywords: ["미디어", "media"], file: "media-meet-a.png" },
];

/** 상품명으로 썸네일 파일 경로 찾기 */
function fileByProductName(productName?: string): string | undefined {
  if (!productName) return;
  const norm = productName.replace(/\s+/g, "").toLowerCase();
  const hit = PRODUCT_IMAGE_MAP.find(({ keywords }) =>
    keywords.some((k) => norm.includes(k.replace(/\s+/g, "").toLowerCase()))
  );
  return hit ? `${ASSET_BASE}${hit.file}` : undefined;
}

export default function MapChrome({ selected, onCloseSelected, onSearch, initialQuery }: Props) {
  const [query, setQuery] = useState(initialQuery || "");
  useEffect(() => setQuery(initialQuery || ""), [initialQuery]);

  const runSearch = () => {
    const q = query.trim();
    if (!q) return;
    onSearch?.(q);
  };

  // 숫자 + 단위 사이 1칸 공백
  const fmtNum = (n?: number, unit = "") =>
    typeof n === "number" && Number.isFinite(n)
      ? n.toLocaleString() + (unit ? " " + unit : "")
      : "—";
  const fmtWon = (n?: number) =>
    typeof n === "number" && Number.isFinite(n) ? n.toLocaleString() : "—";

  // 최종 썸네일: DB > 상품명 매칭 > 플레이스홀더
  const matched = fileByProductName(selected?.productName);
  const thumb = selected?.imageUrl || matched || PLACEHOLDER;

  return (
    <>
      {/* 상단 바 */}
      <div className="fixed top-0 left-0 right-0 h-16 bg-white border-b border-[#E5E7EB] z-[60]">
        <div className="h-full flex items-center px-6">
          <div className="text-xl font-bold text-black">응답하라-입주민이여</div>
        </div>
      </div>

      {/* 1탭 (왼쪽 고정) */}
      <aside className="hidden md:block fixed top-16 bottom-0 left-0 w-[360px] z-[60] pointer-events-none" data-tab="1">
        <div className="h-full px-6 py-5">
          <div className="pointer-events-auto flex flex-col gap-4">
            {/* 칩 */}
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

            {/* 총 비용 (자리만) */}
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

      {/* 2탭 (오른쪽 상세 패널) */}
      {selected && (
        <aside
          className="hidden md:block fixed top-16 left-[360px] z-[60] w-[360px] pointer-events-none"
          data-tab="2"
          style={{ bottom: 0 }}
        >
          {/* 작은 모니터에서도 스크롤 가능 */}
          <div className="h-full px-6 py-5 max-h-[calc(100vh-4rem)] overflow-y-auto">
            <div className="pointer-events-auto flex flex-col gap-4">
              {/* 썸네일: DB > 상품매칭 > 플레이스홀더. 파일 없으면 onError로 플레이스홀더 폴백 */}
              <div className="rounded-2xl overflow-hidden border border-[#E5E7EB] bg-[#F3F4F6]">
                <div className="relative w-full aspect-[4/3]">
                  <img
                    src={thumb}
                    alt=""
                    onError={(e) => {
                      const img = e.currentTarget;
                      if (img.src.endsWith(PLACEHOLDER)) return;
                      img.onerror = null;
                      img.src = PLACEHOLDER;
                    }}
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                </div>
              </div>

              {/* 타이틀 + 메타 + 닫기 */}
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="text-xl font-bold text-black whitespace-pre-wrap break-words">
                    {selected.name}
                  </div>
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

              {/* 가격 박스 */}
              <div className="rounded-2xl border border-[#E5E7EB] bg-white p-0 overflow-hidden">
                <div className="flex items-center justify-between px-4 h-14 border-b border-[#F3F4F6]">
                  <div className="text-[#6B7280]">월 광고료</div>
                  <div className="text-lg font-semibold text-black">
                    {fmtWon(selected.monthlyFee)} <span className="font-normal text-[#111827]">(VAT별도)</span>
                  </div>
                </div>

                <div className="m-4 rounded-xl border border-[#7C3AED] text-[#7C3AED]">
                  <label className="flex items-center justify-between px-3 h-12">
                    <span className="flex items-center gap-2">
                      <input type="checkbox" className="accent-[#6C2DFF]" defaultChecked />
                      <span className="text-sm font-medium">1년 계약 시 월 광고료</span>
                    </span>
                    <span className="text-base font-bold">
                      {fmtWon(selected.monthlyFeeY1)} <span className="font-medium">(VAT별도)</span>
                    </span>
                  </label>
                </div>

                <div className="px-4 pb-4">
                  <button className="h-12 w-full rounded-xl bg-[#6C2DFF] text-white font-semibold">아파트 담기</button>
                </div>
              </div>

              {/* 상세정보 */}
              <div className="rounded-2xl border border-[#E5E7EB] bg-white overflow-hidden">
                <div className="px-4 py-3 text-base font-semibold text-black border-b border-[#F3F4F6]">상세정보</div>
                <dl className="px-4 py-2 text-sm">
                  {/* 상품명: 줄바꿈 허용 */}
                  <Row label="상품명">
                    <span className="text-[#6C2DFF] font-semibold whitespace-pre-wrap break-words">
                      {selected.productName || "—"}
                    </span>
                  </Row>

                  <Row label="설치 위치">
                    <span className="whitespace-pre-wrap break-words">{selected.installLocation || "—"}</span>
                  </Row>

                  <Row label="모니터 수량">{fmtNum(selected.monitors, "대")}</Row>
                  <Row label="월 송출횟수">{fmtNum(selected.monthlyImpressions, "회")}</Row>
                  <Row label="송출 1회당 비용">{fmtNum(selected.costPerPlay, "원")}</Row>

                  <Row label="운영 시간">
                    <span className="whitespace-pre-wrap break-words">{selected.hours || "—"}</span>
                  </Row>

                  <Row label="주소">
                    <span className="whitespace-pre-wrap break-words">{selected.address || "—"}</span>
                  </Row>
                </dl>
              </div>
            </div>
          </div>
        </aside>
      )}
    </>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between py-3 border-b border-[#F3F4F6] last:border-b-0">
      <dt className="text-[#6B7280]">{label}</dt>
      {/* 줄임표 제거 + 줄바꿈/단어줄바꿈 허용 */}
      <dd className="text-black text-right leading-relaxed max-w-[60%] whitespace-pre-wrap break-words">
        {children}
      </dd>
    </div>
  );
}
