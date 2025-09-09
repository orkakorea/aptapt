// src/components/MapChrome.tsx
import React, { useEffect, useMemo, useState } from "react";
import QuoteModal, { QuoteLineItem } from "./QuoteModal";
import { supabase } from "../lib/supabase";

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
const keyName = (s: string) => s.trim().replace(/\s+/g, "").toLowerCase();


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
function classifyProductForPolicy(
  productName?: string,
  installLocation?: string
): keyof DiscountPolicy | undefined {
  const pn = norm(productName);
  const loc = norm(installLocation);
  if (!pn) return undefined;

  if (
    pn.includes("townbord_l") || pn.includes("townboard_l") ||
    /\btownbord[-_\s]?l\b/.test(pn) || /\btownboard[-_\s]?l\b/.test(pn)
  ) return "TOWNBORD_L";
  if (
    pn.includes("townbord_s") || pn.includes("townboard_s") ||
    /\btownbord[-_\s]?s\b/.test(pn) || /\btownboard[-_\s]?s\b/.test(pn)
  ) return "TOWNBORD_S";

  if (pn.includes("elevatortv") || pn.includes("엘리베이터tv") || pn.includes("elevator"))
    return "ELEVATOR TV";
  if (pn.includes("mediameet") || pn.includes("media-meet") || pn.includes("미디어"))
    return "MEDIA MEET";
  if (pn.includes("spaceliving") || pn.includes("스페이스") || pn.includes("living"))
    return "SPACE LIVING";
  if (pn.includes("hipost") || pn.includes("hi-post") || pn.includes("하이포스트"))
    return "HI-POST";

  if (pn.includes("townbord") || pn.includes("townboard") || pn.includes("타운보드")) {
    if (loc.includes("ev내부")) return "TOWNBORD_L";
    if (loc.includes("ev대기공간")) return "TOWNBORD_S";
    return "TOWNBORD_S";
  }

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

/** ====== Supabase 통계 캐시 타입 ====== */
type AptStats = {
  households?: number;
  residents?: number;
  monthlyImpressions?: number;
  monitors?: number;
};

/** ====== 컴포넌트 ====== */
export default function MapChrome({ selected, onCloseSelected, onSearch, initialQuery }: Props) {
  /** 검색어 */
  const [query, setQuery] = useState(initialQuery || "");
    useEffect(() => setQuery(initialQuery || ""), [initialQuery]);

  useEffect(() => {
    if (openQuote && cart.length > 0) {
      fetchStatsByNames(cart.map((c) => c.name));
    }
  }, [openQuote, cart]);


  /** 카트 */
  const [cart, setCart] = useState<CartItem[]>([]);
  const [applyAll, setApplyAll] = useState(true);
  
  /** Supabase에서 받은 단지 통계 캐시 (key = 단지명 정규화) */
type AptStats = {
  households?: number;
  residents?: number;
  monthlyImpressions?: number;
  monitors?: number;
};
const [statsMap, setStatsMap] = useState<Record<string, AptStats>>({});


  /** 견적 모달 on/off */
  const [openQuote, setOpenQuote] = useState(false);

  /** Supabase 통계 캐시: key = 단지명(name) */
  const [statsMap, setStatsMap] = useState<Record<string, AptStats>>({});

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

  /** ===== Supabase: 단지 통계 가져오기 ===== */
  async function fetchStatsByNames(names: string[]) {
    if (!names.length) return;
    const uniq = Array.from(new Set(names));
    const { data, error } = await supabase
      .from("apartments") // ← 실제 테이블명으로 맞추세요
      .select("name, households, residents, monthly_impressions, monitors")
      .in("name", uniq);

    if (error) {
      console.error("[Supabase] fetch error:", error);
      return;
    }
    const map: Record<string, AptStats> = {};
    (data || []).forEach((row: any) => {
      map[row.name] = {
        households: row.households ?? undefined,
        residents: row.residents ?? undefined,
        monthlyImpressions: row.monthly_impressions ?? undefined,
        monitors: row.monitors ?? undefined,
      };
    });
    setStatsMap((prev) => ({ ...prev, ...map }));
  }

  /** 2탭 → 카트 담기 (즉시 Supabase 프리패치 포함) */
  const addSelectedToCart = () => {
    if (!selected) return;

    // ID 안정화(공백 제거/소문자)
    const normKey = (v?: string) => (v ? v.replace(/\s+/g, "").toLowerCase() : "");
    const nameKey = normKey(selected.name || selected.address || "");
    const prodKey = normKey(selected.productName || "");
    const id = [nameKey, prodKey].join("||");

    const productKey = classifyProductForPolicy(
      selected.productName,
      selected.installLocation
    );

    setCart((prev) => {
      const exists = prev.find((x) => x.id === id);
      if (exists) {
        // 이미 있는 항목은 months 보존하고 최신화
        return prev.map((x) =>
          x.id === id
            ? {
                ...x,
                name: selected.name,
                productKey,
                productName: selected.productName,
                baseMonthly: selected.monthlyFee,
              }
            : x
        );
      }
      
// === [추가] 담자마자 selected에 이미 있는 수치를 캐시에 프라임 ===
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
  // Supabase 최신값으로 덮어쓰기
  fetchStatsByNames([selected.name]);
}

// === [추가] 지도 핀 보라색으로 변경 (kakao map 사용 시) ===
try {
  // 마커를 “단지명 그대로 키”로 보관하고 있다면:
  // window.markerMap 또는 props 등 실제 보관 위치에 맞게 수정하세요.
  const mk = (window as any)?.markerMap?.[selected.name];
  if (mk && (window as any).kakao?.maps) {
    const purpleIcon = new (window as any).kakao.maps.MarkerImage(
      "https://t1.daumcdn.net/localimg/localimages/07/mapapidoc/markerStar.png",
      new (window as any).kakao.maps.Size(24, 35)
    );
    mk.setImage(purpleIcon);
  }
} catch (e) {
  console.warn("marker color change skipped:", e);
}

      
      const defaultMonths = prev.length > 0 ? prev[0].months : 1;
      const newItem: CartItem = {
        id,
        name: selected.name,
        productKey,
        productName: selected.productName,
        baseMonthly: selected.monthlyFee,
        months: defaultMonths,
      };

      return [newItem, ...prev];
    });

    
    // ✅ 담자마자 해당 단지 통계 프리패치 (UI 즉시채움)
    fetchStatsByNames([selected.name]);
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

  /** 카트 단지명으로 Supabase에서 통계 일괄 조회 */
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
        households: row["세대수"] ? Number(row["세대수"]) : undefined,
        residents: row["거주인원"] ? Number(row["거주인원"]) : undefined,
        monthlyImpressions: row["송출횟수"] ? Number(row["송출횟수"]) : undefined,
        monitors: row["모니터수량"] ? Number(row["모니터수량"]) : undefined,
      };
    });

    setStatsMap((prev) => ({ ...prev, ...map }));
  }


  /** 모달 오픈 시 카트 목록으로 통계 일괄 동기화 (뒤늦게 담긴 케이스 대비) */
  useEffect(() => {
    if (openQuote && cart.length > 0) {
      fetchStatsByNames(cart.map((c) => c.name));
    }
  }, [openQuote, cart]);

  /** ===== 견적서 모달로 넘길 데이터 빌드 ===== */
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

      // ✅ 모달에 들어갈 통계
      households: s?.households,
      residents: s?.residents,
      monthlyImpressions: s?.monthlyImpressions,
      monitors: s?.monitors,
    };
  });
};

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
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <circle cx="11" cy="11" r="7" stroke="white" strokeWidth="2" />
                <path d="M20 20L17 17" stroke="white" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>
          </div>

          {/* 구좌(T.O) 문의하기 — 카트 없으면 비활성 */}
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
            <div className="text-sm font-semibold">총 비용</div>
            <div className="h-10 rounded-[10px] bg-[#F4F0FB] flex items-center px-3 text-sm text-[#6C2DFF] font-bold">
              {fmtWon(cartTotal)}원 <span className="ml-1 text-[11px] font-normal">(VAT별도)</span>
            </div>
          </div>

          {/* CartBox 본문 */}
          <div className="rounded-2xl border border-[#E5E7EB] bg-white flex-1 min-h-0 overflow-hidden">
            {cart.length === 0 ? (
              <div className="h-full flex items-center justify-center text-sm text-[#6B7280]">
                광고를 원하는 아파트단지를 담아주세요!
              </div>
            ) : (
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
                    <span className={applyAll ? "text-[#6C2DFF] font-medium" : ""}>
                      광고기간 일괄적용
                    </span>
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
                  {fmtWon(selected.monthlyFee)}{" "}
                  <span className="align-baseline text-[11px] text-[#111827] font-normal">(VAT별도)</span>
                </div>
              </div>

              {/* 1년 계약 시 월 광고료 */}
              <div className="rounded-2xl border border-[#7C3AED] bg-[#F4F0FB] h-14 px-4 flex items-center justify-between text-[#7C3AED]">
                <span className="text-sm font-medium">1년 계약 시 월 광고료</span>
                <span className="text-base font-bold">
                  {fmtWon(computedY1)}{" "}
                  <span className="align-baseline text-[11px] font-medium">(VAT별도)</span>
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

      {/* ===== 견적서 모달 ===== */}
      <QuoteModal
        open={openQuote}
        items={buildQuoteItems()}
        onClose={() => setOpenQuote(false)}
        onSubmitInquiry={({ items, subtotal, vat, total }) => {
          console.log("[T.O 문의]", { count: items.length, subtotal, vat, total });
          setOpenQuote(false);
        }}
      />
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

  const monthlyAfter = Math.round((item.baseMonthly ?? 0) * (1 - preRate) * (1 - periodRate));
  const total = monthlyAfter * item.months;

  const discountCombined = 1 - (1 - preRate) * (1 - periodRate);

  return (
    <div className="rounded-2xl border border-[#E5E7EB] bg-white p-4">
      {/* 헤더 */}
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

      {/* 광고기간 */}
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
          {monthlyAfter.toLocaleString()}원{" "}
        </div>
      </div>

      {/* 총광고료 */}
      <div className="mt-2 flex items-center justify-between">
        <div className="text-[#6B7280] text-[13px]">총광고료</div>
        <div className="text-right whitespace-nowrap">
          {discountCombined > 0 ? (
            <span className="inline-flex items-center rounded-md bg-[#F4F0FB] text-[#6C2DFF] text-[11px] font-semibold px-2 py-[2px] mr-2 align-middle">
              {(Math.round(discountCombined * 1000) / 10).toFixed(1).replace(/\.0$/,"")}%할인
            </span>
          ) : null}
          <span className="text-[#6C2DFF] text-base font-bold align-middle">
            {total.toLocaleString()}원
          </span>{" "}
        </div>
      </div>
    </div>
  );
}
