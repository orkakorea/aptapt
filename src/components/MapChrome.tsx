// src/components/MapChrome.tsx
import React, { useEffect, useMemo, useState } from "react";

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
  monthlyFee?: number;         // 월 광고료 (VAT별도, 할인 전 기본 월)
  monthlyFeeY1?: number;       // 1년 계약 시 월 광고료 (상세패널 전용)
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

/** 썸네일 매핑 */
function resolveProductFile(productName?: string, installLocation?: string): string | undefined {
  const pn = norm(productName);
  const loc = norm(installLocation);

  if (pn.includes("townbord") || pn.includes("townboard") || pn.includes("타운보드")) {
    if (loc.includes("ev내부")) return "townbord-a.png";
    if (loc.includes("ev대기공간")) return "townbord-b.png";
  }

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

/** ===== 할인 정책 (환경변수로 덮어쓰기 가능) =====
 *  VITE_CART_DISCOUNT_POLICY_JSON 예시:
 *  {
 *    "ELEVATOR TV": { "precomp":[{"min":1,"max":2,"rate":0.03},{"min":3,"max":12,"rate":0.05}],
 *                     "period":[{"min":1,"max":2,"rate":0},{"min":3,"max":5,"rate":0.1},{"min":6,"max":11,"rate":0.15},{"min":12,"max":12,"rate":0.2}] },
 *    "TOWNBORD_S":  { "period":[ ... ] },
 *    ...
 *  }
 */
type RangeRule = { min: number; max: number; rate: number };
type ProductRules = { precomp?: RangeRule[]; period: RangeRule[] };
type DiscountPolicy = Record<string, ProductRules>;

const DEFAULT_POLICY: DiscountPolicy = {
  "ELEVATOR TV": {
    precomp: [
      { min: 1, max: 2, rate: 0.03 },
      { min: 3, max: 12, rate: 0.05 },
    ],
    period: [
      { min: 1, max: 2, rate: 0 },
      { min: 3, max: 5, rate: 0.10 },
      { min: 6, max: 11, rate: 0.15 },
      { min: 12, max: 12, rate: 0.20 },
    ],
  },
  "TOWNBORD_S": {
    period: [
      { min: 1, max: 2, rate: 0 },
      { min: 3, max: 5, rate: 0.10 },
      { min: 6, max: 11, rate: 0.15 },
      { min: 12, max: 12, rate: 0.20 },
    ],
  },
  "TOWNBORD_L": {
    period: [
      { min: 1, max: 2, rate: 0 },
      { min: 3, max: 5, rate: 0.10 },
      { min: 6, max: 11, rate: 0.20 },
      { min: 12, max: 12, rate: 0.30 },
    ],
  },
  "MEDIA MEET": {
    period: [
      { min: 1, max: 2, rate: 0 },
      { min: 3, max: 5, rate: 0.10 },
      { min: 6, max: 11, rate: 0.20 },
      { min: 12, max: 12, rate: 0.30 },
    ],
  },
  "SPACE LIVING": {
    period: [
      { min: 1, max: 2, rate: 0 },
      { min: 3, max: 5, rate: 0.10 },
      { min: 6, max: 11, rate: 0.20 },
      { min: 12, max: 12, rate: 0.30 },
    ],
  },
  "HI-POST": {
    period: [
      { min: 1, max: 5, rate: 0 },
      { min: 6, max: 11, rate: 0.05 },
      { min: 12, max: 12, rate: 0.10 },
    ],
  },
};

function loadPolicy(): DiscountPolicy {
  const raw = (import.meta as any).env?.VITE_CART_DISCOUNT_POLICY_JSON as string | undefined;
  if (!raw) return DEFAULT_POLICY;
  try {
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_POLICY, ...parsed };
  } catch {
    console.warn("[cart-discount] Failed to parse VITE_CART_DISCOUNT_POLICY_JSON; using defaults.");
    return DEFAULT_POLICY;
  }
}
const POLICY = loadPolicy();

/** 제품 키 분류 (정책용) */
function classifyProductForPolicy(productName?: string, installLocation?: string): keyof DiscountPolicy | undefined {
  const pn = norm(productName);
  const loc = norm(installLocation);
  if (pn.includes("elevatortv") || pn.includes("엘리베이터tv") || pn.includes("elevator")) return "ELEVATOR TV";
  if (pn.includes("townbord") || pn.includes("townboard") || pn.includes("타운보드")) {
    if (loc.includes("ev내부")) return "TOWNBORD_L";
    if (loc.includes("ev대기공간")) return "TOWNBORD_S";
    return "TOWNBORD_S";
  }
  if (pn.includes("mediameet") || pn.includes("media-meet") || pn.includes("미디어")) return "MEDIA MEET";
  if (pn.includes("spaceliving") || pn.includes("스페이스") || pn.includes("living")) return "SPACE LIVING";
  if (pn.includes("hipost") || pn.includes("hi-post") || pn.includes("하이포스트")) return "HI-POST";
  return undefined;
}
function findRate(rules: RangeRule[] | undefined, months: number): number {
  if (!rules || !Number.isFinite(months)) return 0;
  for (const r of rules) if (months >= r.min && months <= r.max) return r.rate;
  return 0;
}

/** === 담기(장바구니) === */
type CartItem = {
  id: string; // unique: name + product + installLocation
  name: string;
  productKey?: keyof DiscountPolicy;
  productName?: string;
  installLocation?: string;
  address?: string;
  baseMonthly?: number; // 기본 월광고료(할인 전)
  months: number;       // 선택된 광고기간
  thumb?: string;
};

export default function MapChrome({ selected, onCloseSelected, onSearch, initialQuery }: Props) {
  const [query, setQuery] = useState(initialQuery || "");
  useEffect(() => setQuery(initialQuery || ""), [initialQuery]);

  // 검색
  const runSearch = () => {
    const q = query.trim();
    if (!q) return;
    onSearch?.(q);
  };

  // 포맷터
  const fmtNum = (n?: number, unit = "") =>
    typeof n === "number" && Number.isFinite(n)
      ? n.toLocaleString() + (unit ? " " + unit : "")
      : "—";
  const fmtWon = (n?: number) =>
    typeof n === "number" && Number.isFinite(n) ? n.toLocaleString() : "—";

  // 상세패널 썸네일
  const matchedFile = resolveProductFile(selected?.productName, selected?.installLocation);
  const initialThumb =
    selected?.imageUrl || (matchedFile ? PRIMARY_ASSET_BASE + matchedFile : PLACEHOLDER);

  // 1년 월가(상세패널 표기)
  const computedY1 = useMemo(() => {
    if (typeof selected?.monthlyFeeY1 === "number" && Number.isFinite(selected.monthlyFeeY1)) {
      return selected.monthlyFeeY1;
    }
    const base = selected?.monthlyFee ?? undefined;
    const key = classifyProductForPolicy(selected?.productName, selected?.installLocation);
    if (!base || !key) return undefined;
    const periodRate = findRate(POLICY[key].period, 12);
    const preRate = key === "ELEVATOR TV" ? findRate(POLICY[key].precomp, 12) : 0;
    const monthlyAfter = base * (1 - preRate) * (1 - periodRate);
    return Math.round(monthlyAfter);
  }, [selected]);

  // 카트 상태
  const [cart, setCart] = useState<CartItem[]>([]);
  const cartTotal = useMemo(() => {
    return cart.reduce((sum, item) => {
      const rule = item.productKey ? POLICY[item.productKey] : undefined;
      const periodRate = findRate(rule?.period, item.months);
      const preRate = item.productKey === "ELEVATOR TV" ? findRate(rule?.precomp, item.months) : 0;
      const monthlyAfter = (item.baseMonthly ?? 0) * (1 - preRate) * (1 - periodRate);
      const total = monthlyAfter * item.months;
      return sum + Math.round(total);
    }, 0);
  }, [cart]);

  // 2탭: 아파트 담기
  const addSelectedToCart = () => {
    if (!selected) return;
    const key = classifyProductForPolicy(selected.productName, selected.installLocation);
    const id = [selected.name || "", key || selected.productName || "", selected.installLocation || ""].join("||");
    const thumb = selected.imageUrl || (resolveProductFile(selected.productName, selected.installLocation)
      ? PRIMARY_ASSET_BASE + String(resolveProductFile(selected.productName, selected.installLocation))
      : undefined);

    setCart((prev) => {
      const existsIdx = prev.findIndex((x) => x.id === id);
      const nextItem: CartItem = {
        id,
        name: selected.name || "-",
        productKey: key,
        productName: selected.productName,
        installLocation: selected.installLocation,
        address: selected.address,
        baseMonthly: selected.monthlyFee ?? 0,
        months: 1,
        thumb,
      };
      if (existsIdx >= 0) {
        const clone = [...prev];
        clone.splice(existsIdx, 1);
        return [nextItem, ...clone];
        // (덮어쓰기 & 맨 위 이동)
      }
      return [nextItem, ...prev];
    });
  };

  // 카트 조작
  const updateMonths = (id: string, months: number) => {
    setCart((prev) => prev.map((it) => (it.id === id ? { ...it, months } : it)));
  };
  const removeItem = (id: string) => {
    setCart((prev) => prev.filter((it) => it.id !== id));
  };

  return (
    <>
      {/* 상단 바 */}
      <div className="fixed top-0 left-0 right-0 h-16 bg-white border-b border-[#E5E7EB] z-[60]">
        <div className="h-full flex items-center px-6">
          <div className="text-xl font-bold text-black">응답하라-입주민이여</div>
        </div>
      </div>

      {/* 1탭 (왼쪽) → CartBox */}
      <aside className="hidden md:block fixed top-16 bottom-0 left-0 w-[360px] z-[60] pointer-events-none" data-tab="1">
        <div className="h-full px-6 py-5">
          <div className="pointer-events-auto flex h-full flex-col gap-4">
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

            {/* 총 비용 요약 (우측 '총 n건' 완전 삭제됨) */}
            <div className="space-y-2">
              <div className="text-sm font-semibold text-black">
                총 비용 <span className="text-xs text-[#757575]">(VAT별도)</span>
              </div>
              <div className="h-10 rounded-[10px] bg-[#F4F0FB] flex items-center px-3 text-sm font-semibold text-[#6C2DFF]">
                {fmtWon(cartTotal)}원 <span className="ml-1 text-[11px] text-[#6C2DFF]">(VAT별도)</span>
              </div>
            </div>

            {/* CartBox (본문) */}
            <div className="rounded-2xl border border-[#E5E7EB] bg-white p-5 flex-1 flex flex-col min-h-0">
              {cart.length === 0 ? (
                // 빈 상태
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
              ) : (
                <>
                  {/* 내부 카운터는 유지(스샷2처럼) */}
                  <div className="text-xs text-[#757575] mb-2">총 {cart.length}건</div>

                  {/* 리스트: 스크롤 가능 */}
                  <div className="flex-1 min-h-0 overflow-y-auto pr-1 space-y-3">
                    {cart.map((item) => (
                      <CartItemCard
                        key={item.id}
                        item={item}
                        onChangeMonths={updateMonths}
                        onRemove={removeItem}
                      />
                    ))}
                  </div>

                  {/* 하단 버튼 (리스트와 분리, 고정) */}
                  <button
                    type="button"
                    className="mt-3 h-12 w-full rounded-xl border border-[#6C2DFF] text-[#6C2DFF] font-semibold hover:bg-[#F4F0FB] shrink-0"
                  >
                    상품견적 자세히보기
                  </button>
                </>
              )}
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
                  {fmtWon(selected.monthlyFee)} <span className="align-baseline text-[11px] text-[#111827] font-normal">(VAT별도)</span>
                </div>
              </div>

              {/* 1년 계약 시 월 광고료 */}
              <div className="rounded-2xl border border-[#7C3AED] bg-[#F4F0FB] h-14 px-4 flex items-center justify-between text-[#7C3AED]">
                <span className="text-sm font-medium">1년 계약 시 월 광고료</span>
                <span className="text-base font-bold">
                  {fmtWon(computedY1)} <span className="align-baseline text-[11px] font-medium">(VAT별도)</span>
                </span>
              </div>

              <button
                className="mt-1 h-12 w-full rounded-xl bg-[#6C2DFF] text-white font-semibold"
                onClick={addSelectedToCart}
              >
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

/** 공용 Row */
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

/** CartItem 카드 */
function CartItemCard({
  item,
  onChangeMonths,
  onRemove,
}: {
  item: CartItem;
  onChangeMonths: (id: string, months: number) => void;
  onRemove: (id: string) => void;
}) {
  const rule = item.productKey ? POLICY[item.productKey] : undefined;
  const periodRate = findRate(rule?.period, item.months);
  const preRate = item.productKey === "ELEVATOR TV" ? findRate(rule?.precomp, item.months) : 0;
  const discountCombined = 1 - (1 - preRate) * (1 - periodRate);
  const monthlyAfter = (item.baseMonthly ?? 0) * (1 - preRate) * (1 - periodRate);
  const total = Math.round(monthlyAfter * item.months);

  return (
    <div className="rounded-2xl border border-[#E5E7EB] bg-white p-4 shadow-[0_0_0_1px_rgba(229,231,235,0.3)]">
      {/* 헤더: 단지명 + 상품명(작게) / 삭제 */}
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <div className="font-semibold text-black leading-tight truncate">
            {item.name}
          </div>
          {/* 상품명: 단지명 바로 아래, 광고기간 텍스트 크기/색상 수준 */}
          <div className="text-xs text-[#6B7280] mt-0.5 truncate">
            {item.productName || "—"}
          </div>
        </div>
        <button
          className="ml-3 inline-flex h-7 w-7 items-center justify-center rounded-md border border-[#E5E7EB] bg-white hover:bg-[#F9FAFB] shrink-0"
          onClick={() => onRemove(item.id)}
          aria-label="삭제"
          title="삭제"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" stroke="currentColor" fill="none">
            <path d="M6 6L18 18M6 18L18 6" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {/* 광고기간: 우측 정렬, 한 줄 */}
      <div className="mt-3 flex items-center justify-end gap-2 whitespace-nowrap">
        <span className="text-xs text-[#6B7280]">광고기간</span>
        <select
          className="h-9 w-[120px] rounded-md border border-[#E5E7EB] bg-white px-2 text-sm"
          value={item.months}
          onChange={(e) => onChangeMonths(item.id, Number(e.target.value))}
        >
          {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
            <option key={m} value={m}>{m}개월</option>
          ))}
        </select>
      </div>

      {/* 월광고료 */}
      <div className="mt-3 flex items-center justify-between">
        <div className="text-[#6B7280] text-[13px]">월광고료</div>
        <div className="text-sm font-semibold text-black whitespace-nowrap">
          {Number.isFinite(monthlyAfter) ? monthlyAfter.toLocaleString() : "—"}원{" "}
          <span className="align-baseline text-[11px] text-[#757575] font-normal">(VAT별도)</span>
        </div>
      </div>

      {/* 총광고료 (한 줄 고정) */}
      <div className="mt-2 flex items-center justify-between">
        <div className="text-[#6B7280] text-[13px]">총광고료</div>
        <div className="text-right whitespace-nowrap">
          {discountCombined > 0 ? (
            <span className="inline-flex items-center rounded-md bg-[#F4F0FB] text-[#6C2DFF] text-[11px] font-semibold px-2 py-[2px] mr-2 align-middle">
              {(Math.round(discountCombined * 1000) / 10).toFixed(1).replace(/\.0$/,"")}%할인
            </span>
          ) : null}
          <span className="text-[#6C2DFF] text-base font-bold align-middle">
            {Number.isFinite(total) ? total.toLocaleString() : "—"}원
          </span>{" "}
          <span className="align-baseline text-[11px] text-[#757575]">(VAT별도)</span>
        </div>
      </div>
    </div>
  );
}
