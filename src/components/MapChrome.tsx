import React, { useEffect, useMemo, useState } from "react";
import QuoteModal, { QuoteLineItem } from "./QuoteModal";
import InquiryModal from "./InquiryModal";
import { supabase } from "@/integrations/supabase/client";
import LoginModal from "@/components/LoginModal";

/** ====== 타입 ====== */
export type SelectedApt = {
  rowKey?: string;
  rowId?: string;
  name: string;
  address?: string;
  productName?: string;
  installLocation?: string;
  monitors?: number;
  monthlyImpressions?: number;
  costPerPlay?: number;
  hours?: string;
  households?: number;
  residents?: number;
  monthlyFee?: number;
  monthlyFeeY1?: number;
  imageUrl?: string;
  lat: number;
  lng: number;
};

type Props = {
  selected?: SelectedApt | null;
  onCloseSelected?: () => void;
  onSearch?: (query: string) => void;
  initialQuery?: string;

  // (구버전 호환)
  setMarkerState?: (name: string, state: "default" | "selected") => void;

  // (신버전) 행(rowKey) 단위로 마커 상태 토글
  setMarkerStateByRowKey?: (rowKey: string, state: "default" | "selected", forceYellowNow?: boolean) => void;
};

/** ====== 정적 에셋 경로 & 유틸 ====== */
const PRIMARY_ASSET_BASE = (import.meta as any).env?.VITE_ASSET_BASE || "/products/";
const FALLBACK_ASSET_BASE = (import.meta as any).env?.VITE_ASSET_BASE_FALLBACK || "";
const PLACEHOLDER = "/placeholder.svg";

const norm = (s?: string) => (s ? s.replace(/\s+/g, "").toLowerCase() : "");
const keyName = (s: string) => s.trim().replace(/\s+/g, "").toLowerCase();

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
      { min: 3, max: 5, rate: 0.1 },
      { min: 6, max: 11, rate: 0.15 },
      { min: 12, max: 12, rate: 0.2 },
    ],
  },
  TOWNBORD_S: {
    period: [
      { min: 1, max: 2, rate: 0 },
      { min: 3, max: 5, rate: 0.1 },
      { min: 6, max: 11, rate: 0.15 },
      { min: 12, max: 12, rate: 0.2 },
    ],
  },
  TOWNBORD_L: {
    period: [
      { min: 1, max: 2, rate: 0 },
      { min: 3, max: 5, rate: 0.1 },
      { min: 6, max: 11, rate: 0.2 },
      { min: 12, max: 12, rate: 0.3 },
    ],
  },
  "MEDIA MEET": {
    period: [
      { min: 1, max: 2, rate: 0 },
      { min: 3, max: 5, rate: 0.1 },
      { min: 6, max: 11, rate: 0.2 },
      { min: 12, max: 12, rate: 0.3 },
    ],
  },
  "SPACE LIVING": {
    period: [
      { min: 1, max: 2, rate: 0 },
      { min: 3, max: 5, rate: 0.1 },
      { min: 6, max: 11, rate: 0.2 },
      { min: 12, max: 12, rate: 0.3 },
    ],
  },
  "HI-POST": {
    period: [
      { min: 1, max: 5, rate: 0 },
      { min: 6, max: 11, rate: 0.05 },
      { min: 12, max: 12, rate: 0.1 },
    ],
  },
};

function findRate(rules: RangeRule[] | undefined, months: number): number {
  if (!rules || !Number.isFinite(months)) return 0;
  return rules.find((r) => months >= r.min && months <= r.max)?.rate ?? 0;
}

function classifyProductForPolicy(productName?: string, installLocation?: string): keyof DiscountPolicy | undefined {
  const pn = norm(productName);
  const loc = norm(installLocation);

  if (!pn) return undefined;

  if (
    pn.includes("townbord_l") ||
    pn.includes("townboard_l") ||
    /\btownbord[-_\s]?l\b/.test(pn) ||
    /\btownboard[-_\s]?l\b/.test(pn)
  )
    return "TOWNBORD_L";
  if (
    pn.includes("townbord_s") ||
    pn.includes("townboard_s") ||
    /\btownbord[-_\s]?s\b/.test(pn) ||
    /\btownboard[-_\s]?s\b/.test(pn)
  )
    return "TOWNBORD_S";

  if (pn.includes("elevatortv") || pn.includes("엘리베이터tv") || pn.includes("elevator")) return "ELEVATOR TV";
  if (pn.includes("mediameet") || pn.includes("media-meet") || pn.includes("미디어")) return "MEDIA MEET";
  if (pn.includes("spaceliving") || pn.includes("스페이스") || pn.includes("living")) return "SPACE LIVING";
  if (pn.includes("hipost") || pn.includes("hi-post") || pn.includes("하이포스트")) return "HI-POST";

  if (pn.includes("townbord") || pn.includes("townboard") || pn.includes("타운보드")) {
    if (loc.includes("ev내부")) return "TOWNBORD_L";
    if (loc.includes("ev대기공간")) return "TOWNBORD_S";
    return "TOWNBORD_S";
  }

  return undefined;
}

/** ====== Cart(작은박스) 타입 ====== */
type CartItem = {
  id: string; // name + product 조합 (UI용)
  rowKey?: string; // 지도 마커 토글용
  name: string;
  productKey?: keyof DiscountPolicy;
  productName?: string;
  baseMonthly?: number;
  months: number;
};

/** ✅ Supabase 통계 캐시 타입 */
type AptStats = {
  households?: number;
  residents?: number;
  monthlyImpressions?: number;
  monitors?: number;
};

/** ====== 컴포넌트 ====== */
export default function MapChrome({
  selected,
  onCloseSelected,
  onSearch,
  initialQuery,
  setMarkerState,
  setMarkerStateByRowKey,
}: Props) {
  /** 검색어 */
  const [query, setQuery] = useState(initialQuery || "");
  useEffect(() => setQuery(initialQuery || ""), [initialQuery]);

  /** 카트 */
  const [cart, setCart] = useState<CartItem[]>([]);
  const [applyAll, setApplyAll] = useState(true);

  /** 모달 */
  const [openQuote, setOpenQuote] = useState(false);
  const [openSeatInquiry, setOpenSeatInquiry] = useState(false);
  const [openPackageInquiry, setOpenPackageInquiry] = useState(false);

  /** Supabase 통계 캐시 */
  const [statsMap, setStatsMap] = useState<Record<string, AptStats>>({});

  /** 포맷터 */
  const fmtNum = (n?: number, unit = "") =>
    typeof n === "number" && Number.isFinite(n) ? n.toLocaleString() + (unit ? " " + unit : "") : "—";
  const fmtWon = (n?: number) => (typeof n === "number" && Number.isFinite(n) ? n.toLocaleString() : "—");

  /** 2탭 썸네일 */
  const matchedFile = resolveProductFile(selected?.productName, selected?.installLocation);
  const initialThumb = selected?.imageUrl || (matchedFile ? PRIMARY_ASSET_BASE + matchedFile : PLACEHOLDER);

  /** 2탭 1년 계약 월가 (DB 없으면 정책 계산) */
  const computedY1 = useMemo(() => {
    if (typeof selected?.monthlyFeeY1 === "number" && Number.isFinite(selected.monthlyFeeY1))
      return selected.monthlyFeeY1;
    const base = selected?.monthlyFee;
    const key = classifyProductForPolicy(selected?.productName, selected?.installLocation);
    if (!base || !key) return undefined;
    const periodRate = findRate(DEFAULT_POLICY[key].period, 12);
    const preRate = key === "ELEVATOR TV" ? findRate(DEFAULT_POLICY[key].precomp, 12) : 0;
    return Math.round(base * (1 - preRate) * (1 - periodRate));
  }, [selected]);

  /** 카트 총합 */
  const cartTotal = useMemo(() => {
    return cart.reduce((sum, item) => {
      const rule = item.productKey ? DEFAULT_POLICY[item.productKey] : undefined;
      const periodRate = findRate(rule?.period, item.months);
      const preRate = item.productKey === "ELEVATOR TV" ? findRate(rule?.precomp, item.months) : 0;
      const monthlyAfter = Math.round((item.baseMonthly ?? 0) * (1 - preRate) * (1 - periodRate));
      return sum + monthlyAfter * item.months;
    }, 0);
  }, [cart]);

  /** 검색 실행 */
  const runSearch = () => {
    const q = query.trim();
    if (!q) return;
    onSearch?.(q);
  };

  /** Supabase 조회 */
  async function fetchStatsByNames(names: string[]) {
    const uniq = Array.from(new Set(names.filter(Boolean)));
    if (!uniq.length) return;

    const { data, error } = await supabase
      .from("raw_places")
      .select("단지명, 세대수, 거주인원, 송출횟수, 모니터수량")
      .in("단지명", uniq);

    if (error) {
      console.error("[Supabase] fetch error:", error);
      return;
    }

    const map: Record<string, AptStats> = {};
    (data || []).forEach((row: any) => {
      const k = keyName(row["단지명"] || "");
      if (!k) return;
      map[k] = {
        households: row["세대수"] != null ? Number(row["세대수"]) : undefined,
        residents: row["거주인원"] != null ? Number(row["거주인원"]) : undefined,
        monthlyImpressions: row["송출횟수"] != null ? Number(row["송출횟수"]) : undefined,
        monitors: row["모니터수량"] != null ? Number(row["모니터수량"]) : undefined,
      };
    });

    setStatsMap((prev) => ({ ...prev, ...map }));
  }

  /** ===== 담기/삭제 유틸 ===== */
  const makeIdFromSelected = (s: SelectedApt) => {
    const nk = (v?: string) => (v ? v.replace(/\s+/g, "").toLowerCase() : "");
    const nameKey = nk(s.name || s.address || "");
    const prodKey = nk(s.productName || "");
    return [nameKey, prodKey].join("||");
  };

  const addSelectedToCart = () => {
    if (!selected) return;
    const id = makeIdFromSelected(selected);
    const productKey = classifyProductForPolicy(selected.productName, selected.installLocation);

    setCart((prev) => {
      const exists = prev.find((x) => x.id === id);
      if (exists) {
        // 이미 있음: months 유지, 나머지 최신화
        return prev.map((x) =>
          x.id === id
            ? {
                ...x,
                rowKey: selected.rowKey ?? x.rowKey,
                name: selected.name,
                productKey,
                productName: selected.productName,
                baseMonthly: selected.monthlyFee,
              }
            : x,
        );
      }

      const defaultMonths = prev.length > 0 ? prev[0].months : 1;
      const newItem: CartItem = {
        id,
        rowKey: selected.rowKey,
        name: selected.name,
        productKey,
        productName: selected.productName,
        baseMonthly: selected.monthlyFee,
        months: defaultMonths,
      };
      return [newItem, ...prev];
    });

    // 통계 캐시 프라임 + 최신값 덮어쓰기
    if (selected?.name) {
      const k = keyName(selected.name);
      setStatsMap((prev) => ({
        ...prev,
        [k]: {
          households: selected.households ?? prev[k]?.households,
          residents: selected.residents ?? prev[k]?.residents,
          monthlyImpressions: selected.monthlyImpressions ?? prev[k]?.monthlyImpressions,
          monitors: selected.monitors ?? prev[k]?.monitors,
        },
      }));
      fetchStatsByNames([selected.name]);
    }

    // 지도 마커 즉시 노란색
    if (selected.rowKey) setMarkerStateByRowKey?.(selected.rowKey, "selected", true);
    else setMarkerState?.(selected.name, "selected");
  };

  const removeItem = (id: string) => {
    setCart((prev) => {
      const removed = prev.find((x) => x.id === id);
      const next = prev.filter((x) => x.id !== id);

      // 같은 rowKey가 더 이상 카트에 없으면 보라 복귀
      if (removed?.rowKey && !next.some((x) => x.rowKey === removed.rowKey)) {
        setMarkerStateByRowKey?.(removed.rowKey, "default");
      } else if (removed?.name && !next.some((x) => x.name === removed.name)) {
        setMarkerState?.(removed.name, "default");
      }
      return next;
    });
  };

  const updateMonths = (id: string, months: number) => {
    if (applyAll) setCart((prev) => prev.map((x) => ({ ...x, months })));
    else setCart((prev) => prev.map((x) => (x.id === id ? { ...x, months } : x)));
  };

  /** 2탭 버튼 상태/동작: 즉시 "담기취소"로 토글 */
  const inCart =
    !!selected && cart.some((c) => c.id === makeIdFromSelected(selected)) // 같은 항목이 카트에 있나?
      ? true
      : false;

  const onClickAddOrCancel = () => {
    if (!selected) return;
    const id = makeIdFromSelected(selected);
    if (inCart) {
      // 담기취소: 카트에서 제거 + 마커 복귀
      removeItem(id);
      if (selected.rowKey) setMarkerStateByRowKey?.(selected.rowKey, "default");
      else setMarkerState?.(selected.name, "default");
    } else {
      // 담기: 즉시 회색 버튼으로 전환되도록 setState 선반영
      addSelectedToCart();
    }
  };

  /** 견적 모달 열릴 때 통계 동기화 */
  useEffect(() => {
    if (openQuote && cart.length > 0) fetchStatsByNames(cart.map((c) => c.name));
  }, [openQuote, cart]);

  /** 견적 데이터 */
  function yyyy_mm_dd(d: Date) {
    const y = d.getFullYear();
    const m = `${d.getMonth() + 1}`.padStart(2, "0");
    const dd = `${d.getDate()}`.padStart(2, "0");
    return `${y}-${m}-${dd}`;
  }
  function addMonths(date: Date, months: number) {
    const d = new Date(date.getTime());
    d.setMonth(d.getMonth() + months);
    return d;
  }
  const buildQuoteItems = (): QuoteLineItem[] => {
    const today = new Date();
    return cart.map((c) => {
      const s = statsMap[keyName(c.name)];
      return {
        id: c.id,
        name: c.name,
        months: c.months,
        startDate: yyyy_mm_dd(today),
        endDate: yyyy_mm_dd(addMonths(today, c.months)),
        mediaName: c.productName,
        baseMonthly: c.baseMonthly,
        productKeyHint: c.productKey,
        households: s?.households,
        residents: s?.residents,
        monthlyImpressions: s?.monthlyImpressions,
        monitors: s?.monitors,
      };
    });
  };

  const buildSeatPrefill = () => {
    const first = cart[0];
    const aptName = selected?.name ?? first?.name ?? null;
    const prodName = selected?.productName ?? first?.productName ?? null;
    const monthsMax = cart.length ? Math.max(...cart.map((c) => c.months ?? 0)) : null;

    return {
      apt_id: aptName,
      apt_name: aptName,
      product_code: prodName ?? undefined,
      product_name: prodName ?? undefined,
      cart_snapshot: cart.length
        ? {
            items: cart,
            months: monthsMax,
            cartTotal: cartTotal,
          }
        : undefined,
    };
  };

  /** ===== 레이아웃 상수(PC) ===== */
  const LEFT_W = 360;
  const RIGHT_W = 360;

  return (
    <>
      {/* ===== 상단 바 ===== */}
      <div className="fixed top-0 left-0 right-0 h-16 bg-white border-b border-[#E5E7EB] z-[60]">
        <div className="h-full flex items-center justify-between px-6">
          <div className="text-xl font-bold text.black">응답하라 입주민이여</div>
          <LoginModal />
        </div>
      </div>

      {/* ===== 1탭(왼쪽) : CartBox ===== */}
      <aside className="hidden md:flex fixed top-16 bottom-0 left-0 w-[360px] z-[60] bg-white border-r border-[#E5E7EB]">
        <div className="flex flex-col h-full w-full px-5 py-5 gap-3">
          {/* 클릭 박스 + 전화 버튼 */}
          <div className="flex gap-2">
            <button
              className="flex-1 h-9 rounded-md border border-[#6C2DFF] text-sm text-[#6C2DFF] hover:bg-[#F4F0FB]"
              onClick={() => setOpenPackageInquiry(true)}
            >
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
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <circle cx="11" cy="11" r="7" stroke="white" strokeWidth="2" />
                <path d="M20 20L17 17" stroke="white" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>
          </div>

          {/* 구좌(T.O) 문의하기 */}
          <button
            disabled={cart.length === 0}
            onClick={() => cart.length > 0 && setOpenSeatInquiry(true)}
            className={`h-10 rounded-md border text-sm font-medium ${
              cart.length > 0
                ? "bg-[#6C2DFF] text-white border-[#6C2DFF]"
                : "bg.white text.black border-[#E5E7EB] cursor-default pointer-events-none"
            }`}
          >
            구좌(T.O) 문의하기
          </button>

          {/* 총 비용 요약 */}
          <div className="space-y-2">
            <div className="text-sm font-semibold">총 비용</div>
            <div className="h-10 rounded-[10px] bg-[#F4F0FB] flex items-center px-3 text-sm text-[#6C2DFF] font-bold">
              {fmtWon(cartTotal)}원 <span className="ml-1 text-[11px] font-normal">(VAT별도)</span>
            </div>
          </div>

          {/* CartBox 본문 */}
          <div className="rounded-2xl border border-[#E5E7EB] bg-white flex-1 min-h-0 overflow-hidden">
            {cart.length === 0 ? (
              /* ✅ 네모 상자 정중앙 안내 */
              <div className="relative h-full">
                <div className="absolute inset-0 grid place-items-center p-6">
                  <div className="w-full max-w-[320px] min-h-[160px] grid place-items-center rounded-2xl border-2 border-dashed border-gray-300 bg-[#FAFAFA] text-gray-600 text-center px-4">
                    광고를 원하는 아파트 단지를 담아주세요
                  </div>
                </div>
              </div>
            ) : (
              <div className="h-full overflow-y-auto">
                {/* ✅ sticky: 총 n건 + 광고기간 일괄적용 */}
                <div className="sticky top-0 z-10 bg-white/95 backdrop-blur px-5 pt-5 pb-2 border-b border-[#F3F4F6]">
                  <div className="flex items-center justify-between text-xs text-[#757575]">
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
                </div>

                {/* 리스트 */}
                <div className="px-5 pb-4 space-y-3">
                  {cart.map((item) => (
                    <CartItemCard key={item.id} item={item} onChangeMonths={updateMonths} onRemove={removeItem} />
                  ))}
                </div>

                {/* sticky 하단 버튼 */}
                <div className="sticky bottom-0 bg-white/95 backdrop-blur px-5 pt-3 pb-5 border-t border-[#F3F4F6]">
                  <button
                    type="button"
                    className="h-11 w-full rounded-xl border border-[#6C2DFF] text-[#6C2DFF] font-semibold hover:bg-[#F4F0FB]"
                    onClick={() => setOpenQuote(true)}
                  >
                    상품견적 자세히보기
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* ===== 2탭(오른쪽 상세 패널) ===== */}
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

              {/* 타이틀 + 닫기 */}
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="text-xl font-bold text-black whitespace-pre-wrap break-words">{selected.name}</div>
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
                  {fmtWon(selected.monthlyFee)}{" "}
                  <span className="align-baseline text-[11px] text-[#111827] font-normal">(VAT별도)</span>
                </div>
              </div>

              {/* 1년 계약 시 월 광고료 */}
              <div className="rounded-2xl border border-[#7C3AED] bg-[#F4F0FB] h-14 px-4 flex items-center justify-between text-[#7C3AED]">
                <span className="text-sm font-medium">1년 계약 시 월 광고료</span>
                <span className="text-base font-bold">
                  {fmtWon(computedY1)} <span className="align-baseline text-[11px] font-medium">(VAT별도)</span>
                </span>
              </div>

              {/* ✅ 담기 버튼 즉시 토글 */}
              <button
                className={`mt-1 h-12 w-full rounded-xl font-semibold transition-colors ${
                  inCart ? "bg-[#E5E7EB] text-[#6B7280]" : "bg-[#6C2DFF] text-white"
                }`}
                onClick={onClickAddOrCancel}
              >
                {inCart ? "담기취소" : "아파트 담기"}
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

      {/* 모달 */}
      <QuoteModal
        open={openQuote}
        items={buildQuoteItems()}
        onClose={() => setOpenQuote(false)}
        onSubmitInquiry={({ items, subtotal, vat, total }) => {
          console.log("[T.O 문의]", { count: items.length, subtotal, vat, total });
          setOpenQuote(false);
          setTimeout(() => setOpenSeatInquiry(true), 0);
        }}
      />
      <InquiryModal
        open={openSeatInquiry}
        mode="SEAT"
        prefill={buildSeatPrefill()}
        onClose={() => setOpenSeatInquiry(false)}
      />
      <InquiryModal open={openPackageInquiry} mode="PACKAGE" onClose={() => setOpenPackageInquiry(false)} />
    </>
  );
}

/** ===== 공용 Row ===== */
function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between py-3 border-b border-[#F4F0F6] last:border-b-0">
      <dt className="text-[#6B7280]">{label}</dt>
      <dd className="text-black text-right leading-relaxed max-w-[60%] whitespace-pre-wrap break-words">{children}</dd>
    </div>
  );
}

/** ===== CartItem 카드 ===== */
type CartItemCardProps = {
  item: CartItem;
  onChangeMonths: (id: string, months: number) => void;
  onRemove: (id: string) => void;
};
function CartItemCard({ item, onChangeMonths, onRemove }: CartItemCardProps) {
  const rule = item.productKey ? DEFAULT_POLICY[item.productKey] : undefined;
  const periodRate = findRate(rule?.period, item.months);
  const preRate = item.productKey === "ELEVATOR TV" ? findRate(rule?.precomp, item.months) : 0;

  const monthlyAfter = Math.round((item.baseMonthly ?? 0) * (1 - preRate) * (1 - periodRate));
  const total = monthlyAfter * item.months;
  const discountCombined = 1 - (1 - preRate) * (1 - periodRate);

  return (
    <div className="rounded-2xl border border-[#E5E7EB] bg-white p-4">
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

      <div className="mt-3 flex items-center justify-between whitespace-nowrap">
        <span className="text-sm text-[#6B7280]">광고기간</span>
        <select
          className="h-9 w-[120px] rounded-md border border-[#E5E7EB] bg-white px-2 text-sm"
          value={item.months}
          onChange={(e) => onChangeMonths(item.id, Number(e.target.value))}
        >
          {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
            <option key={m} value={m}>
              {m}개월
            </option>
          ))}
        </select>
      </div>

      <div className="mt-3 flex items-center justify-between">
        <div className="text-[#6B7280] text-[13px]">월광고료</div>
        <div className="text-sm font-semibold text-black whitespace-nowrap">{monthlyAfter.toLocaleString()}원</div>
      </div>

      <div className="mt-2 flex items-center justify-between">
        <div className="text-[#6B7280] text-[13px]">총광고료</div>
        <div className="text-right whitespace-nowrap">
          {discountCombined > 0 ? (
            <span className="inline-flex items-center rounded-md bg-[#F4F0FB] text-[#6C2DFF] text-[11px] font-semibold px-2 py-[2px] mr-2 align-middle">
              {(Math.round(discountCombined * 1000) / 10).toFixed(1).replace(/\.0$/, "")}%할인
            </span>
          ) : null}
          <span className="text-[#6C2DFF] text-base font-bold align-middle">{total.toLocaleString()}원</span>
        </div>
      </div>
    </div>
  );
}
