// src/pages/mobile/index.tsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";

import BottomSheet from "@/components/mobile/BottomSheet";
import DetailPanel from "@/components/mobile/DetailPanel";
import CartPanel from "@/components/mobile/CartPanel";
import QuotePanel from "@/components/mobile/QuotePanel";

// ✅ 모바일 전용 2-스텝 하프 시트 모달
import MobileInquirySheet, { type Prefill, type InquiryKind } from "@/components/mobile/MobileInquirySheet";

// ✅ 문의 완료 모달(모바일)
import CompleteModalMobile from "@/components/complete-modal/CompleteModal.mobile";
import GestureHint from "@/components/mobile/GestureHint";

import { useKakaoLoader } from "@/hooks/useKakaoLoader";
import { useKakaoMap } from "@/hooks/useKakaoMap";
import usePlaceSearch from "@/hooks/usePlaceSearch";
import useMarkers from "@/hooks/useMarkers";
import useUserMarker from "@/hooks/useUserMarker";

import type { SelectedApt, CartItem } from "@/core/types";
import { calcMonthlyWithPolicy, normPolicyKey, DEFAULT_POLICY, rateFromRanges } from "@/core/pricing";
import type { DiscountPolicy } from "@/core/pricing";

const COLOR_PRIMARY = "#6F4BF2";

type ActiveTab = "detail" | "cart" | "quote";

/** =========================
 * 공통 유틸 (PC MapChrome과 동일 기준)
 * ========================= */
const norm = (s?: string | null) => (s ? s.replace(/\s+/g, "").toLowerCase() : "");

/** 상품 + 설치위치 + 자치구 기준 할인정책 키 결정 (PC와 동일 로직) */
function classifyProductForPolicy(
  productName?: string,
  installLocation?: string | null,
  district?: string | null,
): keyof DiscountPolicy | undefined {
  const pn = norm(productName);
  const loc = norm(installLocation);
  const d = (district ?? "").trim();

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

  // ELEVATOR TV: 강남/서초/송파는 기간할인 없는 정책 사용
  if (pn.includes("elevatortv") || pn.includes("엘리베이터tv") || pn.includes("elevator")) {
    if (d === "강남구" || d === "서초구" || d === "송파구") return "ELEVATOR TV_NOPD";
    return "ELEVATOR TV";
  }

  if (pn.includes("mediameet") || pn.includes("media-meet") || pn.includes("미디어")) return "MEDIA MEET";
  if (pn.includes("spaceliving") || pn.includes("스페이스") || pn.includes("living")) return "SPACE LIVING";
  if (pn.includes("htpost") || pn.includes("ht-post") || pn.includes("하이포스트")) return "HT-POST";

  if (pn.includes("townbord") || pn.includes("townboard") || pn.includes("타운보드")) {
    if (loc.includes("ev내부")) return "TOWNBORD_L";
    if (loc.includes("ev대기공간")) return "TOWNBORD_S";
    return "TOWNBORD_S";
  }

  return undefined;
}

/** 모바일 전용 카트 아이템: core CartItem + 할인정책 키 + 상세 정보 스냅샷 */
type MobileCartItem = CartItem & {
  productKey?: keyof DiscountPolicy;

  district?: string | null;
  address?: string | null;
  installLocation?: string | null;
  households?: number | null;
  residents?: number | null;
  monthlyImpressions?: number | null;
  monitors?: number | null;
};

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

  // ✅ 초기 q 적용 여부 (한 번만 적용하기 위한 플래그)
  const initialAppliedRef = useRef(false);

  /** ✅ 초기 검색어 적용 — /mobile?q=... 로 진입하면 자동 실행 */
  const [searchParams, setSearchParams] = useSearchParams();
  const initialQ = (searchParams.get("q") || "").trim();

  useEffect(() => {
    const ready = !!(kakao && map);
    if (!ready) return;
    if (!initialQ) return;

    // 이미 한 번 초기 검색을 적용했다면 더 이상 실행하지 않음
    if (initialAppliedRef.current) return;
    initialAppliedRef.current = true;

    setSearchQ(initialQ);
    try {
      // 처음 진입 시에만 한 번 blur 처리
      searchInputRef.current?.blur();
      (document.activeElement as HTMLElement | null)?.blur?.();
    } catch {}

    (async () => {
      try {
        await search.run(initialQ);
      } catch {}
    })();

    // URL에서 q 파라미터 제거 → 이후에는 특정 검색어에 고정되지 않도록
    try {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.delete("q");
        return next;
      });
    } catch {
      // 실패해도 동작에 치명적 영향 없음
    }
  }, [kakao, map, initialQ, search, setSearchParams]);

  /** =========================
   * 선택/카트
   * ========================= */
  const [selected, setSelected] = useState<SelectedApt | null>(null);
  const [cart, setCart] = useState<MobileCartItem[]>([]);
  const selectedRowKeys = useMemo(() => cart.map((c) => c.rowKey), [cart]);

  /** ✅ 마지막에 선택한 개월 수를 기억 (새로 담을 때 기본값으로) */
  const lastMonthsRef = useRef<number>(1);

  /** ✅ rowKey → 최신 상세(카운터/주소/월송출 등) 매핑 저장 */
  const detailByRowKeyRef = useRef<Map<string, Partial<SelectedApt>>>(new Map());

  /** =========================
   * 문의 시트
   * ========================= */
  const [inqOpen, setInqOpen] = useState(false);
  const [inqMode, setInqMode] = useState<InquiryKind>("SEAT");
  const [inqPrefill, setInqPrefill] = useState<Prefill | undefined>(undefined);

  /** =========================
   * 완료 모달 상태
   * ========================= */
  const [doneOpen, setDoneOpen] = useState(false);
  const [receipt, setReceipt] = useState<any | null>(null); // ⚠️ 보안: 화면 표시용 메모리 객체. 콘솔/스토리지/URL로 내보내지 않음!

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
   * 퀵담기(모바일)
   * ========================= */
  const quickModeRef = useRef(false);
  const [quickMode, setQuickMode] = useState(false);
  useEffect(() => {
    quickModeRef.current = quickMode;
  }, [quickMode]);

  /** 카트에서 단지 클릭 시 1회용으로 퀵토글을 억제하는 플래그 */
  const suppressQuickToggleOnceRef = useRef(false);

  /** =========================
   * 마커
   * ========================= */
  const isInCart = useCallback((rowKey?: string | null) => !!rowKey && cart.some((c) => c.rowKey === rowKey), [cart]);

  const addAptToCartQuick = useCallback((apt: SelectedApt) => {
    const monthsDefault = Math.max(1, Number(lastMonthsRef.current || 1));

    const rawDistrict = typeof (apt as any).district === "string" ? (apt as any).district.trim() : "";
    const addr = typeof (apt as any).address === "string" ? (apt as any).address : "";
    const district = rawDistrict || (addr ? (addr.match(/(강남구|서초구|송파구|양천구)/)?.[1] ?? "") : "");

    const productKey = classifyProductForPolicy(
      apt.productName,
      (apt as any).installLocation ?? (apt as any).install_location ?? null,
      district || null,
    );

    const next: MobileCartItem = {
      rowKey: apt.rowKey,
      aptName: apt.name,
      productName: apt.productName ?? "기본상품",
      months: monthsDefault,
      baseMonthly: apt.monthlyFee ?? 0,
      monthlyFeeY1: apt.monthlyFeeY1 ?? undefined,
      productKey,
      district: district || null,
      address: addr || null,
      installLocation: (apt as any).installLocation ?? (apt as any).install_location ?? null,
      households: (apt as any).households ?? null,
      residents: (apt as any).residents ?? null,
      monthlyImpressions: (apt as any).monthlyImpressions ?? null,
      monitors: (apt as any).monitors ?? null,
    };

    setCart((prev) => [next, ...prev.filter((c) => c.rowKey !== next.rowKey)]);
  }, []);

  const markers = useMarkers({
    kakao,
    map,
    clusterer,
    onSelect: (apt) => {
      // 최신 상세 캐시
      if (apt?.rowKey) detailByRowKeyRef.current.set(apt.rowKey, apt);

      // ① 카트에서 포커스만 하려고 들어온 1회 케이스: 자동 담기/취소/차단 없이 시트만 연다
      if (suppressQuickToggleOnceRef.current) {
        suppressQuickToggleOnceRef.current = false;
        setSelected(apt);
        setActiveTab("detail");
        setSheetOpen(true);
        recalcSheetMax();
        return;
      }

      // ② 퀵담기 ON: 시트 자동 오픈 없이 담기/취소만 수행
      if (quickModeRef.current) {
        setSelected(apt); // 상태만 갱신(시트는 건드리지 않음)
        if (isInCart(apt.rowKey)) {
          setCart((prev) => prev.filter((c) => c.rowKey !== apt.rowKey));
        } else {
          addAptToCartQuick(apt);
        }
        return; // 시트 자동 오픈 금지
      }

      // ③ 일반 모드: 상세 탭 + 시트 오픈
      setSelected(apt);
      setActiveTab("detail");
      setSheetOpen(true);
      recalcSheetMax();
    },
    externalSelectedRowKeys: selectedRowKeys,

    /** ⬇️⬇️ 추가: 모바일 퀵담기 연결 (PNG가 아닌 dataURL 마커 사용 & 상세 RPC 우회) */
    quickAddEnabled: quickMode,
    onQuickToggle: (rowKey: string, apt: SelectedApt, wasSelected: boolean) => {
      // ✅ 퀵담기 경로에서도 최신 상세(설치위치 포함)를 캐시에 저장
      if (apt?.rowKey) {
        detailByRowKeyRef.current.set(apt.rowKey, apt);
      }

      if (wasSelected) {
        // 담김 → 취소
        setCart((prev) => prev.filter((c) => c.rowKey !== rowKey));
      } else {
        // 미담김 → 담기
        const monthsDefault = Math.max(1, Number(lastMonthsRef.current || 1));

        const rawDistrict = typeof (apt as any).district === "string" ? (apt as any).district.trim() : "";
        const addr = typeof (apt as any).address === "string" ? (apt as any).address : "";
        const district = rawDistrict || (addr ? (addr.match(/(강남구|서초구|송파구|양천구)/)?.[1] ?? "") : "");

        const productKey = classifyProductForPolicy(
          apt.productName,
          (apt as any).installLocation ?? (apt as any).install_location ?? null,
          district || null,
        );

        const next: MobileCartItem = {
          rowKey,
          aptName: apt.name,
          productName: apt.productName ?? "기본상품",
          months: monthsDefault,
          baseMonthly: apt.monthlyFee ?? 0,
          monthlyFeeY1: apt.monthlyFeeY1 ?? undefined,
          productKey,
          district: district || null,
          address: addr || null,
          installLocation: (apt as any).installLocation ?? (apt as any).install_location ?? null,
          households: (apt as any).households ?? null,
          residents: (apt as any).residents ?? null,
          monthlyImpressions: (apt as any).monthlyImpressions ?? null,
          monitors: (apt as any).monitors ?? null,
        };

        setCart((prev) => [next, ...prev.filter((c) => c.rowKey !== next.rowKey)]);
      }
    },
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

  /** ✅ 검색창에만 blur 적용(입력 폼 키보드 유지) */
  useEffect(() => {
    const blurActive = () => {
      const el = document.activeElement as HTMLElement | null;
      if (el && typeof el.blur === "function") el.blur();
    };
    const onPointerDown = (e: PointerEvent) => {
      // 현재 포커스가 "검색 input"일 때만 외부 탭 시 blur
      const isSearchActive = document.activeElement === searchInputRef.current;
      if (!isSearchActive) return;
      const target = e.target as Node;
      if (searchAreaRef.current?.contains(target)) return; // 검색영역 내부는 유지
      blurActive(); // 검색창만 닫기
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
  const isInCartSelected = useCallback(
    (rowKey?: string | null) => !!rowKey && cart.some((c) => c.rowKey === rowKey),
    [cart],
  );

  // ✅ 담기 시 "마지막 개월수"로 기본 설정 (없으면 1개월)
  const addSelectedToCart = useCallback(() => {
    if (!selected) return;
    const monthsDefault = Math.max(1, Number(lastMonthsRef.current || 1));

    const rawDistrict = typeof (selected as any).district === "string" ? (selected as any).district.trim() : "";
    const addr = typeof (selected as any).address === "string" ? (selected as any).address : "";
    const district = rawDistrict || (addr ? (addr.match(/(강남구|서초구|송파구|양천구)/)?.[1] ?? "") : "");

    const productKey = classifyProductForPolicy(
      selected.productName,
      (selected as any).installLocation ?? (selected as any).install_location ?? null,
      district || null,
    );

    const next: MobileCartItem = {
      rowKey: selected.rowKey,
      aptName: selected.name,
      productName: selected.productName ?? "기본상품",
      months: monthsDefault,
      baseMonthly: selected.monthlyFee ?? 0,
      monthlyFeeY1: selected.monthlyFeeY1 ?? undefined,
      productKey,
      district: district || null,
      address: addr || null,
      installLocation: (selected as any).installLocation ?? (selected as any).install_location ?? null,
      households: (selected as any).households ?? null,
      residents: (selected as any).residents ?? null,
      monthlyImpressions: (selected as any).monthlyImpressions ?? null,
      monitors: (selected as any).monitors ?? null,
    };

    setCart((prev) => [next, ...prev.filter((c) => c.rowKey !== next.rowKey)]);
  }, [selected]);

  const removeFromCart = useCallback((rowKey: string) => {
    setCart((prev) => prev.filter((c) => c.rowKey !== rowKey));
  }, []);

  const [applyAll, setApplyAll] = useState(true);

  const updateMonths = useCallback(
    (rowKey: string, months: number) => {
      // ✅ 최근 개월수 기억
      if (Number.isFinite(months) && months > 0) {
        lastMonthsRef.current = months;
      }
      setCart((prev) => {
        if (applyAll) return prev.map((c) => ({ ...c, months }));
        return prev.map((c) => (c.rowKey === rowKey ? { ...c, months } : c));
      });
    },
    [applyAll],
  );

  /** =========================
   * 할인/총액 계산 (+ 카운터 보강)
   * ========================= */
  type ComputedItem = Omit<MobileCartItem, "productName" | "baseMonthly"> & {
    productName: string;
    baseMonthly: number;
    _monthly: number; // 할인 적용 월요금
    _discountRate: number; // 0~1 (사전보상 × 기간 복합 할인율)
    _total: number; // 총광고료
    discPeriodRate?: number;
    discPrecompRate?: number;

    // 🔹 설치위치 + 견적상세/요약용 카운터들
    installLocation?: string;
    households?: number;
    residents?: number;
    monthlyImpressions?: number;
    monitors?: number;
  };

  const computedCart: ComputedItem[] = useMemo(() => {
    return cart.map((c) => {
      const name = c.productName ?? "기본상품";
      const months = c.months || 0;

      const detail = detailByRowKeyRef.current.get(c.rowKey) || {};

      const householdsRaw = Number((c as any).households ?? (detail as any).households ?? NaN);
      const residentsRaw = Number((c as any).residents ?? (detail as any).residents ?? NaN);
      const monthlyImpressionsRaw = Number((c as any).monthlyImpressions ?? (detail as any).monthlyImpressions ?? NaN);
      const monitorsRaw = Number((c as any).monitors ?? (detail as any).monitors ?? NaN);

      const installLocation =
        typeof (c as any).installLocation === "string" && (c as any).installLocation.trim() !== ""
          ? (c as any).installLocation
          : typeof (detail as any).installLocation === "string" && (detail as any).installLocation.trim() !== ""
            ? (detail as any).installLocation
            : undefined;

      let district: string =
        typeof (c as any).district === "string" && (c as any).district.trim() !== ""
          ? (c as any).district.trim()
          : typeof (detail as any).district === "string" && (detail as any).district.trim() !== ""
            ? (detail as any).district.trim()
            : "";

      if (!district) {
        const addressSource =
          (typeof (c as any).address === "string" && (c as any).address) ||
          (typeof (detail as any).address === "string" ? (detail as any).address : "");
        if (addressSource) {
          const m = addressSource.match(/(강남구|서초구|송파구|양천구)/);
          if (m) district = m[1];
        }
      }

      const households = Number.isFinite(householdsRaw) ? householdsRaw : undefined;
      const residents = Number.isFinite(residentsRaw) ? residentsRaw : undefined;
      const monthlyImpressions = Number.isFinite(monthlyImpressionsRaw) ? monthlyImpressionsRaw : undefined;
      const monitors = Number.isFinite(monitorsRaw) && monitorsRaw > 0 ? monitorsRaw : undefined;

      const key = (c.productKey as keyof DiscountPolicy | undefined) ?? (normPolicyKey(name) as keyof DiscountPolicy);
      const rules: any = key ? (DEFAULT_POLICY as any)[key] : undefined;

      const nameNorm = norm(name);
      const isElevator =
        key === "ELEVATOR TV" ||
        key === "ELEVATOR TV_NOPD" ||
        nameNorm.includes("elevatortv") ||
        nameNorm.includes("엘리베이터tv") ||
        nameNorm.includes("elevator");

      let base = c.baseMonthly ?? 0;
      let discPeriodRate = 0;
      let discPrecompRate = 0;
      let monthly = 0;

      if (isElevator) {
        // =========================
        // ✅ ELEVATOR TV 전용 규칙
        //  1) 모니터 1대당 단가 × 모니터 수 = 월광고료(기준)
        //  2) 사전 보상 할인 없음
        //  3) 강남/서초/송파 기간할인 없음
        // =========================
        const monitorCount = monitors ?? 0;

        let unitPrice = 10000;
        if (district === "강남구" || district === "서초구") {
          unitPrice = 15000;
        } else if (district === "송파구" || district === "양천구") {
          unitPrice = 12000;
        }

        base = monitorCount > 0 ? unitPrice * monitorCount : 0;

        discPrecompRate = 0;
        const noPeriodDiscount = district === "강남구" || district === "서초구" || district === "송파구";
        discPeriodRate = noPeriodDiscount ? 0 : rateFromRanges(rules?.period, months);

        monthly = Math.round(base * (1 - discPeriodRate));
      } else {
        const base0 = c.baseMonthly ?? 0;
        base = base0;
        discPeriodRate = rateFromRanges(rules?.period, months);
        discPrecompRate = key === "ELEVATOR TV" ? rateFromRanges(rules?.precomp, months) : 0;
        monthly = Math.round(base0 * (1 - discPrecompRate) * (1 - discPeriodRate));
      }

      const discountCombined = 1 - (1 - discPrecompRate) * (1 - discPeriodRate);
      const total = monthly * months;

      return {
        ...c,
        productName: name,
        baseMonthly: base,
        _monthly: monthly,
        _discountRate: discountCombined,
        _total: total,
        discPeriodRate,
        discPrecompRate,
        installLocation,
        households,
        residents,
        monthlyImpressions,
        monitors,
      };
    });
  }, [cart]);

  const totalCost = useMemo(() => computedCart.reduce((s, c) => s + c._total, 0), [computedCart]);

  /** 장바구니 → 특정 단지로 이동 */
  const goToRowKey = useCallback(
    (rk: string) => {
      if (!rk) return;

      // ✅ 다음 onSelect 한 번만 "퀵담기 토글/자동오픈" 모두 억제
      suppressQuickToggleOnceRef.current = true;

      // 1) rowKey 기준으로 캐시에 저장된 최신 상세 찾기
      const detail = detailByRowKeyRef.current.get(rk);

      if (detail && kakao && map) {
        const lat = Number((detail as any).lat);
        const lng = Number((detail as any).lng);

        // 2) 좌표가 유효하면, 현재 지도 상태와 무관하게 해당 단지 위치로 이동
        if (Number.isFinite(lat) && Number.isFinite(lng)) {
          try {
            const center = new kakao.maps.LatLng(lat, lng);
            map.panTo(center);
          } catch {}
        }

        // 3) 선택 상태도 해당 단지로 강제 동기화
        setSelected((prev) => {
          if (prev?.rowKey === rk) return prev;
          return {
            ...(prev || {}),
            ...detail,
            rowKey: rk,
          } as SelectedApt;
        });

        setActiveTab("detail");
        setSheetOpen(true);
        recalcSheetMax();
        return;
      }

      // ⚠️ 캐시/좌표가 없는 예외 상황에서는 기존 동작으로 fallback
      markers.selectByRowKey(rk);
      setActiveTab("detail");
      setSheetOpen(true);
      recalcSheetMax();
    },
    [markers, kakao, map, recalcSheetMax],
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
        product_code: (it.productKey as string) || normPolicyKey(it.productName),
        months: it.months,
        item_total_won: it._total,
        total_won: it._total,
      })),
    };
  }, []);

  /** =========================
   * ✅ 문의 완료 영수증 빌더
   * ========================= */
  const buildReceiptFrom = useCallback(
    (items: typeof computedCart, total: number, id?: string | null, mode?: InquiryKind) => {
      const ticketCode = `ORKA-${Date.now().toString(36).toUpperCase()}`;
      const createdAtISO = new Date().toISOString();

      const snapshot = buildCartSnapshot(items, total);
      const topApt = items[0]?.aptName
        ? `${items[0].aptName}${items.length > 1 ? ` 외 ${items.length - 1}개 단지` : ""}`
        : "-";

      // SeatInquiryTable 이 참조하는 최소 필드들만 구성
      const detailsItems = items.map((it) => ({
        apt_name: it.aptName,
        product_name: it.productName,
        months: it.months,
        baseMonthly: it.baseMonthly, // 월가(기준)
        baseTotal: Math.round(it.baseMonthly * it.months), // 기준금액
        lineTotal: Math.round(it._total), // 총광고료
      }));

      return {
        id: id ?? null,
        mode: mode ?? "SEAT",
        ticketCode,
        createdAtISO,
        summary: { topAptLabel: topApt },
        form: { cart_snapshot: snapshot },
        details: { items: detailsItems },
        customer: {}, // 고객입력은 보안/선택사항이라 비워둠
        meta: { step_ui: "mobile-2step" },
      };
    },
    [buildCartSnapshot],
  );

  /** =========================
   * 🔒 표시용 스냅샷 병합(화이트리스트)
   * ========================= */
  function mergeReceiptSafe(base: any, snap?: any) {
    if (!snap || typeof snap !== "object") return base;

    const merged = { ...base };

    // summary
    if (snap.summary && typeof snap.summary === "object") {
      merged.summary = { ...(merged.summary || {}) };
      if (typeof snap.summary.topAptLabel === "string") {
        merged.summary.topAptLabel = snap.summary.topAptLabel;
      }
    }

    // customer (표시용 최소 필드만)
    if (snap.customer && typeof snap.customer === "object") {
      const src = snap.customer;
      merged.customer = { ...(merged.customer || {}) };
      const allow = ["company", "name", "phoneMasked", "email", "phone"]; // phoneMasked 우선 사용
      allow.forEach((k) => {
        if (src[k] != null && String(src[k]).trim() !== "") merged.customer[k] = src[k];
      });
    }

    // form.values (표시용)
    if (snap.form && typeof snap.form === "object") {
      const f = snap.form;
      merged.form = { ...(merged.form || {}) };
      // values
      if (f.values && typeof f.values === "object") {
        const srcv = f.values;
        const allowVals = ["campaign_type", "months", "desiredDate", "promoCode", "request_text"];
        merged.form.values = { ...(merged.form.values || {}) };
        allowVals.forEach((k) => {
          if (srcv[k] != null && String(srcv[k]).trim?.() !== "") merged.form.values[k] = srcv[k];
        });
      }
      // cart_snapshot
      if (f.cart_snapshot && typeof f.cart_snapshot === "object") {
        merged.form.cart_snapshot = f.cart_snapshot; // 금액/항목만 포함(이미 프론트 계산 결과)
      }
    }

    // meta
    if (snap.meta && typeof snap.meta === "object") {
      merged.meta = { ...(merged.meta || {}), step_ui: snap.meta.step_ui ?? merged.meta?.step_ui };
    }

    return merged;
  }

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
      <GestureHint map={map} autoHideMs={0} forceShow />

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
          {/* ▶ 검색 (위쪽) */}
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

          {/* ▶ 퀵담기 토글 */}
          <button
            onClick={() => setQuickMode((v) => !v)}
            aria-label="빠른담기"
            aria-pressed={quickMode}
            className={`w-11 h-11 rounded-full flex items-center justify-center shadow transition ${
              quickMode ? "text-[#6F4BF2]" : "text-white"
            }`}
            style={{ backgroundColor: quickMode ? "#FFD400" : COLOR_PRIMARY }}
            title="빠른담기"
          >
            {/* 번개 아이콘 */}
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <path d="M13 2L3 14h7l-1 8 11-14h-7l0-6z" />
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
            {cart.length > 99 && (
              <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 rounded-full bg-[#FF3B30] text-[10px] font-bold flex items-center justify-center">
                99+
              </span>
            )}
            {cart.length > 0 && cart.length <= 99 && (
              <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 rounded-full bg-[#FF3B30] text-[10px] font-bold flex items센터 justify-center">
                {cart.length}
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
              inCart={isInCartSelected(selected?.rowKey)}
              onToggleCart={() => {
                if (!selected) return;
                if (isInCartSelected(selected.rowKey)) {
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
                  product_code: first.productName ? normPolicyKey(first.productName) : null,
                  product_name: first.productName ?? null,
                  cart_snapshot: buildCartSnapshot(computedCart, totalCost),
                });

                setSheetOpen(false);
                setInqOpen(true);
              }}
            />
          )}

          {/* 탭별 하단 CTA 버튼 */}
          {activeTab === "detail" && (
            <div className="mt-4 pt-1">
              <button
                type="button"
                className="w-full h-12 rounded-2xl font-extrabold text-white"
                style={{ backgroundColor: COLOR_PRIMARY }}
                onClick={() => setActiveTab("cart")}
              >
                장바구니 확인하기
              </button>
            </div>
          )}

          {activeTab === "cart" && (
            <div className="mt-4 pt-1">
              <button
                type="button"
                className="w-full h-12 rounded-2xl font-extrabold text-white"
                style={{ backgroundColor: COLOR_PRIMARY }}
                onClick={() => setActiveTab("quote")}
              >
                상세견적 확인하기
              </button>
            </div>
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

      {/* ✅ 모바일 문의: 하프 시트 2-스텝 모달 */}
      <MobileInquirySheet
        open={inqOpen}
        mode={inqMode}
        prefill={inqPrefill}
        sourcePage="/mobile"
        onClose={() => setInqOpen(false)}
        onSubmitted={(newId, snap) => {
          // 🔒 보안: 제출 후 민감정보는 화면 표시용 객체에만 유지. 콘솔/스토리지 기록 금지.
          setInqOpen(false);

          // 기본 영수증 생성(카트/금액/항목)
          const base = buildReceiptFrom(computedCart, totalCost, newId, inqMode);

          // 표시용 스냅샷(snap)과 화이트리스트 병합 → 고객/문의정보가 완료모달에 즉시 표시
          const merged = mergeReceiptSafe(base, snap);

          setReceipt(merged);
          setDoneOpen(true);
        }}
      />

      {/* ✅ 문의 완료 모달(모바일) */}
      {doneOpen && receipt && (
        <CompleteModalMobile open={doneOpen} data={receipt} onClose={() => setDoneOpen(false)} confirmLabel="확인" />
      )}
    </div>
  );
}

/** =========================
 * 소형 탭 버튼
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
