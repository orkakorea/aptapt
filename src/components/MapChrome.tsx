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
  monthlyFee?: number;         // 월 광고료 (VAT별도) — “기본 월” (할인 전)
  monthlyFeeY1?: number;       // 1년 계약 시 월 광고료 (DB 값이 있으면 표시 우선, 상세패널 전용)
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

/** ===== 할인 정책 (환경변수로 덮어쓰기 가능) =====
 *  VITE_CART_DISCOUNT_POLICY_JSON 예시:
 *  {
 *    "ELEVATOR TV": { "precomp": [{"min":1,"max":2,"rate":0.03},{"min":3,"max":12,"rate":0.05}],
 *                     "period":  [{"min":1,"max":2,"rate":0},{"min":3,"max":5,"rate":0.10},{"min":6,"max":11,"rate":0.15},{"min":12,"max":12,"rate":0.20}] },
 *    "TOWNBORD_S":  { "period":  [{"min":1,"max":2,"rate":0},{"min":3,"max":5,"rate":0.10},{"min":6,"max":11,"rate":0.15},{"min":12,"max":12,"rate":0.20}] },
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
    // 얕은 머지(키가 겹치면 덮어씀)
    return { ...DEFAULT_POLICY, ...parsed };
  } catch {
    console.warn("[cart-discount] Failed to parse VITE_CART_DISCOUNT_POLICY_JSON, fallback to defaults.");
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
  for (const r of rules) {
    if (months >= r.min && months <= r.max) return r.rate;
  }
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

  // ==== 검색 ====
  const runSearch = () => {
    const q = query.trim();
    if (!q) return;
    onSearch?.(q);
  };

  // ==== 포맷터 ====
  const fmtNum = (n?: number, unit = "") =>
    typeof n === "number" && Number.isFinite(n)
      ? n.toLocaleString() + (unit ? " " + unit : "")
      : "—";
  const fmtWon = (n?: number) =>
    typeof n === "number" && Number.isFinite(n) ? n.toLocaleString() : "—";

  // ==== 상세패널 썸네일 ====
  const matchedFile = resolveProductFile(selected?.productName, selected?.installLocation);
  const initialThumb =
    selected?.imageUrl ||
    (matchedFile ? PRIMARY_ASSET_BASE + matchedFile : PLACEHOLDER);

  // ==== 1년 월가 (상세패널에만 사용) ====
  const computedY1 = useMemo(() => {
    // 과거 요구사항 호환: DB에 월1년가 있으면 우선
    if (typeof selected?.monthlyFeeY1 === "number" && Number.isFinite(selected.monthlyFeeY1)) {
      return selected.monthlyFeeY1;
    }
    // 정책 기반 12개월 가정(기간할인/사전보상 동시 적용 가능)
    const base = selected?.monthlyFee ?? undefined;
    const key = classifyProductForPolicy(selected?.productName, selected?.installLocation);
    if (!base || !key) return undefined;
    const periodRate = findRate(POLICY[key].period, 12);
    const preRate = key === "ELEVATOR TV" ? findRate(POLICY[key].precomp, 12) : 0;
    const monthlyAfter = base * (1 - preRate) * (1 - periodRate);
    return Math.round(monthlyAfter);
  }, [selected]);

  // ==== 카트 상태 ====
  const [cart, setCart] = useState<CartItem[]>([]);

  // 맵페이지 로딩 시점부터 좌상단에 "총 n건" 고정 표기 필요 → 카운트는 카트 길이로 항상 반영
  const cartCount = cart.length;

  // 카트 합계(총광고료 합)
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

  // 2탭: "아파트 담기"
  const addSelectedToCart = () => {
    if (!selected) return;
    const key = classifyProductForPolicy(selected.productName, selected.installLocation);
    const id = [selected.name || "", key || selected.productName || "", selected.installLocation || ""].join("||");
    const thumb = selected.imageUrl || (resolveProductFile(selected.productName, selected.installLocation)
      ? PRIMARY_ASSET_BASE + String(resolveProductFile(selected.productName, selected.installLocation))
      : undefined);

    setCart((prev) => {
      const existsIdx = prev.findIndex((x) => x.id === id);
      const baseMonthly = selected.monthlyFee ?? 0;
      const nextItem: CartItem = {
        id,
        name: selected.name || "-",
        productKey: key,
        productName: selected.productName,
        installLocation: selected.installLocation,
        address: selected.address,
        baseMonthly,
        months: 1, // 기본 1개월
        thumb,
      };
      if (existsIdx >= 0) {
        // 이미 있으면 맨 위로 갱신 이동
        const clone = [...prev];
        clone.splice(existsIdx, 1);
        return [nextItem, ...clone];
      }
      return [nextItem, ...prev];
    });
  };

  // 카트 아이템 개월 변경
  const updateMonths = (id: string, months: number) => {
    setCart((prev) => prev.map((it) => (it.id === id ? { ...it, months } : it)));
  };

  // 카트 아이템 삭제
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

      {/* 1탭 (왼쪽 고정) → CartBox */}
      <aside className="hidden md:block fixed top-16 bottom-0 left-0 w-[360px] z-[60] pointer-events-none" data-tab="1">
        <div className="h-full px-6 py-5">
          <div className="pointer-events-auto flex flex-col gap-4">
            {/* 칩 영역 (그대로 유지) */}
            <div className="flex items-center gap-2">
              <span className="inline-flex h-8 items-center rounded-full border border-[#E5E7EB] bg-white px-3 text-xs text-[#111827]">시·군·구 단위</span>
              <span className="inline-flex h-8 items-center rounded-full border border-[#E5E7EB] bg-white px-3 text-xs text-[#111827]">패키지 문의</span>
              <span className="inline-flex h-8 items-center rounded-full bg-[#6C2DFF] px-3 text-xs text-white">1551 - 1810</span>
            </div>

            {/* 검색 영역 */}
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

            {/* 총 비용 요약 + 카운터 (고정 표기) */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold text-black">
                  총 비용 <span className="text-xs text-[#757575]">(VAT별도)</span>
                </div>
                {/* ← 이 카운터는 페이지 열리는 시점부터 항상 좌상단(이 블록의 우측) 표기 */}
                <div className="text-xs text-[#757575]">총 {cartCount}건</div>
              </div>
              <div className="h-10 rounded-[10px] bg-[#F4F0FB] flex items-center px-3 text-sm font-semibold text-[#6C2DFF]">
                {fmtWon(cartTotal)}원 (VAT별도)
              </div>
            </div>

            {/* CartBox 본문 */}
            <div className="rounded-2xl border border-[#E5E7EB] bg-white p-5">
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
                <div className="flex flex-col gap-3">
                  <div className="text-xs text-[#757575]">총 {cartCount}건</div>
                  {cart.map((item) => (
                    <CartItemCard
                      key={item.id}
                      item={item}
                      onChangeMonths={updateMonths}
                      onRemove={removeItem}
                    />
                  ))}

                  {/* (선택) 하단 버튼 — 추후 견적서 이동 연결 예정 */}
                  <button
                    type="button"
                    className="mt-2 h-12 w-full rounded-xl border border-[#6C2DFF] text-[#6C2DFF] font-semibold hover:bg-[#F4F0FB]"
                  >
                    상품견적 자세히보기
                  </button>
                </div>
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

/** CartItem 카드 (작은박스) */
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
  const discountCombined = 1 - (1 - preRate) * (1 - periodRate); // 총 할인율
  const monthlyAfter = (item.baseMonthly ?? 0) * (1 - preRate) * (1 - periodRate);
  const total = Math.round(monthlyAfter * item.months);

  return (
    <div className="rounded-2xl border border-[#E5E7EB] bg-white p-4">
      <div className="flex items-start justify-between">
        <div className="font-semibold text-black">{item.name}</div>
        <button
          className="ml-3 inline-flex h-7 w-7 items-center justify-center rounded-md border border-[#E5E7EB] bg-white hover:bg-[#F9FAFB]"
          onClick={() => onRemove(item.id)}
          aria-label="삭제"
          title="삭제"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" stroke="currentColor" fill="none">
            <path d="M6 6L18 18M6 18L18 6" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {/* 광고기간 드롭다운 */}
      <div className="mt-3">
        <label className="block text-xs text-[#6B7280] mb-1">광고기간</label>
        <div className="flex items-center gap-2">
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
      </div>

      {/* 월광고료 */}
      <div className="mt-4 flex items-center justify-between">
        <div className="text-[#6B7280] text-sm">월광고료</div>
        <div className="text-sm font-semibold text-black">
          {Number.isFinite(monthlyAfter) ? monthlyAfter.toLocaleString() : "—"}원 <span className="text-[#757575] font-normal">(VAT별도)</span>
        </div>
      </div>

      {/* 총광고료 + 할인배지 */}
      <div className="mt-2 flex items-center justify-between">
        <div className="text-[#6B7280] text-sm">총광고료</div>
        <div className="text-right">
          {discountCombined > 0 ? (
            <span className="inline-flex items-center rounded-md bg-[#F4F0FB] text-[#6C2DFF] text-xs font-semibold px-2 py-[2px] mr-2">
              {(Math.round(discountCombined * 1000) / 10).toFixed(1).replace(/\.0$/,"")}%할인
            </span>
          ) : null}
          <span className="text-[#6C2DFF] text-base font-bold">
            {Number.isFinite(total) ? total.toLocaleString() : "—"}원
          </span>{" "}
          <span className="text-[#757575] text-sm">(VAT별도)</span>
        </div>
      </div>
    </div>
  );
}
