import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useKakaoLoader } from "../../hooks/useKakaoLoader";
import { useKakaoMap } from "../../hooks/useKakaoMap";
import usePlaceSearch from "../../hooks/usePlaceSearch";
import useMarkers from "../../hooks/useMarkers";
import useSheetDrag from "../../hooks/useSheetDrag";
import BottomSheet from "../../components/mobile/BottomSheet";

import type { SelectedApt, CartItem } from "../../core/types";
import { fmtNum, fmtWon } from "../../core/utils";
import { calcMonthlyWithPolicy, normPolicyKey } from "../../core/pricing";

/* =========================
 * 스타일(모바일 톤)
 * ========================= */
const COLOR_PRIMARY = "#6F4BF2";
const COLOR_PRIMARY_LIGHT = "#EEE8FF";
const COLOR_GRAY_CARD = "#F4F6FA";
const monthOptions: number[] = Array.from({ length: 12 }, (_, i) => i + 1);

/* =========================
 * 페이지
 * ========================= */
export default function MapMobilePageV2() {
  // 지도 컨테이너
  const mapRef = useRef<HTMLDivElement | null>(null);

  // Kakao SDK → 지도/클러스터
  const { kakao, loading: kakaoLoading, error: kakaoError } = useKakaoLoader();
  const { map, clusterer } = useKakaoMap(mapRef, {
    kakao,
    center: { lat: 37.5665, lng: 126.978 }, // 서울시청
    level: 6,
    idleDebounceMs: 150,
  });

  // 검색
  const [searchQ, setSearchQ] = useState("");
  const search = usePlaceSearch({ kakao, map, defaultLevel: 4, smoothPan: true });

  // 선택된 아파트(상세 탭에 표시)
  const [selected, setSelected] = useState<SelectedApt | null>(null);

  // 카트
  const [cart, setCart] = useState<CartItem[]>([]);
  const selectedRowKeys = useMemo(() => cart.map((c) => c.rowKey), [cart]);

  // 마커 관리(바운드 자동 로드 + 클릭 → setSelected)
  const markers = useMarkers({
    kakao,
    map,
    clusterer,
    onSelect: (apt) => {
      setSelected(apt);
      setActiveTab("detail");
      setSheetOpen(true);
    },
    externalSelectedRowKeys: selectedRowKeys,
  });

  // 바텀시트 상태/드래그
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetMaxH, setSheetMaxH] = useState<number>(Math.max(320, Math.floor(window.innerHeight * 0.75)));
  const { translateY, onHandlePointerDown } = useSheetDrag({
    open: sheetOpen,
    threshold: 120,
    onClose: () => setSheetOpen(false),
  });

  // 탭: 카트/상세
  const [activeTab, setActiveTab] = useState<"cart" | "detail">("cart");

  // 시트 최대 높이 계산(리사이즈 대응)
  useEffect(() => {
    const onResize = () => setSheetMaxH(Math.max(320, Math.floor(window.innerHeight * 0.75)));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  /* ============
   * 카트 로직
   * ============ */
  const isInCart = useCallback((rowKey?: string | null) => !!rowKey && cart.some((c) => c.rowKey === rowKey), [cart]);

  const addSelectedToCart = useCallback(() => {
    if (!selected) return;
    const next: CartItem = {
      rowKey: selected.rowKey,
      aptName: selected.name,
      productName: selected.productName,
      months: 1,
      baseMonthly: selected.monthlyFee ?? 0,
      monthlyFeeY1: selected.monthlyFeeY1 ?? undefined,
    };
    setCart((prev) => [next, ...prev.filter((c) => c.rowKey !== next.rowKey)]);
    setActiveTab("cart");
    setSheetOpen(true);
  }, [selected]);

  const removeFromCart = useCallback((rowKey: string) => {
    setCart((prev) => prev.filter((c) => c.rowKey !== rowKey));
  }, []);

  const toggleSelectedInCart = useCallback(() => {
    if (!selected) return;
    if (isInCart(selected.rowKey)) removeFromCart(selected.rowKey);
    else addSelectedToCart();
  }, [selected, isInCart, removeFromCart, addSelectedToCart]);

  const updateMonths = useCallback((rowKey: string, months: number) => {
    setCart((prev) => prev.map((c) => (c.rowKey === rowKey ? { ...c, months } : c)));
  }, []);

  // 같은 상품끼리 개수 집계 → 할인 계산에 사용
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

  // 특정 아이템으로 지도를 이동하고 상세 탭 열기
  const goToRowKey = useCallback(
    (rk: string) => {
      markers.focusRowKey(rk);
      setActiveTab("detail");
      setSheetOpen(true);
    },
    [markers],
  );

  /* ============
   * 렌더
   * ============ */
  return (
    <div className="w-screen h-[100dvh] bg-white">
      {/* 헤더 */}
      <div className="fixed top-0 left-0 right-0 z-[40] bg-white border-b">
        <div className="h-14 px-3 flex items-center justify-between">
          <div className="font-extrabold text-[15px]">응답하라 입주민이여 (V2)</div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setSheetOpen(true);
                setActiveTab("cart");
              }}
              className="px-3 py-1 rounded-full border text-sm font-semibold"
            >
              카트 {cart.length ? `(${cart.length})` : ""}
            </button>
          </div>
        </div>
      </div>

      {/* 지도 */}
      <div ref={mapRef} className="fixed top-[56px] left-0 right-0 bottom-0 z-[10]" aria-label="map" />

      {/* 검색창 */}
      <div className="fixed z-[35] left-3 right-3 top-[64px] pointer-events-none">
        <div className="flex items-start gap-2">
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              await search.run(searchQ);
            }}
            className="flex-1 pointer-events-auto"
          >
            <input
              value={searchQ}
              onChange={(e) => setSearchQ(e.target.value)}
              placeholder="지역명, 아파트 이름, 단지명, 건물명"
              className="w-full h-11 px-4 rounded-xl border outline-none bg-white/95"
              style={{ borderColor: "#E8E0FF" }}
            />
          </form>
          <div className="flex flex-col gap-2 pointer-events-auto">
            <button
              onClick={() => search.run(searchQ)}
              className="w-11 h-11 rounded-full flex items-center justify-center text-white shadow"
              style={{ backgroundColor: COLOR_PRIMARY }}
              aria-label="검색"
              title="검색"
            >
              <svg width="19" height="19" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0016 9.5 6.5 6.5 0 109.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79L20 21.49 21.49 20l-5.99-6zM9.5 14C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" />
              </svg>
            </button>
          </div>
        </div>
      </div>
// ✅ 맵이 생기면 첫 로딩을 한 번 강제로 실행
useEffect(() => {
  if (map && kakao) {
    // 다음 틱에 실행(레이아웃/idle 타이밍 이슈 회피)
    setTimeout(() => {
      try { markers.refreshInBounds(); } catch {}
    }, 0);
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [map, kakao]);

      {/* 바깥 클릭으로 닫기 */}
      {sheetOpen && <div className="fixed inset-0 z-[50] bg-black/0" onClick={() => setSheetOpen(false)} />}

      {/* 하단 시트 */}
      <BottomSheet
        open={sheetOpen}
        translateY={translateY}
        maxHeightPx={sheetMaxH}
        onHandlePointerDown={onHandlePointerDown}
      >
        {/* 탭 헤더 */}
        <div className="px-4 mt-1 flex items-center gap-2">
          <button
            className={`px-4 py-2 rounded-full text-sm font-semibold ${activeTab === "cart" ? "text-white" : "bg-gray-100"}`}
            style={activeTab === "cart" ? { backgroundColor: COLOR_PRIMARY } : {}}
            onClick={() => setActiveTab("cart")}
          >
            카트 {cart.length ? `(${cart.length})` : ""}
          </button>
          <button
            className={`px-4 py-2 rounded-full text-sm font-semibold ${activeTab === "detail" ? "text-white" : "bg-gray-100"}`}
            style={activeTab === "detail" ? { backgroundColor: COLOR_PRIMARY } : {}}
            onClick={() => setActiveTab("detail")}
          >
            단지 상세
          </button>
        </div>

        {/* 경계용 흰 띠 */}
        <div className="-mx-4 h-3 bg-white" />

        {/* 본문 */}
        <div className="px-4 pb-0 flex flex-col overflow-hidden min-h-0">
          {activeTab === "cart" ? (
            <>
              {/* 상단 요약 */}
              <div className="shrink-0">
                <div className="mb-3 rounded-xl px-4 py-3" style={{ backgroundColor: COLOR_PRIMARY_LIGHT }}>
                  <div className="text-sm text-gray-600">총 비용</div>
                  <div className="text-[20px] font-extrabold" style={{ color: COLOR_PRIMARY }}>
                    {fmtWon(totalCost)}
                  </div>
                  <div className="text-[11px] text-gray-500">(VAT별도)</div>
                </div>
              </div>

              {/* 스크롤 영역 */}
              <div
                className="flex-1 min-h-0 overflow-y-auto pt-2 pb-6 overscroll-contain"
                style={{ WebkitOverflowScrolling: "touch", overscrollBehavior: "contain" as any }}
              >
                <CartList
                  colorPrimary={COLOR_PRIMARY}
                  colorPrimaryLight={COLOR_PRIMARY_LIGHT}
                  cart={computedCart}
                  onUpdateMonths={updateMonths}
                  onRemove={(rk) => removeFromCart(rk)}
                  onGoTo={(rk) => goToRowKey(rk)}
                />
              </div>
            </>
          ) : (
            <div
              className="flex-1 min-h-0 overflow-y-auto pt-2 pb-6 overscroll-contain"
              style={{ WebkitOverflowScrolling: "touch", overscrollBehavior: "contain" as any }}
            >
              <DetailPanel
                colorPrimary={COLOR_PRIMARY}
                selected={selected}
                isInCart={isInCart(selected?.rowKey)}
                onToggleCart={toggleSelectedInCart}
              />
            </div>
          )}
        </div>
      </BottomSheet>

      {/* 에러 토스트 */}
      {kakaoError && (
        <div className="fixed bottom-4 right-4 z-[100] rounded-lg bg-red-600 text-white px-3 py-2 text-sm shadow">
          Kakao SDK 오류: {kakaoError}
        </div>
      )}
    </div>
  );
}

/* =========================
 * Cart 리스트 (간단 버전)
 * ========================= */
function CartList(props: {
  colorPrimary: string;
  colorPrimaryLight: string;
  cart: (CartItem & { _monthly: number; _discountRate: number; _total: number })[];
  onUpdateMonths: (rowKey: string, months: number) => void;
  onRemove: (rowKey: string) => void;
  onGoTo: (rowKey: string) => void;
}) {
  const { colorPrimary, colorPrimaryLight, cart, onUpdateMonths, onRemove, onGoTo } = props;

  return (
    <div className="space-y-3">
      {cart.map((item) => {
        const percent = Math.round((item._discountRate ?? 0) * 100);
        return (
          <div key={item.rowKey} className="rounded-2xl border border-gray-200 p-4">
            <div className="flex items-start gap-3">
              <button onClick={() => onGoTo(item.rowKey)} className="flex-1 text-left" title="지도로 이동">
                <div className="font-extrabold text-[16px]">{item.aptName}</div>
                <div className="text-xs text-gray-500">{item.productName ?? "ELEVATOR TV"}</div>
              </button>
              <button
                onClick={() => onRemove(item.rowKey)}
                className="h-8 px-3 rounded-full bg-gray-100 text-gray-600 text-sm"
                aria-label="삭제"
              >
                삭제
              </button>
            </div>

            {/* 기간 선택 */}
            <div className="mt-3">
              <div className="text-sm text-gray-600 mb-1">광고기간</div>
              <select
                className="w-36 rounded-xl border px-3 py-2"
                value={item.months}
                onChange={(e) => onUpdateMonths(item.rowKey, Number(e.target.value))}
              >
                {monthOptions.map((m) => (
                  <option key={m} value={m}>
                    {m}개월
                  </option>
                ))}
              </select>
            </div>

            {/* 월광고료(기본) */}
            <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
              <div className="text-gray-600">월광고료(기본)</div>
              <div className="text-right font-semibold">{fmtWon(item.baseMonthly)}</div>
            </div>

            {/* 총광고료(기간/할인 적용) */}
            <div className="mt-1 grid grid-cols-2 gap-3 text-sm">
              <div className="text-gray-600">총광고료</div>
              <div className="text-right">
                <span className="inline-flex items-center gap-2">
                  {percent > 0 && (
                    <span
                      className="rounded-full px-2 py-0.5 text-[11px] font-bold"
                      style={{ backgroundColor: colorPrimaryLight, color: colorPrimary }}
                    >
                      {percent}%할인
                    </span>
                  )}
                  <span className="font-extrabold" style={{ color: colorPrimary }}>
                    {fmtWon(item._total)}
                  </span>
                </span>
              </div>
            </div>
          </div>
        );
      })}
      {!cart.length && (
        <div className="text-center text-sm text-gray-500 py-6">
          카트가 비어 있어요. 지도의 단지를 선택해 담아보세요.
        </div>
      )}
    </div>
  );
}

/* =========================
 * 상세 패널 (간단 버전)
 * ========================= */
function DetailPanel(props: {
  colorPrimary: string;
  selected: SelectedApt | null;
  isInCart: boolean;
  onToggleCart: () => void;
}) {
  const { colorPrimary, selected, isInCart, onToggleCart } = props;
  if (!selected) return <div className="text-center text-sm text-gray-500 py-6">지도의 단지를 선택하세요.</div>;

  const y1Monthly = selected.monthlyFeeY1 ?? Math.round((selected.monthlyFee ?? 0) * 0.7);

  return (
    <div>
      <div className="rounded-2xl overflow-hidden bg-gray-100 aspect-[4/3]">
        {selected.imageUrl ? (
          <img src={selected.imageUrl} alt={selected.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-400">이미지</div>
        )}
      </div>

      <div className="mt-3 flex items-start gap-3">
        <div className="flex-1">
          <div className="text-[20px] font-extrabold">{selected.name}</div>
          <div className="text-sm text-gray-500">
            {fmtNum(selected.households)} 세대 · {fmtNum(selected.residents)} 명
          </div>
        </div>
      </div>

      <div className="mt-3 space-y-2">
        <div className="rounded-2xl px-4 py-3" style={{ backgroundColor: COLOR_GRAY_CARD }}>
          <div className="text-sm text-gray-600">월 광고료</div>
          <div className="text-[20px] font-extrabold">
            {fmtWon(selected.monthlyFee)} <span className="text-xs text-gray-500">(VAT별도)</span>
          </div>
        </div>
        <div
          className="rounded-2xl px-4 py-3 border-2"
          style={{ borderColor: colorPrimary, backgroundColor: "#EEE8FF" }}
        >
          <div className="text-sm text-gray-700">1년 계약 시 월 광고료</div>
          <div className="text:[20px] font-extrabold" style={{ color: colorPrimary }}>
            {fmtWon(y1Monthly)} <span className="text-xs text-gray-500">(VAT별도)</span>
          </div>
        </div>
      </div>

      <div className="mt-3">
        <button
          className={`w-full h-12 rounded-2xl font-extrabold ${isInCart ? "text-gray-700" : "text-white"}`}
          style={{ backgroundColor: isInCart ? "#E5E7EB" : colorPrimary }}
          aria-pressed={isInCart}
          onClick={onToggleCart}
        >
          {isInCart ? "담기 취소" : "아파트 담기"}
        </button>
      </div>

      <div className="mt-4 rounded-2xl border">
        <table className="w-full text-sm">
          <tbody className="[&_td]:px-4 [&_td]:py-3">
            <tr>
              <td className="text-gray-500 w-36">상품명</td>
              <td className="font-semibold">{selected.productName ?? "ELEVATOR TV"}</td>
            </tr>
            <tr>
              <td className="text-gray-500">설치 위치</td>
              <td className="font-semibold">{selected.installLocation ?? "-"}</td>
            </tr>
            <tr>
              <td className="text-gray-500">모니터 수량</td>
              <td className="font-semibold">{fmtNum(selected.monitors)} 대</td>
            </tr>
            <tr>
              <td className="text-gray-500">월 송출횟수</td>
              <td className="font-semibold">{fmtNum(selected.monthlyImpressions)} 회</td>
            </tr>
            <tr>
              <td className="text-gray-500">송출 1회당 비용</td>
              <td className="font-semibold">{fmtNum(selected.costPerPlay)} 원</td>
            </tr>
            <tr>
              <td className="text-gray-500">운영 시간</td>
              <td className="font-semibold">{selected.hours || "-"}</td>
            </tr>
            <tr>
              <td className="text-gray-500">주소</td>
              <td className="font-semibold whitespace-pre-line">{selected.address || "-"}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
