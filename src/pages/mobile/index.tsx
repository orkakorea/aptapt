// src/pages/mobile/index.tsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";

import BottomSheet from "@/components/mobile/BottomSheet";
import DetailPanel from "@/components/mobile/DetailPanel";
import CartPanel from "@/components/mobile/CartPanel";
import QuotePanel from "@/components/mobile/QuotePanel";
// ✅ 타입만 재사용(컴포넌트는 공용 InquiryModal 사용)
import { type Prefill, type InquiryKind } from "@/components/mobile/MobileInquirySheet";
import InquiryModal from "@/components/InquiryModal";

import { useKakaoLoader } from "@/hooks/useKakaoLoader";
import { useKakaoMap } from "@/hooks/useKakaoMap";
import usePlaceSearch from "@/hooks/usePlaceSearch";
import useMarkers from "@/hooks/useMarkers";
import useUserMarker from "@/hooks/useUserMarker";

import type { SelectedApt, CartItem } from "@/core/types";
import { calcMonthlyWithPolicy, normPolicyKey, DEFAULT_POLICY, rateFromRanges } from "@/core/pricing";

const COLOR_PRIMARY = "#6F4BF2";

type ActiveTab = "detail" | "cart" | "quote";

/* ============================================================
 * ✅ 추가: selected 정규화(키 이름/중첩 차이吸収, DetailPanel 표준키 보장)
 * ============================================================ */
function getField(obj: any, keys: string[]) {
  for (const k of keys) {
    try {
      const v = k.split(".").reduce((o: any, p: string) => (o == null ? undefined : o[p]), obj);
      if (v !== undefined && v !== null && v !== "") return v;
    } catch {}
  }
  return undefined;
}

function normalizeSelected(apt: any): SelectedApt {
  const name =
    (getField(apt, ["name", "aptName", "apt_name", "title", "aptTitle", "apt_title", "properties.name", "meta.name"]) ??
      apt?.name) ||
    "미상";

  const productName =
    getField(apt, ["productName", "product_name", "product", "mediaName", "media_name", "properties.productName"]) ??
    apt?.productName;

  const imageUrl =
    getField(apt, ["imageUrl", "image_url", "thumbnail", "thumb", "images.0", "meta.imageUrl"]) ?? apt?.imageUrl;

  const address = getField(apt, ["address", "addr", "주소", "properties.address"]) ?? apt?.address;
  const installLocation =
    getField(apt, ["installLocation", "install_location", "설치위치", "properties.installLocation"]) ??
    apt?.installLocation;

  const households =
    getField(apt, ["households", "세대수", "properties.households"]) ?? (apt?.households as number | undefined);
  const residents =
    getField(apt, ["residents", "거주인원", "properties.residents"]) ?? (apt?.residents as number | undefined);

  const monitors = getField(apt, ["monitors", "monitorCount", "properties.monitors"]) ?? apt?.monitors;
  const monthlyImpressions =
    getField(apt, [
      "monthlyImpressions",
      "impressions_month",
      "monthly_impressions",
      "properties.monthlyImpressions",
    ]) ?? apt?.monthlyImpressions;
  const costPerPlay =
    getField(apt, ["costPerPlay", "cpp", "cost_per_play", "properties.costPerPlay"]) ?? apt?.costPerPlay;
  const hours = getField(apt, ["hours", "operating_hours", "properties.hours"]) ?? apt?.hours;

  const monthlyFee = apt?.monthlyFee;
  const monthlyFeeY1 = apt?.monthlyFeeY1;

  const lat = apt?.lat;
  const lng = apt?.lng;

  const rowKey = apt?.rowKey;
  const rowId = apt?.rowId;

  return {
    // 원본 속성 유지
    ...apt,
    // 표준 키 보장
    name,
    productName,
    imageUrl,
    address,
    installLocation,
    households,
    residents,
    monitors,
    monthlyImpressions,
    costPerPlay,
    hours,
    monthlyFee,
    monthlyFeeY1,
    lat,
    lng,
    rowKey,
    rowId,
  } as SelectedApt;
}

export default function MapMobilePageV2() {
  /** =========================
   * Kakao 지도
   * ========================= */
  const mapRef = useRef<HTMLDivElement | null>(null);
  const { kakao, error: kakaoError } = useKakaoLoader();
  const { map, clusterer } = useKakaoMap(mapRef, {
    kakao,
    center: { lat: 37.5665, lng: 126.978 },
    level: 6,
    idleDebounceMs: 150,
  });

  /** 내 위치(버튼 클릭 시 단발 요청) */
  const { locateNow } = useUserMarker({ kakao, map, autoCenterOnFirstFix: false, watch: false });

  /** =========================
   * 검색
   * ========================= */
  const [searchQ, setSearchQ] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchAreaRef = useRef<HTMLDivElement>(null);
  const search = usePlaceSearch({ kakao, map, defaultLevel: 4, smoothPan: true });

  /** ✅ 초기 검색어 적용 — /mobile?q=... 로 진입하면 자동 실행 */
  const [searchParams] = useSearchParams();
  const initialQ = (searchParams.get("q") || "").trim();
  useEffect(() => {
    const ready = !!(kakao && map);
    if (!ready) return;
    if (!initialQ) return;

    setSearchQ(initialQ);
    try {
      searchInputRef.current?.blur();
      (document.activeElement as HTMLElement | null)?.blur?.();
    } catch {}
    (async () => {
      try {
        await search.run(initialQ);
      } catch {}
    })();
  }, [kakao, map, initialQ, search]);

  /** =========================
   * 선택/카트
   * ========================= */
  const [selected, setSelected] = useState<SelectedApt | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const selectedRowKeys = useMemo(() => cart.map((c) => c.rowKey), [cart]);

  /** =========================
   * 문의 시트
   * ========================= */
  const [inqOpen, setInqOpen] = useState(false);
  const [inqMode, setInqMode] = useState<InquiryKind>("SEAT");
  const [inqPrefill, setInqPrefill] = useState<Prefill | undefined>(undefined);

  /** =========================
   * 바텀시트 상태
   * ========================= */
  const [sheetOpen, setSheetOpen] = useState(false);
  const sheetOpenRef = useRef(false);
  const [activeTab, setActiveTab] = useState<ActiveTab>("detail");

  const phoneBtnRef = useRef<HTMLAnchorElement>(null);
  const [sheetMaxH, setSheetMaxH] = useState<number>(() =>
    Math.max(320, Math.floor((typeof window !== "undefined" ? window.innerHeight : 800) * 0.75)),
  );

  const recalcSheetMax = useCallback(() => {
    const winH = typeof window !== "undefined" ? window.innerHeight : 800;
    const rect = phoneBtnRef.current?.getBoundingClientRect();
    const topEdge = rect ? Math.max(0, rect.bottom + 8) : Math.floor(winH * 0.25);
    const h = Math.max(320, winH - topEdge);
    setSheetMaxH(h);
  }, []);

  useEffect(() => {
    sheetOpenRef.current = sheetOpen;
    if (sheetOpen) recalcSheetMax();
  }, [sheetOpen, recalcSheetMax]);

  /** =========================
   * 마커
   * ========================= */
  const markers = useMarkers({
    kakao,
    map,
    clusterer,
    onSelect: (apt) => {
      // ✅ 변경: 표준화 후 상태 반영(단지명/상품명/이미지 누락 방지)
      const norm = normalizeSelected(apt);
      setSelected(norm);
      setActiveTab("detail");
      setSheetOpen(true);
      recalcSheetMax();
    },
    externalSelectedRowKeys: selectedRowKeys,
  });

  useEffect(() => {
    if (map && kakao) {
      setTimeout(() => {
        try {
          markers.refreshInBounds();
        } catch {}
      }, 0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, kakao]);

  /** 리사이즈 */
  useEffect(() => {
    const onResize = () => recalcSheetMax();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [recalcSheetMax]);

  /** =========================
   * 뒤로가기 & beforeunload 가드 (전화 클릭 예외)
   * ========================= */
  const [exitAsk, setExitAsk] = useState(false);
  const popHandlerRef = useRef<(e: PopStateEvent) => void>();
  const allowUnloadRef = useRef(false);

  useEffect(() => {
    history.pushState({ guard: true }, "");
    const onPop = () => {
      if (sheetOpenRef.current) {
        setSheetOpen(false);
        history.pushState({ guard: true }, "");
        return;
      }
      history.pushState({ guard: true }, "");
      setExitAsk(true);
    };
    popHandlerRef.current = onPop;
    window.addEventListener("popstate", onPop);

    const onBeforeUnload = (ev: BeforeUnloadEvent) => {
      if (allowUnloadRef.current) return;
      ev.preventDefault();
      ev.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);

    return () => {
      const h = popHandlerRef.current;
      if (h) window.removeEventListener("popstate", h);
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, []);

  /** 시트 외부 클릭 시 검색창 blur */
  useEffect(() => {
    const blurActive = () => {
      const el = document.activeElement as HTMLElement | null;
      if (el && typeof el.blur === "function") el.blur();
    };
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (searchAreaRef.current?.contains(target)) return;
      blurActive();
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => document.removeEventListener("pointerdown", onPointerDown, true);
  }, []);

  /** 검색 실행 + blur */
  const runSearchAndBlur = useCallback(async () => {
    try {
      searchInputRef.current?.blur();
      (document.activeElement as HTMLElement | null)?.blur?.();
      await search.run(searchQ);
    } catch {}
  }, [searchQ, search]);

  /** =========================
   * 카트 조작
   * ========================= */
  const isInCart = useCallback((rowKey?: string | null) => !!rowKey && cart.some((c) => c.rowKey === rowKey), [cart]);

  // 담기 시 항상 1개월 기본 (시트 닫지 않음)
  const addSelectedToCart = useCallback(() => {
    if (!selected) return;
    const next: CartItem = {
      rowKey: selected.rowKey,
      aptName: selected.name, // ✅ normalizeSelected로 보장된 단지명 사용
      productName: selected.productName ?? "기본상품",
      months: 1,
      baseMonthly: selected.monthlyFee ?? 0,
      monthlyFeeY1: selected.monthlyFeeY1 ?? undefined,
    };
    setCart((prev) => [next, ...prev.filter((c) => c.rowKey !== next.rowKey)]);
  }, [selected]);

  const removeFromCart = useCallback((rowKey: string) => {
    setCart((prev) => prev.filter((c) => c.rowKey !== rowKey));
  }, []);

  const [applyAll, setApplyAll] = useState(true);

  const updateMonths = useCallback(
    (rowKey: string, months: number) => {
      setCart((prev) => {
        if (applyAll) return prev.map((c) => ({ ...c, months }));
        return prev.map((c) => (c.rowKey === rowKey ? { ...c, months } : c));
      });
    },
    [applyAll],
  );

  /** =========================
   * 할인/총액 계산
   * ========================= */
  type ComputedItem = Omit<CartItem, "productName" | "baseMonthly"> & {
    productName: string;
    baseMonthly: number;
    _monthly: number;
    _discountRate: number;
    _total: number;
    discPeriodRate?: number;
    discPrecompRate?: number;
  };

  const computedCart: ComputedItem[] = useMemo(() => {
    const cnt = new Map<string, number>();
    cart.forEach((c) => {
      const k = normPolicyKey(c.productName);
      cnt.set(k, (cnt.get(k) ?? 0) + 1);
    });

    return cart.map((c) => {
      const key = normPolicyKey(c.productName);
      const same = cnt.get(key) ?? 1;

      const name = c.productName ?? "기본상품";
      const base = c.baseMonthly ?? 0;

      // 총 할인 적용 월가/율
      const { monthly, rate } = calcMonthlyWithPolicy(name, c.months, base, c.monthlyFeeY1, same);

      // 분리 할인률(표시용)
      const rules: any = (DEFAULT_POLICY as any)[key as any];
      const discPeriodRate = rateFromRanges(rules?.period, c.months);
      const discPrecompRate = rateFromRanges(rules?.precomp, same);

      return {
        ...c,
        productName: name,
        baseMonthly: base,
        _monthly: monthly,
        _discountRate: rate,
        _total: monthly * c.months,
        discPeriodRate,
        discPrecompRate,
      };
    });
  }, [cart]);

  const totalCost = useMemo(() => computedCart.reduce((s, c) => s + c._total, 0), [computedCart]);

  /** 장바구니 → 특정 단지로 이동 */
  const goToRowKey = useCallback(
    (rk: string) => {
      markers.selectByRowKey(rk);
      setActiveTab("detail");
      setSheetOpen(true);
      recalcSheetMax();
    },
    [markers, recalcSheetMax],
  );

  // 바텀시트 스크롤 초기화 키
  const resetScrollKey = `${sheetOpen ? 1 : 0}-${activeTab}-${selected?.rowKey ?? ""}`;

  // Kakao 준비 여부 (버튼 가드)
  const kakaoReady = !!(kakao && map);

  /** =========================
   * 카트 → 문의 prefill 스냅샷
   * ========================= */
  const buildCartSnapshot = useCallback((items: typeof computedCart, total: number) => {
    const monthsMax = items.reduce((m, it) => Math.max(m, Number(it.months || 0)), 0);
    return {
      months: monthsMax || undefined,
      cartTotal: total,
      items: items.map((it) => ({
        apt_name: it.aptName,
        product_name: it.productName ?? undefined,
        product_code: normPolicyKey(it.productName),
        months: it.months,
        item_total_won: it._total,
        total_won: it._total,
      })),
    };
  }, []);

  /** =========================
   * 렌더
   * ========================= */
  return (
    <div className="w-screen h-[100dvh] bg-white">
      {/* 상단바 */}
      <div className="fixed top-0 left-0 right-0 z-[40] bg-white border-b">
        <div className="h-14 px-3 flex items-center justify-between">
          <div className="font-extrabold text-[15px]">응답하라 입주민이여</div>
          <button
            className="px-3 py-1 rounded-full border text-sm font-semibold"
            onClick={() => {
              // 바텀시트가 열려 있으면 닫고 문의 시트만 띄움
              setSheetOpen(false);
              setInqMode("PACKAGE");
              setInqPrefill(undefined);
              setInqOpen(true);
            }}
          >
            패키지 문의
          </button>
        </div>
      </div>

      {/* 지도 */}
      <div ref={mapRef} className="fixed top-[56px] left-0 right-0 bottom-0 z-[10]" aria-label="map" />

      {/* 검색창 */}
      <div ref={searchAreaRef} className="fixed z-[35] left-3 right-[76px] top-[64px] pointer-events-none">
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            await runSearchAndBlur();
          }}
          className="pointer-events-auto"
        >
          <input
            ref={searchInputRef}
            value={searchQ}
            onChange={(e) => setSearchQ(e.target.value)}
            placeholder="지역명, 아파트 이름, 단지명, 건물명"
            className="w-full h-11 px-4 rounded-xl border outline-none bg-white/95"
            style={{ borderColor: "#E8E0FF" }}
          />
        </form>
      </div>

      {/* 우측 버튼 스택 */}
      <div className="fixed z-[35] right-3 top-[64px] pointer-events-none">
        <div className="flex flex-col gap-2 pointer-events-auto">
          {/* 검색 */}
          <button
            onClick={runSearchAndBlur}
            className="w-11 h-11 rounded-full flex items-center justify-center text-white shadow"
            style={{ backgroundColor: COLOR_PRIMARY }}
            aria-label="검색"
            title="검색"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
              <circle cx="10" cy="10" r="6" stroke="currentColor" strokeWidth="2" />
              <line x1="14.5" y1="14.5" x2="20" y2="20" stroke="currentColor" strokeWidth="2" />
            </svg>
          </button>

          {/* 카트 */}
          <button
            onClick={() => {
              setActiveTab("cart");
              setSheetOpen(true);
              recalcSheetMax();
            }}
            className="relative w-11 h-11 rounded-full flex items-center justify-center text-white shadow"
            style={{ backgroundColor: COLOR_PRIMARY }}
            aria-label="카트"
            title="카트"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
              <rect x="5" y="7" width="12" height="8" rx="1.5" stroke="currentColor" strokeWidth="2" />
              <circle cx="9" cy="18" r="1.5" fill="currentColor" />
              <circle cx="15" cy="18" r="1.5" fill="currentColor" />
              <line x1="3" y1="5" x2="6" y2="7" stroke="currentColor" strokeWidth="2" />
            </svg>
            {cart.length > 0 && (
              <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 rounded-full bg-[#FF3B30] text-[10px] font-bold flex items-center justify-center">
                {cart.length > 99 ? "99+" : cart.length}
              </span>
            )}
          </button>

          {/* 전화 */}
          <a
            ref={phoneBtnRef}
            href="tel:1551-0810"
            onClick={() => {
              const el = document.activeElement as HTMLElement | null;
              el?.blur?.();
              allowUnloadRef.current = true;
              setTimeout(() => (allowUnloadRef.current = false), 2000);
            }}
            className="w-11 h-11 rounded-full flex items-center justify-center text-white shadow"
            style={{ backgroundColor: COLOR_PRIMARY }}
            aria-label="전화 연결"
            title="전화 연결"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
              <rect x="5" y="3" width="14" height="18" rx="3" stroke="currentColor" strokeWidth="2" />
              <rect x="9" y="6" width="6" height="1.5" rx="0.75" fill="currentColor" />
              <circle cx="12" cy="18" r="1.2" fill="currentColor" />
            </svg>
          </a>

          {/* 내 위치 */}
          <button
            onClick={() => {
              const el = document.activeElement as HTMLElement | null;
              el?.blur?.();
              if (kakaoReady) locateNow();
            }}
            disabled={!kakaoReady}
            className="w-11 h-11 rounded-full flex items-center justify-center text-white shadow disabled:opacity-50"
            style={{ backgroundColor: COLOR_PRIMARY }}
            aria-label="내 위치로 이동"
            title="내 위치로 이동"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
              <circle cx="12" cy="12" r="3" fill="currentColor" />
              <circle cx="12" cy="12" r="7" stroke="currentColor" strokeWidth="2" />
              <line x1="12" y1="2" x2="12" y2="5" stroke="currentColor" strokeWidth="2" />
              <line x1="12" y1="19" x2="12" y2="22" stroke="currentColor" strokeWidth="2" />
              <line x1="2" y1="12" x2="5" y2="12" stroke="currentColor" strokeWidth="2" />
              <line x1="19" y1="12" x2="22" y2="12" stroke="currentColor" strokeWidth="2" />
            </svg>
          </button>
        </div>
      </div>

      {/* 시트 외부 클릭 닫힘 */}
      {sheetOpen && <div className="fixed inset-0 z-[50] bg-black/0" onClick={() => setSheetOpen(false)} />}

      {/* 바텀시트 */}
      <BottomSheet
        open={sheetOpen}
        maxHeightPx={sheetMaxH}
        onClose={() => setSheetOpen(false)}
        resetScrollKey={resetScrollKey}
      >
        {/* 탭 헤더 */}
        <div className="sticky top-0 z-20 px-4 pt-1 pb-2 bg-white border-b">
          <div className="flex items-center gap-2">
            <TabBtn active={activeTab === "detail"} onClick={() => setActiveTab("detail")} label="단지상세" />
            <TabBtn active={activeTab === "cart"} onClick={() => setActiveTab("cart")} label="장바구니" />
            <TabBtn active={activeTab === "quote"} onClick={() => setActiveTab("quote")} label="견적상세" />
            <div className="ml-auto">
              <button
                onClick={() => setSheetOpen(false)}
                aria-label="닫기"
                title="닫기"
                className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <line x1="6" y1="6" x2="18" y2="18" stroke="currentColor" strokeWidth="2" />
                  <line x1="18" y1="6" x2="6" y2="18" stroke="currentColor" strokeWidth="2" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* 본문 */}
        <div className="px-4 pb-4">
          {activeTab === "detail" && (
            <DetailPanel
              selected={selected}
              inCart={isInCart(selected?.rowKey)}
              onToggleCart={() => {
                if (!selected) return;
                if (isInCart(selected.rowKey)) {
                  removeFromCart(selected.rowKey);
                } else {
                  addSelectedToCart();
                }
              }}
            />
          )}

          {activeTab === "cart" && (
            <CartPanel
              cart={computedCart}
              totalCost={totalCost}
              applyAll={applyAll}
              onToggleApplyAll={setApplyAll}
              onUpdateMonths={updateMonths}
              onRemove={removeFromCart}
              onGoTo={goToRowKey}
            />
          )}

          {activeTab === "quote" && (
            <QuotePanel
              items={computedCart}
              total={totalCost}
              brandColor={COLOR_PRIMARY}
              onGoTo={goToRowKey}
              onInquiry={() => {
                if (!computedCart.length) {
                  setActiveTab("cart");
                  setSheetOpen(true);
                  return;
                }
                const first = computedCart[0];
                setInqMode("SEAT");
                setInqPrefill({
                  apt_id: null,
                  apt_name: first?.aptName ?? null,
                  product_code: first?.productName ? normPolicyKey(first.productName) : null,
                  product_name: first?.productName ?? null,
                  cart_snapshot: buildCartSnapshot(computedCart, totalCost),
                });

                setSheetOpen(false);
                setInqOpen(true);
              }}
            />
          )}
        </div>
      </BottomSheet>

      {/* SDK 에러 토스트 */}
      {kakaoError && (
        <div className="fixed bottom-4 right-4 z-[100] rounded-lg bg-red-600 text-white px-3 py-2 text-sm shadow">
          Kakao SDK 오류: {kakaoError}
        </div>
      )}

      {/* 종료 확인 모달 */}
      {exitAsk && (
        <ConfirmExitModal
          onCancel={() => setExitAsk(false)}
          onConfirm={() => {
            const h = popHandlerRef.current;
            if (h) window.removeEventListener("popstate", h);
            setExitAsk(false);
            setTimeout(() => history.back(), 0);
          }}
        />
      )}

      {/* ✅ 모바일 문의: 공용 InquiryModal 사용 (UI 변경 없음) */}
      <InquiryModal
        open={inqOpen}
        mode={inqMode}
        prefill={inqPrefill}
        sourcePage="/mobile"
        onClose={() => setInqOpen(false)}
        onSubmitted={() => {
          setInqOpen(false);
        }}
      />
    </div>
  );
}

/** =========================
 * 소형 버튼
 * ========================= */
function TabBtn({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      className={`px-4 py-2 rounded-full text-sm font-semibold ${active ? "text-white" : "bg-gray-100"}`}
      style={active ? { backgroundColor: COLOR_PRIMARY } : {}}
      onClick={onClick}
    >
      {label}
    </button>
  );
}

/** =========================
 * 종료 확인 모달
 * ========================= */
function ConfirmExitModal({ onConfirm, onCancel }: { onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="fixed inset-0 z-[90]">
      <div className="absolute inset-0 bg-black/40" />
      <div className="absolute inset-x-8 top-1/3 translate-y-[-50%] rounded-2xl bg-white p-4 shadow-xl">
        <div className="font-extrabold text-[15px] mb-3">정말로 해당 페이지를 종료하시겠습니까?</div>
        <div className="flex items-center justify-end gap-2">
          <button onClick={onCancel} className="px-4 py-2 rounded-xl bg-gray-100 text-gray-700 font-semibold">
            아니오
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 rounded-xl text-white font-semibold"
            style={{ backgroundColor: COLOR_PRIMARY }}
          >
            예
          </button>
        </div>
      </div>
    </div>
  );
}
