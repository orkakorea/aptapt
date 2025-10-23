import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

import BottomSheet from "@/components/mobile/BottomSheet";
import DetailPanel from "@/components/mobile/DetailPanel";
import CartPanel from "@/components/mobile/CartPanel";

import { useKakaoLoader } from "@/hooks/useKakaoLoader";
import { useKakaoMap } from "@/hooks/useKakaoMap";
import usePlaceSearch from "@/hooks/usePlaceSearch";
import useMarkers from "@/hooks/useMarkers";
import useUserMarker from "@/hooks/useUserMarker";

import type { SelectedApt, CartItem } from "@/core/types";
import { fmtWon } from "@/core/utils";
import { calcMonthlyWithPolicy, normPolicyKey } from "@/core/pricing";

const COLOR_PRIMARY = "#6F4BF2";

export default function MapMobilePageV2() {
  const mapRef = useRef<HTMLDivElement | null>(null);

  const { kakao, error: kakaoError } = useKakaoLoader();
  const { map, clusterer } = useKakaoMap(mapRef, {
    kakao,
    center: { lat: 37.5665, lng: 126.978 },
    level: 6,
    idleDebounceMs: 150,
  });

  // 유저 마커 (최초 수신 시 자동 센터)
  useUserMarker({ kakao, map, autoCenterOnFirstFix: true, watch: true });

  /* 검색 */
  const [searchQ, setSearchQ] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchAreaRef = useRef<HTMLDivElement>(null);
  const search = usePlaceSearch({ kakao, map, defaultLevel: 4, smoothPan: true });

  /* 선택/카트 */
  const [selected, setSelected] = useState<SelectedApt | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const selectedRowKeys = useMemo(() => cart.map((c) => c.rowKey), [cart]);

  /* 시트 상태 */
  const [sheetOpen, setSheetOpen] = useState(false);
  const sheetOpenRef = useRef(false);
  const [activeTab, setActiveTab] = useState<"detail" | "cart" | "quote">("detail");

  const phoneBtnRef = useRef<HTMLAnchorElement>(null);
  const [sheetMaxH, setSheetMaxH] = useState<number>(() => Math.max(320, Math.floor(window.innerHeight * 0.75)));

  const recalcSheetMax = useCallback(() => {
    const winH = window.innerHeight;
    const rect = phoneBtnRef.current?.getBoundingClientRect();
    const topEdge = rect ? Math.max(0, rect.bottom + 8) : Math.floor(winH * 0.25);
    const h = Math.max(320, winH - topEdge);
    setSheetMaxH(h);
  }, []);

  useEffect(() => {
    sheetOpenRef.current = sheetOpen;
    if (sheetOpen) recalcSheetMax();
  }, [sheetOpen, recalcSheetMax]);

  /* 마커 */
  const markers = useMarkers({
    kakao,
    map,
    clusterer,
    onSelect: (apt) => {
      setSelected(apt);
      setActiveTab("detail");
      setSheetOpen(true);
      recalcSheetMax();
    },
    externalSelectedRowKeys: selectedRowKeys,
  });

  // 초기 바운드 로딩(훅 내부에서도 수행하지만 안전하게 1회 더)
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

  /* 리사이즈 */
  useEffect(() => {
    const onResize = () => recalcSheetMax();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [recalcSheetMax]);

  /* 뒤로가기 & 전화 예외 */
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

  /* 외부 클릭 시 검색 blur */
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

  /* 검색 실행 + blur */
  const runSearchAndBlur = useCallback(async () => {
    try {
      searchInputRef.current?.blur();
      (document.activeElement as HTMLElement | null)?.blur?.();
      await search.run(searchQ);
    } catch {}
  }, [searchQ, search]);

  /* 카트 조작 */
  const isInCart = useCallback((rowKey?: string | null) => !!rowKey && cart.some((c) => c.rowKey === rowKey), [cart]);

  // ✅ 담기 시 항상 1개월로 시작 (삭제 후 재담기 포함)
  const addSelectedToCart = useCallback(() => {
    if (!selected) return;
    const next: CartItem = {
      rowKey: selected.rowKey,
      aptName: selected.name,
      productName: selected.productName,
      months: 1, // 항상 1개월로 시작
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

  /* 할인/총액 계산 */
  const computedCart = useMemo(() => {
    const cnt = new Map<string, number>();
    cart.forEach((c) => {
      const k = normPolicyKey(c.productName);
      cnt.set(k, (cnt.get(k) ?? 0) + 1);
    });
    return cart.map((c) => {
      const k = normPolicyKey(c.productName);
      const same = cnt.get(k) ?? 1;
      const { monthly, rate } = calcMonthlyWithPolicy(
        c.productName,
        c.months,
        c.baseMonthly ?? 0,
        c.monthlyFeeY1,
        same,
      );
      return { ...c, _monthly: monthly, _discountRate: rate, _total: monthly * c.months };
    });
  }, [cart]);

  const totalCost = useMemo(() => computedCart.reduce((s, c) => s + (c._total ?? 0), 0), [computedCart]);

  /* 장바구니 → 단지 상세로 정확히 이동 */
  const goToRowKey = useCallback(
    (rk: string) => {
      // ✅ 선택 + 지도이동 + 상세열기까지 한 번에
      markers.selectByRowKey(rk);
      setActiveTab("detail");
      setSheetOpen(true);
      recalcSheetMax();
    },
    [markers, recalcSheetMax],
  );

  // 바텀시트 스크롤 초기화용 키
  const resetScrollKey = `${sheetOpen ? 1 : 0}-${activeTab}-${selected?.rowKey ?? ""}`;

  return (
    <div className="w-screen h-[100dvh] bg-white">
      {/* 상단바 */}
      <div className="fixed top-0 left-0 right-0 z-[40] bg-white border-b">
        <div className="h-14 px-3 flex items-center justify-between">
          <div className="font-extrabold text-[15px]">응답하라 입주민이여</div>
          <button
            className="px-3 py-1 rounded-full border text-sm font-semibold"
            onClick={() => console.log("패키지 문의 클릭")}
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
          <button
            onClick={runSearchAndBlur}
            className="w-11 h-11 rounded-full flex items-center justify-center text-white shadow"
            style={{ backgroundColor: COLOR_PRIMARY }}
            aria-label="검색"
            title="검색"
          >
            <svg width="19" height="19" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0016 9.5 6.5 6.5 0 109.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79L20 21.49 21.49 20l-5.99-6zM9.5 14C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" />
            </svg>
          </button>

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
            <svg width="19" height="19" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <path d="M7 4h-2l-1 2h2l3.6 7.59-1.35 2.45c-.16.28-.25.61-.25.96 0 1.1.9 2 2 2h9v-2h-8.42c-.14 0-.25-.11-.25-.25l.03-.12.9-1.63h5.74c.75 0 1.41-.41 1.75-1.03L23 6H6.21l-.94-2zM7 20c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm10 0c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-2-2z" />
            </svg>
            {cart.length > 0 && (
              <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 rounded-full bg-[#FF3B30] text-[10px] font-bold flex items-center justify-center">
                {cart.length > 99 ? "99+" : cart.length}
              </span>
            )}
          </button>

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
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <path d="M6.62 10.79a15.05 15.05 0 006.59 6.59l2.2-2.2a1 1 0 011.01-.24c1.12.37 2.33.57 3.58.57a1 1 0 011 1V21a1 1 0 01-1 1C10.3 22 2 13.7 2 3a1 1 0 011-1h3.5a1 1 0 011 1c0 1.25.2 2.46.57 3.58a1 1 0 01-.25 1.01l-2.2 2.2z" />
            </svg>
          </a>
        </div>
      </div>

      {/* 시트 외부 클릭 닫힘 */}
      {sheetOpen && <div className="fixed inset-0 z-[50] bg-black/0" onClick={() => setSheetOpen(false)} />}

      {/* 바텀시트 */}
      <BottomSheet
        open={sheetOpen}
        maxHeightPx={sheetMaxH}
        onClose={() => setSheetOpen(false)}
        resetScrollKey={`${sheetOpen ? 1 : 0}-${activeTab}-${selected?.rowKey ?? ""}`}
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
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                  <path d="M18.3 5.71a1 1 0 00-1.41 0L12 10.59 7.11 5.7A1 1 0 105.7 7.11L10.59 12l-4.9 4.89a1 1 0 101.41 1.42L12 13.41l4.89 4.9a1 1 0 001.42-1.42L13.41 12l4.9-4.89a1 1 0 000-1.4z" />
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
                  addSelectedToCart(); // ✅ 담기 후 1개월 기본
                  setSheetOpen(false); // 요청대로 담기 후 시트 닫기
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
              onGoTo={goToRowKey} // ✅ 정확히 해당 단지로 이동
            />
          )}

          {activeTab === "quote" && <QuotePanel total={totalCost} />}
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
    </div>
  );
}

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

function QuotePanel({ total }: { total: number }) {
  return (
    <div className="space-y-3">
      <div className="rounded-2xl px-4 py-3 bg-[#EEE8FF]">
        <div className="text-sm text-gray-600">총 비용</div>
        <div className="text-[20px] font-extrabold" style={{ color: "#6F4BF2" }}>
          {fmtWon(total)}
        </div>
        <div className="text-[11px] text-gray-500">(VAT별도)</div>
      </div>
      <div className="text-sm text-gray-600">※ 견적 상세는 추후 확장</div>
    </div>
  );
}

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
            style={{ backgroundColor: "#6F4BF2" }}
          >
            예
          </button>
        </div>
      </div>
    </div>
  );
}
