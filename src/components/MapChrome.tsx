// src/components/MapChrome.tsx
import React, { useEffect, useState } from "react";

export type SelectedApt = {
  name: string;                // 단지명
  address?: string;            // 주소
  productName?: string;        // 상품명 (예: TOWNBORD, MEDIAMEET, ELEVATOR TV ...)
  installLocation?: string;    // 설치 위치 (예: EV 내부, EV 대기공간)
  monitors?: number;           // 모니터 수량
  monthlyImpressions?: number; // 월 송출횟수
  costPerPlay?: number;        // 송출 1회당 비용
  hours?: string;              // 운영 시간
  households?: number;         // 세대수
  residents?: number;          // 거주인원
  monthlyFee?: number;         // 월 광고료 (VAT별도)
  monthlyFeeY1?: number;       // 1년 계약 시 월 광고료 (DB 값이 있으면 표시 우선)
  imageUrl?: string;           // DB 썸네일
  lat: number;
  lng: number;
};

type Props = {
  selected?: SelectedApt | null;
  onCloseSelected?: () => void;
  onSearch?: (query: string) => void;
  initialQuery?: string;
};

/** 정적 에셋 경로 */
const PRIMARY_ASSET_BASE =
  (import.meta as any).env?.VITE_ASSET_BASE || "/products/";
const FALLBACK_ASSET_BASE =
  (import.meta as any).env?.VITE_ASSET_BASE_FALLBACK || "";
const PLACEHOLDER = "/placeholder.svg";

/** 문자열 정규화 */
const norm = (s?: string) => (s ? s.replace(/\s+/g, "").toLowerCase() : "");

/** 썸네일 매핑(상품+설치위치 분기) */
function resolveProductFile(productName?: string, installLocation?: string): string | undefined {
  const pn = norm(productName);
  const loc = norm(installLocation);

  // TOWNBORD: 설치위치로 L/S 분기
  if (pn.includes("townbord") || pn.includes("townboard") || pn.includes("타운보드")) {
    if (loc.includes("ev내부")) return "townbord-a.png";       // L
    if (loc.includes("ev대기공간")) return "townbord-b.png";   // S
  }

  // MEDIAMEET: a/b 무관히 존재 (설치위치 따라 a/b 썸네일)
  if (pn.includes("mediameet") || pn.includes("media-meet") || pn.includes("미디어")) {
    if (loc.includes("ev내부")) return "media-meet-a.png";
    if (loc.includes("ev대기공간")) return "media-meet-b.png";
    return "media-meet-a.png";
  }

  if (pn.includes("엘리베이터tv") || pn.includes("elevatortv") || pn.includes("elevator"))
    return "elevator-tv.png";
  if (pn.includes("hipost") || pn.includes("hi-post") || pn.includes("하이포스트"))
    return "hi-post.png";
  if (pn.includes("spaceliving") || pn.includes("스페이스") || pn.includes("living"))
    return "space-living.png";

  return undefined;
}

/** ----- 할인 정책 -----
 * 기본값은 아래 객체, 환경변수 VITE_DISCOUNT_POLICY_JSON 로 JSON을 주면 덮어씀.
 *   키: 제품 타입
 *     - "ELEVATOR TV"
 *     - "TOWNBORD_L" / "TOWNBORD_S"
 *     - "MEDIA MEET"
 *     - "HI-POST"
 *     - "SPACE LIVING"
 *   값: 0.3 => 30% 할인
 */
const DEFAULT_DISCOUNT_POLICY: Record<string, number> = {
  "ELEVATOR TV": 0.20,
  "TOWNBORD_S": 0.20,
  "TOWNBORD_L": 0.30,
  "MEDIA MEET": 0.30,
  "HI-POST": 0.10,
  "SPACE LIVING": 0.30,
};
function loadDiscountPolicy(): Record<string, number> {
  const raw = (import.meta as any).env?.VITE_DISCOUNT_POLICY_JSON as string | undefined;
  if (!raw) return DEFAULT_DISCOUNT_POLICY;
  try {
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_DISCOUNT_POLICY, ...parsed };
  } catch {
    console.warn("[discount] Failed to parse VITE_DISCOUNT_POLICY_JSON, using defaults");
    return DEFAULT_DISCOUNT_POLICY;
  }
}
const DISCOUNT_POLICY = loadDiscountPolicy();

/** 제품 타입 분류: 할인 정책 키로 변환 */
function classifyProductForDiscount(productName?: string, installLocation?: string): string | undefined {
  const pn = norm(productName);
  const loc = norm(installLocation);

  if (pn.includes("elevatortv") || pn.includes("엘리베이터tv") || pn.includes("elevator"))
    return "ELEVATOR TV";

  if (pn.includes("townbord") || pn.includes("townboard") || pn.includes("타운보드")) {
    if (loc.includes("ev내부")) return "TOWNBORD_L";
    if (loc.includes("ev대기공간")) return "TOWNBORD_S";
    // 위치 미지정시 보수적으로 S로 간주
    return "TOWNBORD_S";
  }

  if (pn.includes("mediameet") || pn.includes("media-meet") || pn.includes("미디어"))
    return "MEDIA MEET";

  if (pn.includes("hipost") || pn.includes("hi-post") || pn.includes("하이포스트"))
    return "HI-POST";

  if (pn.includes("spaceliving") || pn.includes("스페이스") || pn.includes("living"))
    return "SPACE LIVING";

  return undefined;
}

/** 월 광고료와 분류로 1년가 계산 */
function calcYearlyMonthlyFee(baseMonthly?: number, productName?: string, installLocation?: string): number | undefined {
  if (typeof baseMonthly !== "number" || !Number.isFinite(baseMonthly)) return undefined;
  const key = classifyProductForDiscount(productName, installLocation);
  if (!key) return undefined;
  const rate = DISCOUNT_POLICY[key];
  if (typeof rate !== "number") return undefined;
  // 기본 공식: 월광고료 × (1 - 할인율)
  const discounted = baseMonthly * (1 - rate);
  // 통일감을 위해 원단위 반올림
  return Math.round(discounted);
}

export default function MapChrome({ selected, onCloseSelected, onSearch, initialQuery }: Props) {
  const [query, setQuery] = useState(initialQuery || "");
  useEffect(() => setQuery(initialQuery || ""), [initialQuery]);

  const runSearch = () => {
    const q = query.trim();
    if (!q) return;
    onSearch?.(q);
  };

  // 숫자 + 단위 사이 공백 1칸
  const fmtNum = (n?: number, unit = "") =>
    typeof n === "number" && Number.isFinite(n)
      ? n.toLocaleString() + (unit ? " " + unit : "")
      : "—";
  const fmtWon = (n?: number) =>
    typeof n === "number" && Number.isFinite(n) ? n.toLocaleString() : "—";

  // 썸네일: DB > 상품/위치 분기 > (옵션)대체베이스 > 플레이스홀더
  const matchedFile = resolveProductFile(selected?.productName, selected?.installLocation);
  const initialThumb =
    selected?.imageUrl ||
    (matchedFile ? PRIMARY_ASSET_BASE + matchedFile : PLACEHOLDER);

  // 1년가 계산: DB 값이 있으면 우선, 없으면 정책으로 계산
  const computedY1 =
    typeof selected?.monthlyFeeY1 === "number" && Number.isFinite(selected.monthlyFeeY1)
      ? selected.monthlyFeeY1
      : calcYearlyMonthlyFee(selected?.monthlyFee, selected?.productName, selected?.installLocation);

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
              {/* 썸네일 */}
              <div className="rounded-2xl overflow-hidden border border-[#E5E7EB] bg-[#F3F4F6]">
                <div className="relative w-full aspect-[4/3]">
                  <img
                    src={initialThumb}
                    alt={selected.productName || ""}
                    onError={(e) => {
                      const img = e.currentTarget;
                      if (
                        matchedFile &&
                        FALLBACK_ASSET_BASE &&
                        !img.src.startsWith(FALLBACK_ASSET_BASE) &&
                        !img.src.endsWith(PLACEHOLDER)
                      ) {
                        img.onerror = null;
                        img.src = FALLBACK_ASSET_BASE + matchedFile;
                        return;
                      }
                      if (!img.src.endsWith(PLACEHOLDER)) {
                        img.onerror = null;
                        img.src = PLACEHOLDER;
                      }
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

              {/* 가격 영역 */}
              <div className="rounded-2xl bg-[#F6F7FB] h-14 px-5 flex items-center justify-between">
                <div className="text-[#6B7280]">월 광고료</div>
                <div className="text-lg font-semibold text-black">
                  {fmtWon(selected.monthlyFee)} <span className="font-normal text-[#111827]">(VAT별도)</span>
                </div>
              </div>

              {/* 1년 계약 시 월 광고료 (정책 기반 계산값) */}
              <div className="rounded-2xl border border-[#7C3AED] bg-[#F4F0FB] h-14 px-4 flex items-center justify-between text-[#7C3AED]">
                <span className="text-sm font-medium">1년 계약 시 월 광고료</span>
                <span className="text-base font-bold">
                  {fmtWon(computedY1)} <span className="font-medium">(VAT별도)</span>
                </span>
              </div>

              <button className="mt-1 h-12 w-full rounded-xl bg-[#6C2DFF] text-white font-semibold">
                아파트 담기
              </button>

              {/* 상세정보 */}
              <div className="rounded-2xl border border-[#E5E7EB] bg-white overflow-hidden">
                <div className="px-4 py-3 text-base font-semibold text-black border-b border-[#F3F4F6]">상세정보</div>
                <dl className="px-4 py-2 text-sm">
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
      <dd className="text-black text-right leading-relaxed max-w-[60%] whitespace-pre-wrap break-words">
        {children}
      </dd>
    </div>
  );
}

