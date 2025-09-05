// src/components/MapChrome.tsx
import React, { useEffect, useMemo, useState } from "react";

/** ====== 타입 ====== */
export type SelectedApt = {
  name: string;                // 단지명
  address?: string;            // 주소
  productName?: string;        // 상품명
  installLocation?: string;    // 설치 위치
  monitors?: number;           // 모니터 수량
  monthlyImpressions?: number; // 월 송출횟수
  costPerPlay?: number;        // 송출 1회당 비용
  hours?: string;              // 운영 시간
  households?: number;         // 세대수
  residents?: number;          // 거주인원
  monthlyFee?: number;         // 기본 월 광고료 (할인 전)
  monthlyFeeY1?: number;       // 1년 계약 시 월 광고료(DB가 있으면 우선)
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

/** ====== 정적 에셋 경로 & 유틸 ====== */
const PRIMARY_ASSET_BASE =
  (import.meta as any).env?.VITE_ASSET_BASE || "/products/";
const FALLBACK_ASSET_BASE =
  (import.meta as any).env?.VITE_ASSET_BASE_FALLBACK || "";
const PLACEHOLDER = "/placeholder.svg";

const norm = (s?: string) => (s ? s.replace(/\s+/g, "").toLowerCase() : "");

/** 상품/설치위치 → 썸네일 파일명 매핑 */
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
  if (pn.includes("엘리베이터tv") || pn.includes("elevatortv") || pn.includes("elevator")) return "elevator-tv.png";
  if (pn.includes("hipost") || pn.includes("hi-post") || pn.includes("하이포스트")) return "hi-post.png";
  if (pn.includes("spaceliving") || pn.includes("스페이스") || pn.includes("living")) return "space-living.png";
  return undefined;
}

/** ====== 할인 정책 (기본) ====== */
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

function findRate(rules: RangeRule[] | undefined, months: number): number {
  if (!rules || !Number.isFinite(months)) return 0;
  return rules.find((r) => months >= r.min && months <= r.max)?.rate ?? 0;
}

/** 할인 정책용 제품 키 분류 */
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

/** ====== Cart(작은박스) 타입 ====== */
type CartItem = {
  id: string;                 // name + product 조합
  name: string;
  productKey?: keyof DiscountPolicy;
  productName?: string;
  baseMonthly?: number;       // 기본 월 광고료(할인 전)
  months: number;             // 선택 개월
};

/** ====== 컴포넌트 ====== */
export default function MapChrome({ selected, onCloseSelected, onSearch, initialQuery }: Props) {
  /** 검색어 */
  const [query, setQuery] = useState(initialQuery || "");
  useEffect(() => setQuery(initialQuery || ""), [initialQuery]);

  /** 카트 */
  const [cart, setCart] = useState<CartItem[]>([]);
  const [applyAll, setApplyAll] = useState(true); // 광고기간 일괄적용 체크 (기본 ON)

  /** 포맷터 */
  const fmtNum = (n?: number, unit = "") =>
    typeof n === "number" && Number.isFinite(n)
      ? n.toLocaleString() + (unit ? " " + unit : "")
      : "—";
  const fmtWon = (n?: number) =>
    typeof n === "number" && Number.isFinite(n) ? n.toLocaleString() : "—";

  /** 2탭 썸네일 계산 & 폴백 */
  const matchedFile = resolveProductFile(selected?.productName, selected?.installLocation);
  const initialThumb =
    selected?.imageUrl || (matchedFile ? PRIMARY_ASSET_BASE + matchedFile : PLACEHOLDER);

  /** 2탭 1년 계약 월가 (DB 없을 시 정책으로 계산) */
  const computedY1 = useMemo(() => {
    if (typeof selected?.monthlyFeeY1 === "number" && Number.isFinite(selected.monthlyFeeY1)) {
      return selected.monthlyFeeY1;
    }
    const base = selected?.monthlyFee;
    const key = classifyProductForPolicy(selected?.productName, selected?.installLocation);
    if (!base || !key) return undefined;
    const periodRate = findRate(DEFAULT_POLICY[key].period, 12);
    const preRate = key === "ELEVATOR TV" ? findRate(DEFAULT_POLICY[key].precomp, 12) : 0;
    return Math.round(base * (1 - preRate) * (1 - periodRate));
  }, [selected]);

    /** 카트 총합(총광고료) */
  const cartTotal = useMemo(() => {
    return cart.reduce((sum, item) => {
      const rule = item.productKey ? DEFAULT_POLICY[item.productKey] : undefined;
      const periodRate = findRate(rule?.period, item.months);
      const preRate =
        item.productKey === "ELEVATOR TV" ? findRate(rule?.precomp, item.months) : 0;
      const monthlyAfter = Math.round(
        (item.baseMonthly ?? 0) * (1 - preRate) * (1 - periodRate)
      );
      const total = monthlyAfter * item.months;
      return sum + total;
    }, 0);
  }, [cart]);


  /** 검색 실행 */
  const runSearch = () => {
    const q = query.trim();
    if (!q) return;
    onSearch?.(q);
  };

   /** 2탭 → 카트 담기 */
  const addSelectedToCart = () => {
    if (!selected) return;
    const productKey = classifyProductForPolicy(
      selected.productName,
      selected.installLocation
    );
    const id = [selected.name || "", selected.productName || ""].join("||");

    setCart((prev) => {
      const exists = prev.find((x) => x.id === id);
      if (exists) {
        // ✅ 기존 months는 보존하고 나머지만 최신화
        return prev.map((x) =>
          x.id === id
            ? {
                ...x,
                name: selected.name,
                productKey,
                productName: selected.productName,
                baseMonthly: selected.monthlyFee,
                // months: x.months (보존)
              }
            : x
        );
      }

      // 신규 추가일 때만 months 기본값 1
      const newItem: CartItem = {
        id,
        name: selected.name,
        productKey,
        productName: selected.productName,
        baseMonthly: selected.monthlyFee,
        months: 1,
      };
      return [newItem, ...prev];
    });
  };

  /** 카트 조작 */
  const updateMonths = (id: string, months: number) => {
    if (applyAll) {
      setCart((prev) => prev.map((x) => ({ ...x, months })));
    } else {
      setCart((prev) => prev.map((x) => (x.id === id ? { ...x, months } : x)));
    }
  };
  const removeItem = (id: string) => setCart((prev) => prev.filter((x) => x.id !== id));

  return (
    <>
      {/* ===== 상단 바 ===== */}
      <div className="fixed top-0 left-0 right-0 h-16 bg-white border-b border-[#E5E7EB] z-[60]">
        <div className="h-full flex items-center px-6">
          <div className="text-xl font-bold text-black">응답하라 광고주여</div>
        </div>
      </div>

      {/* ===== 1탭(왼쪽) : CartBox ===== */}
      <aside className="hidden md:flex fixed top-16 bottom-0 left-0 w-[360px] z-[60] bg-white border-r border-[#E5E7EB]">
        <div className="flex flex-col h-full w-full px-5 py-5 gap-3">
          {/* 클릭 박스 + 전화 버튼 */}
          <div className="flex gap-2">
            <button className="flex-1 h-9 rounded-md border border-[#E5E7EB] text-sm text-black">
              시·군·구·동 단위 / 패키지 문의
            </button>
            <a
              href="tel:031-1551-0810"
              className="h-9 px-3 rounded-md bg-[#6C2DFF] flex items-center justify-center text-sm text-white font-semibold"
            >
              1551-0810
            </a>
          </div>

          {/* 검색 */}
          <div className="relative">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && runSearch()}
              className="w-full h-10 rounded-md border border-[#E5E7EB] pl-3 pr-10 text-sm placeholder:text-[#757575] outline-none"
              placeholder="지역명, 아파트 이름, 단지명, 건물명"
            />
            <button
              onClick={runSearch}
              className="absolute right-1 top-1/2 -translate-y-1/2 inline-flex h-8 w-8 items-center justify-center rounded-md bg-[#6C2DFF]"
              aria-label="검색"
            >
              {/* 선(Stroke) 아이콘 */}
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <circle cx="11" cy="11" r="7" stroke="white" strokeWidth="2" />
                <path d="M20 20L17 17" stroke="white" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>
          </div>

          {/* 구좌(T.O) 문의하기 — 카트 없으면 비활성(이미지처럼) */}
          <button
            disabled={cart.length === 0}
            className={`h-10 rounded-md border text-sm font-medium ${
              cart.length > 0
                ? "bg-[#6C2DFF] text-white border-[#6C2DFF]"
                : "bg-white text-black border-[#E5E7EB] cursor-default pointer-events-none"
            }`}
          >
            구좌(T.O) 문의하기
          </button>

          {/* 총 비용 요약 */}
          <div className="space-y-2">
            <div className="text-sm font-semibold">
              총 비용 <span className="text-xs text-[#757575]">(VAT별도)</span>
            </div>
            <div className="h-10 rounded-[10px] bg-[#F4F0FB] flex items-center px-3 text-sm text-[#6C2DFF] font-bold">
              {fmtWon(cartTotal)}원 <span className="ml-1 text-[11px] font-normal">(VAT별도)</span>
            </div>
          </div>

          {/* CartBox 본문: 스크롤 컨테이너 + sticky 하단 버튼 */}
          <div className="rounded-2xl border border-[#E5E7EB] bg-white flex-1 min-h-0 overflow-hidden">
            {cart.length === 0 ? (
              <div className="h-full flex items-center justify-center text-sm text-[#6B7280]">
                광고를 원하는 아파트단지를 담아주세요!
              </div>
            ) : (
              /* 이 div가 스크롤 컨테이너 — 내부의 sticky 버튼이 하단에 고정됨 */
              <div className="h-full overflow-y-auto">
                {/* 카운터 + 일괄적용 */}
                <div className="px-5 pt-5 pb-2 flex items-center justify-between text-xs text-[#757575]">
                  <span>총 {cart.length}건</span>
                  <label className="flex items-center gap-1 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={applyAll}
                      onChange={(e) => setApplyAll(e.target.checked)}
                      className="accent-[#6C2DFF]"
                    />
                    <span className={applyAll ? "text-[#6C2DFF] font-medium" : ""}>광고기간 일괄적용</span>
                  </label>
                </div>

                {/* 리스트 */}
                <div className="px-5 pb-4 space-y-3">
                  {cart.map((item) => (
                    <CartItemCard
                      key={item.id}
                      item={item}
                      onChangeMonths={updateMonths}
                      onRemove={removeItem}
                    />
                  ))}
                </div>

                {/* sticky 하단 버튼 (스크롤 컨테이너 기준) */}
                <div className="sticky bottom-0 bg-white/95 backdrop-blur px-5 pt-3 pb-5 border-t border-[#F3F4F6]">
                  <button
                    type="button"
                    className="h-11 w-full rounded-xl border border-[#6C2DFF] text-[#6C2DFF] font-semibold hover:bg-[#F4F0FB]"
                  >
                    상품견적 자세히보기
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* ===== 2탭(오른쪽 상세 패널) — 완전 복원 ===== */}
      {selected && (
        <aside
          className="hidden md:block fixed top-16 left-[360px] z-[60] w-[360px] pointer-events-none"
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
                      const mf = resolveProductFile(selected?.productName, selected?.installLocation);
                      if (
                        mf &&
                        FALLBACK_ASSET_BASE &&
                        !img.src.startsWith(FALLBACK_ASSET_BASE) &&
                        !img.src.endsWith(PLACEHOLDER)
                      ) {
                        img.onerror = null;
                        img.src = FALLBACK_ASSET_BASE + mf;
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

              {/* 월 광고료 */}
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

              {/* 담기 버튼 */}
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

/** ===== 공용 Row(상세정보) ===== */
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

/** ===== CartItem 카드(작은박스) ===== */
type CartItemCardProps = {
  item: CartItem;
  onChangeMonths: (id: string, months: number) => void;
  onRemove: (id: string) => void;
};
function CartItemCard({ item, onChangeMonths, onRemove }: CartItemCardProps) {
  const rule = item.productKey ? DEFAULT_POLICY[item.productKey] : undefined;
  const periodRate = findRate(rule?.period, item.months);
  const preRate = item.productKey === "ELEVATOR TV" ? findRate(rule?.precomp, item.months) : 0;

  // 월가 반올림 → 총광고료 계산
  const monthlyAfter = Math.round((item.baseMonthly ?? 0) * (1 - preRate) * (1 - periodRate));
  const total = monthlyAfter * item.months;

  const discountCombined = 1 - (1 - preRate) * (1 - periodRate); // 총 할인율(배지)

  return (
    <div className="rounded-2xl border border-[#E5E7EB] bg-white p-4">
      {/* 헤더: 단지명 + 상품명 + X버튼 */}
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <div className="font-semibold text-black leading-tight truncate">{item.name}</div>
          <div className="text-xs text-[#6B7280] mt-0.5 truncate">{item.productName || "—"}</div>
        </div>
        <button
          className="ml-3 inline-flex h-7 w-7 items-center justify-center rounded-md border border-[#E5E7EB] bg-white hover:bg-[#F9FAFB]"
          onClick={() => onRemove(item.id)}
          aria-label="삭제"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" stroke="currentColor" fill="none">
            <path d="M6 6L18 18M6 18L18 6" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {/* 광고기간: 왼쪽 라벨 + 오른쪽 드롭다운 (한 줄) */}
      <div className="mt-3 flex items-center justify-between whitespace-nowrap">
        <span className="text-sm text-[#6B7280]">광고기간</span>
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
    {monthlyAfter.toLocaleString()}원
  </div>
</div>

{/* 총광고료(항상 한 줄) + 할인 배지 값 앞에 인라인 */}
<div className="mt-2 flex items-center justify-between">
  <div className="text-[#6B7280] text-[13px]">총광고료</div>
  <div className="text-right whitespace-nowrap">
    {discountCombined > 0 ? (
      <span className="inline-flex items-center rounded-md bg-[#F4F0FB] text-[#6C2DFF] text-[10px] font-semibold px-1.5 py-[1px] mr-2 align-middle">
        {(Math.round(discountCombined * 1000) / 10).toFixed(1).replace(/\.0$/,"")}%할인
      </span>
    ) : null}
    <span className="text-[#6C2DFF] text-base font-bold align-middle">
      {total.toLocaleString()}원
    </span>
  </div>
</div>
    </div>
  );
}
