// src/components/MapChrome.tsx
import React, { useEffect, useMemo, useState } from "react";

/** ===== Selected Apt 타입 ===== */
export type SelectedApt = {
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
};

/** ===== 할인 정책 정의 ===== */
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
const norm = (s?: string) => (s ? s.replace(/\s+/g, "").toLowerCase() : "");
function findRate(rules: RangeRule[] | undefined, months: number): number {
  if (!rules || !Number.isFinite(months)) return 0;
  return rules.find((r) => months >= r.min && months <= r.max)?.rate ?? 0;
}
function classifyProductForPolicy(productName?: string, installLocation?: string): keyof DiscountPolicy | undefined {
  const pn = norm(productName);
  const loc = norm(installLocation);
  if (pn.includes("elevatortv") || pn.includes("엘리베이터tv") || pn.includes("elevator")) return "ELEVATOR TV";
  if (pn.includes("townbord") || pn.includes("townboard") || pn.includes("타운보드")) {
    if (loc.includes("ev내부")) return "TOWNBORD_L";
    if (loc.includes("ev대기공간")) return "TOWNBORD_S";
    return "TOWNBORD_S";
  }
  if (pn.includes("mediameet") || pn.includes("미디어")) return "MEDIA MEET";
  if (pn.includes("spaceliving") || pn.includes("living")) return "SPACE LIVING";
  if (pn.includes("hipost")) return "HI-POST";
  return undefined;
}

/** ===== CartItem 타입 ===== */
type CartItem = {
  id: string;
  name: string;
  productKey?: keyof DiscountPolicy;
  productName?: string;
  baseMonthly?: number;
  months: number;
};

/** ===== MapChrome 컴포넌트 ===== */
export default function MapChrome({ selected, onCloseSelected, onSearch, initialQuery }: Props) {
  const [query, setQuery] = useState(initialQuery || "");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [applyAll, setApplyAll] = useState(true); // 광고기간 일괄적용 체크박스 상태

  const fmtWon = (n?: number) => (typeof n === "number" ? n.toLocaleString() : "—");

  // 총광고료 합계
  const cartTotal = useMemo(() => {
    return cart.reduce((sum, item) => {
      const rule = item.productKey ? DEFAULT_POLICY[item.productKey] : undefined;
      const periodRate = findRate(rule?.period, item.months);
      const preRate = item.productKey === "ELEVATOR TV" ? findRate(rule?.precomp, item.months) : 0;
      const monthlyAfter = (item.baseMonthly ?? 0) * (1 - preRate) * (1 - periodRate);
      return sum + monthlyAfter * item.months;
    }, 0);
  }, [cart]);

  // 담기
  const addSelectedToCart = () => {
    if (!selected) return;
    const key = classifyProductForPolicy(selected.productName, selected.installLocation);
    const id = [selected.name, selected.productName].join("||");
    const item: CartItem = {
      id,
      name: selected.name,
      productKey: key,
      productName: selected.productName,
      baseMonthly: selected.monthlyFee,
      months: 1,
    };
    setCart((prev) => {
      const exists = prev.find((x) => x.id === id);
      if (exists) return prev.map((x) => (x.id === id ? item : x));
      return [item, ...prev];
    });
  };

  // 광고기간 변경
  const updateMonths = (id: string, months: number) => {
    if (applyAll) {
      setCart((prev) => prev.map((x) => ({ ...x, months })));
    } else {
      setCart((prev) => prev.map((x) => (x.id === id ? { ...x, months } : x)));
    }
  };

  const removeItem = (id: string) => {
    setCart((prev) => prev.filter((x) => x.id !== id));
  };

  return (
    <>
      {/* 1탭 왼쪽 */}
      <aside className="fixed top-16 bottom-0 left-0 w-[360px] bg-white border-r border-gray-200 z-50 hidden md:flex flex-col">
        {/* 상단 영역 */}
        <div className="p-5 flex flex-col gap-3">
          <div className="flex gap-2">
            <button className="flex-1 h-9 rounded-md border border-[#E5E7EB] text-sm text-black">
              시·군·구·동 단위 / 패키지 문의
            </button>
            <div className="h-9 px-3 rounded-md bg-[#6C2DFF] flex items-center text-sm text-white font-semibold">
              1551-0810
            </div>
          </div>

          {/* 검색 */}
          <div className="relative">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full h-10 rounded-md border border-gray-300 pl-3 pr-10 text-sm"
              placeholder="지역명, 아파트 이름, 단지명, 건물명"
            />
            <button className="absolute right-2 top-1/2 -translate-y-1/2">
              🔍
            </button>
          </div>

          {/* 구좌(T.O) 문의하기 버튼 */}
          <button
            className={`h-10 rounded-md border text-sm font-medium ${
              cart.length > 0
                ? "bg-[#6C2DFF] text-white border-[#6C2DFF]"
                : "bg-white text-black border-gray-300"
            }`}
          >
            구좌(T.O) 문의하기
          </button>

          {/* 총 비용 */}
          <div>
            <div className="text-sm font-semibold">총 비용 <span className="text-xs text-gray-500">(VAT별도)</span></div>
            <div className="h-10 bg-[#F4F0FB] mt-1 flex items-center px-3 text-[#6C2DFF] font-semibold">
              {fmtWon(cartTotal)}원 <span className="ml-1 text-[11px]">(VAT별도)</span>
            </div>
          </div>
        </div>

        {/* CartBox */}
        <div className="flex-1 overflow-y-auto p-5 pt-0 flex flex-col">
          {cart.length === 0 ? (
            <div className="flex-1 border border-gray-200 rounded-xl flex items-center justify-center text-sm text-gray-500">
              광고를 원하는 아파트단지를 담아주세요!
            </div>
          ) : (
            <>
              {/* 카운터 + 일괄적용 */}
              <div className="flex items-center justify-between text-xs text-gray-500 mb-2">
                <span>총 {cart.length}건</span>
                <label className="flex items-center gap-1 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={applyAll}
                    onChange={(e) => setApplyAll(e.target.checked)}
                  />
                  광고기간 일괄적용
                </label>
              </div>

              <div className="flex flex-col gap-3">
                {cart.map((item) => (
                  <CartItemCard
                    key={item.id}
                    item={item}
                    onChangeMonths={updateMonths}
                    onRemove={removeItem}
                  />
                ))}
              </div>

              <button className="mt-3 h-10 rounded-md border border-[#6C2DFF] text-[#6C2DFF] text-sm font-semibold">
                상품견적 자세히보기
              </button>
            </>
          )}
        </div>
      </aside>

      {/* 2탭 상세 (오른쪽) */}
      {selected && (
        <aside className="fixed top-16 left-[360px] w-[360px] bottom-0 border-r border-gray-200 hidden md:block bg-white">
          <div className="p-5 flex flex-col gap-4 overflow-y-auto h-full">
            <div className="font-bold text-xl">{selected.name}</div>
            <div>월 광고료: {fmtWon(selected.monthlyFee)}원</div>
            <button
              className="h-10 bg-[#6C2DFF] text-white rounded-md"
              onClick={addSelectedToCart}
            >
              아파트 담기
            </button>
          </div>
        </aside>
      )}
    </>
  );
}

/** ===== CartItemCard 컴포넌트 ===== */
function CartItemCard({
  item,
  onChangeMonths,
  onRemove,
}: {
  item: CartItem;
  onChangeMonths: (id: string, months: number) => void;
  onRemove: (id: string) => void;
}) {
  const rule = item.productKey ? DEFAULT_POLICY[item.productKey] : undefined;
  const periodRate = findRate(rule?.period, item.months);
  const preRate = item.productKey === "ELEVATOR TV" ? findRate(rule?.precomp, item.months) : 0;
  const discountCombined = 1 - (1 - preRate) * (1 - periodRate);
  const monthlyAfter = (item.baseMonthly ?? 0) * (1 - preRate) * (1 - periodRate);
  const total = monthlyAfter * item.months;

  return (
    <div className="border border-gray-200 rounded-xl p-4">
      {/* 헤더 */}
      <div className="flex justify-between items-start mb-2">
        <div>
          <div className="font-semibold text-black">{item.name}</div>
          <div className="text-xs text-gray-500">{item.productName}</div>
        </div>
        <button onClick={() => onRemove(item.id)}>❌</button>
      </div>

      {/* 광고기간 */}
      <div className="flex items-center justify-between mt-2">
        <span className="text-sm text-gray-600">광고기간</span>
        <select
          value={item.months}
          onChange={(e) => onChangeMonths(item.id, Number(e.target.value))}
          className="h-8 border rounded px-2 text-sm"
        >
          {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
            <option key={m} value={m}>
              {m}개월
            </option>
          ))}
        </select>
      </div>

      {/* 월광고료 */}
      <div className="flex justify-between mt-3">
        <span className="text-sm text-gray-600">월광고료</span>
        <span className="text-sm font-semibold text-black whitespace-nowrap">
          {monthlyAfter.toLocaleString()}원{" "}
          <span className="text-[11px] text-gray-500">(VAT별도)</span>
        </span>
      </div>

      {/* 총광고료 */}
      <div className="flex justify-between mt-2 items-baseline relative">
        <span className="text-sm text-gray-600">총광고료</span>
        <div className="text-right whitespace-nowrap">
          <span className="text-base font-bold text-[#6C2DFF]">
            {total.toLocaleString()}원
          </span>{" "}
          <span className="text-[11px] text-gray-500">(VAT별도)</span>
        </div>
        {discountCombined > 0 && (
          <span className="absolute -top-3 right-0 bg-[#F4F0FB] text-[#6C2DFF] text-[11px] font-semibold px-2 py-[2px] rounded">
            {(Math.round(discountCombined * 1000) / 10).toFixed(1).replace(/\.0$/, "")}%할인
          </span>
        )}
      </div>
    </div>
  );
}
