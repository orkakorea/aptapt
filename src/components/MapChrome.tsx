// src/components/MapChrome.tsx
import React, { useEffect, useMemo, useState } from "react";
import QuoteModal, { QuoteLineItem } from "./QuoteModal";
import InquiryModal from "./InquiryModal";
import { supabase } from "@/integrations/supabase/client";
/* ✅ 추가: 타이틀 오른쪽 패널 줌 버튼 */
import PanelZoomButtons from "./PanelZoomButtons";
import { DEFAULT_POLICY } from "@/core/pricing";
import type { DiscountPolicy, RangeRule } from "@/core/pricing";

/* ✅ 카트 슬롯 훅 & UI */
import useCartSlots from "@/hooks/useCartSlots";
import CartSlotsBar from "./CartSlotsBar";

/** ===== 타입 ===== */
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
  city?: string;
  district?: string;
  lat: number;
  lng: number;
};

type Props = {
  selected?: SelectedApt | null;
  onCloseSelected?: () => void;
  onSearch?: (query: string) => void;
  initialQuery?: string;
  // Quick Add (퀵담기) 표시/토글
  quickMode?: boolean;
  onToggleQuick?: () => void;

  // (구버전 호환)
  setMarkerState?: (name: string, state: "default" | "selected") => void;

  // (신버전) 행(rowKey) 단위 마커 토글
  setMarkerStateByRowKey?: (rowKey: string, state: "default" | "selected", forceYellowNow?: boolean) => void;

  // 카트 고정/제어용(옵션 — MapPage에서 전달)
  isRowKeySelected?: (rowKey?: string | null) => boolean;
  addToCartByRowKey?: (rowKey: string) => void;
  removeFromCartByRowKey?: (rowKey: string) => void;
  toggleCartByRowKey?: (rowKey: string) => void;

  // 카트에서 단지 클릭 시 지도 포커스
  focusByRowKey?: (rowKey: string, opts?: { level?: number }) => void | Promise<void>;
  focusByLatLng?: (lat: number, lng: number, opts?: { level?: number }) => void | Promise<void>;

  // ✅ 추가: 카트에서 클릭한 단지를 2탭 상세로 띄우기 위한 콜백
  onCartItemSelectByRowKey?: (rowKey: string) => void;

  cartStickyTopPx?: number;
  cartStickyUntil?: string;

  /* ✅ 추가: MapPage에서 계산한 패널 폭을 프롭으로 전달 (없으면 360 기본값 사용) */
  cartWidthPx?: number;
  detailWidthPx?: number;
};

/** ===== 정적 에셋 & 유틸 ===== */
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

/** ===== 할인 정책 ===== */

function findRate(rules: RangeRule[] | undefined, months: number): number {
  if (!rules || !Number.isFinite(months)) return 0;
  return rules.find((r) => months >= r.min && months <= r.max)?.rate ?? 0;
}

function classifyProductForPolicy(
  productName?: string,
  installLocation?: string,
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
    if (d === "강남구" || d === "서초구" || d === "송파구") {
      return "ELEVATOR TV_NOPD";
    }
    return "ELEVATOR TV";
  }

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

/** ✅ district 보강 유틸: district 값이 비어 있으면 주소에서 강남/서초/송파 추출 */
function pickDistrict(district: string | null | undefined, address?: string): string | undefined {
  const base = (district || "").trim();
  if (base) return base;

  const src = (address || "").trim();
  if (!src) return undefined;

  if (src.includes("강남구")) return "강남구";
  if (src.includes("서초구")) return "서초구";
  if (src.includes("송파구")) return "송파구";

  return undefined;
}

/** ===== Cart 타입 ===== */
type CartItem = {
  id: string;
  rowKey?: string;
  name: string;
  productKey?: keyof DiscountPolicy;
  productName?: string;
  baseMonthly?: number;
  months: number;
  lat?: number;
  lng?: number;
  installLocation?: string; // 설치 위치
  households?: number;
  residents?: number;
  monitors?: number;
  monthlyImpressions?: number;
  district?: string;

  /** 내부 상태: 정보 미충분 → fetch 보강 필요 */
  hydrated?: boolean;
};

/** ===== Supabase 캐시 ===== */
type AptStats = { households?: number; residents?: number; monthlyImpressions?: number; monitors?: number };

/** ===== 내부 유틸(행키 파서 & 보강) ===== */
function parseRowKey(rowKey?: string): { placeId?: string } {
  if (!rowKey) return {};
  const m = /^id:([^|]+)$/i.exec(rowKey.trim());
  if (m) return { placeId: m[1] };
  return {};
}

/** ===== ✅ 패널-줌: MapPage와 연결되는 이벤트 디스패처 ===== */
type PanelZoomMode = "normal" | "cartWide" | "detailWide" | "compact";
const PanelZoomButtonsAny = PanelZoomButtons as any;

/** ===== 컴포넌트 ===== */
export default function MapChrome({
  selected,
  onCloseSelected,
  onSearch,
  initialQuery,
  setMarkerState,
  setMarkerStateByRowKey,
  isRowKeySelected,
  addToCartByRowKey,
  onCartItemSelectByRowKey,
  removeFromCartByRowKey,
  toggleCartByRowKey,
  focusByRowKey,
  focusByLatLng,
  cartStickyTopPx = 64,
  quickMode,
  onToggleQuick,
  /* ✅ 추가된 프롭 */
  cartWidthPx,
  detailWidthPx,
}: Props) {
  const [query, setQuery] = useState(initialQuery || "");
  useEffect(() => setQuery(initialQuery || ""), [initialQuery]);

  const [cart, setCart] = useState<CartItem[]>([]);
  const [applyAll, setApplyAll] = useState(true);

  const [openQuote, setOpenQuote] = useState(false);
  const [openSeatInquiry, setOpenSeatInquiry] = useState(false);
  const [openPackageInquiry, setOpenPackageInquiry] = useState(false);

  const [statsMap, setStatsMap] = useState<Record<string, AptStats>>({});

  /* ✅ 구독자 카트 슬롯(1~5) 상태 */
  const {
    slots: cartSlots,
    loading: cartSlotsLoading,
    saveSlot: saveCartSlot,
    getSlotItems,
    refresh: refreshCartSlots,
  } = useCartSlots();

  /* ✅ 로그인 여부 */
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  useEffect(() => {
    let mounted = true;

    supabase.auth
      .getUser()
      .then((res) => {
        if (!mounted) return;
        setIsLoggedIn(!!res.data.user);
      })
      .catch(() => {});

    const { data: listener } = (supabase as any).auth.onAuthStateChange((_event: any, session: any) => {
      if (!mounted) return;
      setIsLoggedIn(!!session?.user);
    });

    return () => {
      mounted = false;
      listener?.subscription?.unsubscribe?.();
    };
  }, []);

  // 최신 selected를 안전하게 참조하기 위한 ref
  const selectedRef = React.useRef<SelectedApt | null>(selected);
  useEffect(() => {
    selectedRef.current = selected ?? null;
  }, [selected]);

  /** ===== ✅ 패널-줌 현재 모드 & 이벤트 발생 함수 (MapPage가 수신) ===== */
  const [panelMode, setPanelMode] = useState<PanelZoomMode>("normal");
  const emitPanelZoom = (mode: PanelZoomMode) => {
    window.dispatchEvent(new CustomEvent("orka:panel:zoom", { detail: { mode } }));
    setPanelMode(mode);
  };
  const MODES: PanelZoomMode[] = ["normal", "cartWide", "detailWide", "compact"];
  const goPrevMode = () => {
    const i = MODES.indexOf(panelMode);
    const next = MODES[(i - 1 + MODES.length) % MODES.length];
    emitPanelZoom(next);
  };
  const goNextMode = () => {
    const i = MODES.indexOf(panelMode);
    const next = MODES[(i + 1) % MODES.length];
    emitPanelZoom(next);
  };
  // 선택 패널이 닫힐 때 detailWide가 의미 없으므로 normal로 자동 복귀(시각적 일관성)
  useEffect(() => {
    if (!selected && panelMode === "detailWide") emitPanelZoom("normal");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  /** ====== Supabase로 카트아이템 보강 ====== */
  async function hydrateCartItemByRowKey(rowKey: string, hint?: SelectedApt) {
    setCart((prev) => {
      const idx = prev.findIndex((x) => x.rowKey === rowKey);
      if (idx < 0) return prev;

      const it = prev[idx];
      // 힌트로 먼저 보강
      let next: CartItem = { ...it };
      if (hint) {
        next = {
          ...next,
          name: hint.name ?? next.name,
          productName: hint.productName ?? next.productName,
          productKey:
            next.productKey ??
            classifyProductForPolicy(
              hint.productName,
              hint.installLocation,
              pickDistrict(hint.district ?? null, hint.address),
            ),
          baseMonthly: Number.isFinite(hint.monthlyFee!) ? hint.monthlyFee : next.baseMonthly,
          lat: hint.lat ?? next.lat,
          lng: hint.lng ?? next.lng,
          installLocation: hint.installLocation ?? (hint as any).install_location ?? next.installLocation,
          households: hint.households ?? next.households,
          residents: hint.residents ?? next.residents,
          monitors: hint.monitors ?? next.monitors,
          monthlyImpressions: hint.monthlyImpressions ?? next.monthlyImpressions,
          district: pickDistrict(hint.district ?? null, hint.address) ?? next.district,
        };
      }
      const place = parseRowKey(rowKey);

      // ✅ district 까지 채워져 있어야 더 이상 RPC를 안 부름
      if (next.baseMonthly && next.productName && next.installLocation && next.district) {
        next.hydrated = true;
        const copy = prev.slice();
        copy[idx] = next;
        return copy;
      }

      if (!place.placeId) {
        const copy = prev.slice();
        copy[idx] = next;
        return copy;
      }
      (async () => {
        const { data, error } = await (supabase as any).rpc("get_public_place_detail", {
          p_place_id: place.placeId,
        });
        if (error) {
          console.warn("[hydrateCartItemByRowKey] detail RPC error:", error.message);
          return;
        }
        const d = data?.[0];
        if (!d) return;

        setCart((cur) => {
          const j = cur.findIndex((x) => x.rowKey === rowKey);
          if (j < 0) return cur;
          const curItem = cur[j];

          const districtFromRpc = pickDistrict(
            hint?.district ?? curItem.district ?? (d as any)?.district ?? null,
            (d as any)?.address ?? (d as any)["주소"],
          );

          const policyKeyFromRpc = classifyProductForPolicy(
            hint?.productName ?? curItem.productName ?? d.product_name,
            curItem.installLocation ?? hint?.installLocation ?? d.install_location ?? d.installLocation,
            districtFromRpc,
          );

          const updated: CartItem = {
            ...curItem,
            name: (hint?.name ?? curItem.name) || d.name || curItem.name,
            productName: hint?.productName ?? curItem.productName ?? d.product_name ?? curItem.productName,
            productKey: policyKeyFromRpc ?? curItem.productKey,
            baseMonthly:
              Number.isFinite(curItem.baseMonthly as number) && (curItem.baseMonthly as number) > 0
                ? curItem.baseMonthly
                : (d.monthly_fee ?? curItem.baseMonthly),
            lat: curItem.lat ?? d.lat ?? hint?.lat,
            lng: curItem.lng ?? d.lng ?? hint?.lng,
            // ⚠️ 설치위치: 빈 문자열("")은 값 없는 것으로 보고, DB 값/힌트 값으로 보강
            installLocation:
              (curItem.installLocation && curItem.installLocation.trim()) ||
              (hint?.installLocation && hint.installLocation.trim()) ||
              (d.install_location && String(d.install_location).trim()) ||
              (d.installLocation && String(d.installLocation).trim()) ||
              (d["설치위치"] && String(d["설치위치"]).trim()) ||
              (d["설치 위치"] && String(d["설치 위치"]).trim()) ||
              undefined,

            // 👇 행(상품+설치위치) 단위 통계
            households: curItem.households ?? hint?.households ?? d.households ?? undefined,
            residents: curItem.residents ?? hint?.residents ?? d.residents ?? undefined,
            monitors: curItem.monitors ?? hint?.monitors ?? d.monitors ?? undefined,
            monthlyImpressions:
              curItem.monthlyImpressions ?? hint?.monthlyImpressions ?? d.monthly_impressions ?? undefined,
            district: districtFromRpc,

            hydrated: true,
          };
          const out = cur.slice();
          out[j] = updated;
          return out;
        });

        const key = keyName(hint?.name ?? d.name ?? "");
        if (key) {
          setStatsMap((prev) => ({
            ...prev,
            [key]: {
              households: d.households ?? prev[key]?.households,
              residents: d.residents ?? prev[key]?.residents,
              monthlyImpressions: d.monthly_impressions ?? prev[key]?.monthlyImpressions,
              monitors: d.monitors ?? prev[key]?.monitors,
            },
          }));
        }
      })();

      const copy = prev.slice();
      copy[idx] = next;
      return copy;
    });
  }

  /** ============================================================
   *  지도(MapPage) → 카트: 담기/취소 이벤트 수신
   * ============================================================ */
  type CartChangedDetail = { rowKey: string; selected: boolean; selectedSnapshot?: SelectedApt | null };
  useEffect(() => {
    const onCartChanged = (ev: Event) => {
      const { detail } = ev as CustomEvent<CartChangedDetail>;
      if (!detail) return;

      const { rowKey, selected: shouldSelect, selectedSnapshot } = detail;
      const snap =
        selectedSnapshot ?? (selectedRef.current && selectedRef.current.rowKey === rowKey ? selectedRef.current : null);

      setCart((prev) => {
        const already = prev.some((x) => x.rowKey === rowKey);
        if (shouldSelect) {
          if (already) {
            setTimeout(() => hydrateCartItemByRowKey(rowKey, snap ?? undefined), 0);
            return prev;
          }

          const name = snap?.name ?? "(이름 불러오는 중)";
          const productName = snap?.productName ?? undefined;
          const baseMonthly = snap?.monthlyFee ?? undefined;

          // rowKey가 있으면 rowKey를 그대로 ID로 사용, 없으면 예전 방식으로 Fallback
          const id =
            rowKey ||
            [
              String(name ?? "")
                .replace(/\s+/g, "")
                .toLowerCase(),
              String(productName ?? "")
                .replace(/\s+/g, "")
                .toLowerCase(),
            ].join("||");
          const productKey = classifyProductForPolicy(
            snap?.productName,
            snap?.installLocation,
            pickDistrict(snap?.district ?? null, snap?.address),
          );
          const defaultMonths = prev.length > 0 ? prev[0].months : 1;

          const newItem: CartItem = {
            id,
            rowKey,
            name,
            productKey,
            productName,
            baseMonthly,
            months: defaultMonths,
            lat: snap?.lat,
            lng: snap?.lng,
            installLocation: snap?.installLocation ?? (snap as any)?.install_location,
            // 👇 스냅샷에 있는 통계값 그대로 저장
            households: snap?.households,
            residents: snap?.residents,
            monitors: snap?.monitors,
            monthlyImpressions: snap?.monthlyImpressions,
            district: pickDistrict(snap?.district ?? null, snap?.address),
            hydrated: Boolean(
              snap?.monthlyFee && snap?.productName && pickDistrict(snap?.district ?? null, snap?.address),
            ),
          };

          if (snap?.name) {
            const k = keyName(snap.name);
            setStatsMap((prevStats) => ({
              ...prevStats,
              [k]: {
                households: snap.households ?? prevStats[k]?.households,
                residents: snap.residents ?? prevStats[k]?.residents,
                monthlyImpressions: snap.monthlyImpressions ?? prevStats[k]?.monthlyImpressions,
                monitors: snap.monitors ?? prevStats[k]?.monitors,
              },
            }));
          }

          setTimeout(() => hydrateCartItemByRowKey(rowKey, snap ?? undefined), 0);

          setTimeout(() => {
            document.getElementById("bulkMonthsApply")?.scrollIntoView({ behavior: "smooth", block: "start" });
          }, 0);

          return [newItem, ...prev];
        } else {
          return prev.filter((x) => x.rowKey !== rowKey);
        }
      });
    };

    window.addEventListener("orka:cart:changed", onCartChanged as EventListener);
    return () => window.removeEventListener("orka:cart:changed", onCartChanged as EventListener);
  }, []);

  /** ===== 포맷터 ===== */
  const fmtNum = (n?: number, unit = "") =>
    typeof n === "number" && Number.isFinite(n) ? n.toLocaleString() + (unit ? " " + unit : "") : "—";
  const fmtWon = (n?: number) => (typeof n === "number" && Number.isFinite(n) ? n.toLocaleString() : "—");

  /** ===== 섬네일/요약 ===== */
  const matchedFile = resolveProductFile(selected?.productName, selected?.installLocation);
  const initialThumb = selected?.imageUrl || (matchedFile ? PRIMARY_ASSET_BASE + matchedFile : PLACEHOLDER);

  const computedY1 = useMemo(() => {
    if (typeof selected?.monthlyFeeY1 === "number" && Number.isFinite(selected.monthlyFeeY1))
      return selected.monthlyFeeY1;

    const base = selected?.monthlyFee;

    const key = classifyProductForPolicy(
      selected?.productName,
      selected?.installLocation,
      pickDistrict(selected?.district ?? null, selected?.address),
    );

    if (!base || !key) return undefined;
    const periodRate = findRate(DEFAULT_POLICY[key].period, 12);
    const preRate = key === "ELEVATOR TV" ? findRate(DEFAULT_POLICY[key].precomp, 12) : 0;
    return Math.round(base * (1 - preRate) * (1 - periodRate));
  }, [selected]);

  /** ===== 총 합계 ===== */
  const cartTotal = useMemo(() => {
    return cart.reduce((sum, item) => {
      const rule = item.productKey ? DEFAULT_POLICY[item.productKey] : undefined;
      const periodRate = findRate(rule?.period, item.months);
      const preRate = item.productKey === "ELEVATOR TV" ? findRate(rule?.precomp, item.months) : 0;
      const monthlyAfter = Math.round((item.baseMonthly ?? 0) * (1 - preRate) * (1 - periodRate));
      return sum + monthlyAfter * item.months;
    }, 0);
  }, [cart]);

  const runSearch = () => {
    const q = query.trim();
    if (!q) return;
    onSearch?.(q);
  };

  /** ===== 통계 보강 ===== */
  async function fetchStatsByNames(names: string[]) {
    const uniq = Array.from(new Set(names.filter(Boolean)));
    if (!uniq.length) return;

    // ⚠️ 컬럼명 교정: '송출횟수'가 아니라 '월송출횟수'가 실제 컬럼
    const { data, error } = await supabase
      .from("raw_places")
      .select("단지명, 세대수, 거주인원, 월송출횟수, 모니터수량")
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
        monthlyImpressions: row["월송출횟수"] != null ? Number(row["월송출횟수"]) : undefined,
        monitors: row["모니터수량"] != null ? Number(row["모니터수량"]) : undefined,
      };
    });
    setStatsMap((prev) => ({ ...prev, ...map }));
  }

  /* ===== 담기/삭제 (2탭 버튼) ===== */
  const makeIdFromSelected = (s: SelectedApt) => {
    // rowKey가 있으면 그 자체를 ID로 사용 (단지+상품+설치위치까지 포함된 고유키)
    if (s.rowKey) return s.rowKey;

    const nk = (v?: string) => (v ? v.replace(/\s+/g, "").toLowerCase() : "");
    const nameKey = nk(s.name || s.address || "");
    const prodKey = nk(s.productName || "");
    const locKey = nk(s.installLocation || (s as any).install_location || "");

    // 설치 위치까지 포함해서 동일 단지/상품이라도 위치가 다르면 다른 ID가 되도록
    return [nameKey, prodKey, locKey].join("||");
  };

  const addSelectedToCart = () => {
    if (!selected) return;
    const id = makeIdFromSelected(selected); // 이제 기본적으로 rowKey 사용
    const productKey = classifyProductForPolicy(
      selected.productName,
      selected.installLocation,
      pickDistrict(selected.district ?? null, selected.address),
    );

    setCart((prev) => {
      // rowKey가 있으면 rowKey 기준, 없으면 예전 id 기준으로 동일 항목 판단
      const match = (x: CartItem) => (selected.rowKey ? x.rowKey === selected.rowKey : x.id === id);

      const exists = prev.find((x) => (selected.rowKey ? x.rowKey === selected.rowKey : x.id === id));
      if (exists) {
        return prev.map((x) =>
          match(x)
            ? {
                ...x,
                rowKey: selected.rowKey ?? x.rowKey,
                name: selected.name,
                productKey,
                productName: selected.productName,
                baseMonthly: selected.monthlyFee,
                lat: selected.lat,
                lng: selected.lng,
                installLocation: selected.installLocation ?? x.installLocation,

                households: selected.households ?? x.households,
                residents: selected.residents ?? x.residents,
                monitors: selected.monitors ?? x.monitors,
                monthlyImpressions: selected.monthlyImpressions ?? x.monthlyImpressions,
                district: pickDistrict(selected.district ?? null, selected.address) ?? x.district,

                hydrated: true,
              }
            : x,
        );
      }

      // rowKey가 다른(= 설치 위치가 다른) 상품은 새 줄로 추가
      const defaultMonths = prev.length > 0 ? prev[0].months : 1;
      const newItem: CartItem = {
        id,
        rowKey: selected.rowKey,
        name: selected.name,
        productKey,
        productName: selected.productName,
        baseMonthly: selected.monthlyFee,
        months: defaultMonths,
        lat: selected.lat,
        lng: selected.lng,
        installLocation: selected.installLocation,

        households: selected.households,
        residents: selected.residents,
        monitors: selected.monitors,
        monthlyImpressions: selected.monthlyImpressions,
        district: pickDistrict(selected.district ?? null, selected.address),

        hydrated: true,
      };

      return [newItem, ...prev];
    });

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
    }

    if (selected.rowKey) setMarkerStateByRowKey?.(selected.rowKey, "selected", true);
    else setMarkerState?.(selected.name, "selected");
    if (selected.rowKey) {
      // 2탭에서 담은 것도 RPC로 보강해서 district / productKey 다시 확정
      hydrateCartItemByRowKey(selected.rowKey, selected as any);
    }
  };
  const removeItem = (id: string) => {
    setCart((prev) => {
      const removed = prev.find((x) => x.id === id);
      const next = prev.filter((x) => x.id !== id);
      if (removed?.rowKey && !next.some((x) => x.rowKey === removed.rowKey))
        setMarkerStateByRowKey?.(removed.rowKey, "default");
      else if (removed?.name && !next.some((x) => x.name === removed.name)) setMarkerState?.(removed.name, "default");
      return next;
    });
  };

  const updateMonths = (id: string, months: number) => {
    if (applyAll) setCart((prev) => prev.map((x) => ({ ...x, months })));
    else setCart((prev) => prev.map((x) => (x.id === id ? { ...x, months } : x)));
  };

  /* ===== 2탭 버튼 즉시 토글 ===== */
  const inCart =
    !!selected &&
    (selected.rowKey
      ? cart.some((c) => c.rowKey === selected.rowKey)
      : cart.some((c) => c.id === makeIdFromSelected(selected)));

  const onClickAddOrCancel = () => {
    if (!selected) return;
    const id = makeIdFromSelected(selected);
    if (inCart) {
      removeItem(id);
      if (selected.rowKey) setMarkerStateByRowKey?.(selected.rowKey, "default");
      else setMarkerState?.(selected.name, "default");
    } else {
      addSelectedToCart();
    }
  };

  /* ===== 카트 아파트명 클릭 → 지도 포커스 & 2탭 ===== */
  const focusFromCart = (item: CartItem) => {
    // ✅ 1) 2탭 상세에 이 단지를 선택해 달라고 MapPage에 알려줌
    if (item.rowKey) {
      onCartItemSelectByRowKey?.(item.rowKey);
      // ✅ 2) 지도 이동(기존 기능 유지)
      if (focusByRowKey) {
        focusByRowKey(item.rowKey, { level: 4 });
        return;
      }
    }

    // rowKey 없거나 focusByRowKey 미구현 시, 좌표 기반 포커스 (기존 fallback 유지)
    if (item.lat != null && item.lng != null && focusByLatLng) {
      focusByLatLng(item.lat, item.lng, { level: 4 });
    }
  };

  /* ✅ 카트 슬롯(1~5) 제어 핸들러 */

  // + 버튼: 현재 카트를 선택된 슬롯에 저장
  const handleSaveSlot = (slotNo: number) => {
    if (!cart.length) return;
    saveCartSlot(slotNo, cart as any[]);
  };

  // 숫자 버튼: 저장된 슬롯이면 카트로 불러오기
  const handleLoadSlot = (slotNo: number) => {
    const items = getSlotItems(slotNo) as CartItem[] | null;
    if (!items) return;

    setCart((prev) => {
      // 기존 카트에 있던 마커는 모두 기본 상태로
      prev.forEach((it) => {
        if (it.rowKey) setMarkerStateByRowKey?.(it.rowKey, "default");
        else setMarkerState?.(it.name, "default");
      });

      // 불러온 카트의 마커는 선택 상태로
      items.forEach((it) => {
        if (it.rowKey) setMarkerStateByRowKey?.(it.rowKey, "selected");
        else setMarkerState?.(it.name, "selected");
      });

      // 실제 상태는 슬롯에서 가져온 아이템으로 교체
      return items.map((it) => ({ ...it }));
    });

    // 통계 맵도 슬롯 데이터 기준으로 보강
    setStatsMap((prevStats) => {
      const next = { ...prevStats };
      items.forEach((it) => {
        const k = keyName(it.name || "");
        if (!k) return;
        next[k] = {
          households: it.households ?? next[k]?.households,
          residents: it.residents ?? next[k]?.residents,
          monthlyImpressions: it.monthlyImpressions ?? next[k]?.monthlyImpressions,
          monitors: it.monitors ?? next[k]?.monitors,
        };
      });
      return next;
    });
  };

  // - 버튼: 해당 슬롯 비우기 (슬롯만 삭제, 현재 카트는 그대로)
  const handleClearSlot = async (slotNo: number) => {
    await supabase.from("saved_cart_slots").delete().eq("slot_no", slotNo);
    await refreshCartSlots();
  };

  /** ===== 견적 모달 열릴 때 미보강 아이템 보강 ===== */
  useEffect(() => {
    if (!openQuote) return;
    const need = cart.filter((c) => !c.hydrated || !c.baseMonthly || !c.productName || !c.installLocation);
    if (!need.length) return;

    // 🔧 각 아이템 "자기 자신"의 정보를 힌트로 넘긴다.
    //    → selectedRef.current 같은 공통 객체는 전혀 사용하지 않으므로
    //      "마지막 단지로 싹 바뀌는" 버그는 다시 생기지 않는다.
    need.forEach((c) =>
      hydrateCartItemByRowKey(
        c.rowKey!,
        {
          rowKey: c.rowKey,
          name: c.name,
          productName: c.productName,
          installLocation: c.installLocation,
          monthlyFee: c.baseMonthly,
          lat: c.lat,
          lng: c.lng,
          district: c.district,
        } as any, // SelectedApt 형태로 최소 필드만 맞춰서 힌트로 사용
      ),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openQuote]);

  /** ===== 견적서 빌더 ===== */
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

      // CartItem에 저장된 값 우선, 없으면 기존 statsMap fallback
      const households = c.households ?? s?.households;
      const residents = c.residents ?? s?.residents;
      const monthlyImpressions = c.monthlyImpressions ?? s?.monthlyImpressions;
      const monitors = c.monitors ?? s?.monitors;

      // ✅ 이 카트 아이템과 현재 selected가 같은 rowKey인지 확인
      const selectedForRow =
        selectedRef.current && selectedRef.current.rowKey && c.rowKey && selectedRef.current.rowKey === c.rowKey
          ? selectedRef.current
          : null;

      // ✅ 1순위: cart에 들어있는 installLocation
      const installLocation =
        c.installLocation ?? selectedForRow?.installLocation ?? (selectedForRow as any)?.install_location ?? undefined;

      return {
        id: c.id,
        name: c.name,
        months: c.months,
        startDate: yyyy_mm_dd(today),
        endDate: yyyy_mm_dd(addMonths(today, c.months)),
        mediaName: c.productName,
        baseMonthly: c.baseMonthly,
        productKeyHint: c.productKey,
        households,
        residents,
        monthlyImpressions,
        monitors,
        installLocation,
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
      cart_snapshot: cart.length ? { items: cart, months: monthsMax, cartTotal } : undefined,
    };
  };

  /* ✅ MapPage에서 전달된 폭 적용(없으면 360 기본) */
  const CART_W = Math.max(280, Math.round(cartWidthPx ?? 360));
  const DETAIL_W = Math.max(320, Math.round(detailWidthPx ?? 360));

  return (
    <>
      {/* 상단 바 */}
      <div className="fixed top-0 left-0 right-0 h-16 bg-white border-b border-[#E5E7EB] z-[60]">
        <div className="h-full flex items-center justify-between px-6 gap-4">
          {/* 좌측: 타이틀 + 패널 줌 + (로그인 시) 슬롯 */}
          <div className="flex items-center gap-4 min-w-0">
            {/* 1) 타이틀 클릭 시 메인 사이트 이동 */}
            <button
              type="button"
              onClick={() => {
                window.location.href = "https://www.apt-orka.kr";
              }}
              className="text-xl font-bold text-black whitespace-nowrap hover:text-[#6C2DFF]"
            >
              응답하라 입주민이여
            </button>

            {/* 2) 패널 확대/축소 버튼 */}
            <PanelZoomButtonsAny
              className="ml-1"
              onPrev={goPrevMode}
              onNext={goNextMode}
              onChange={(m: PanelZoomMode) => emitPanelZoom(m)}
              onZoomChange={(m: PanelZoomMode) => emitPanelZoom(m)}
            />

            {/* 4) 구독회원 로그인 시 슬롯 버튼 / + / - 노출 */}
            {isLoggedIn && (
              <div className="ml-4">
                <CartSlotsBar
                  slots={cartSlots}
                  loading={cartSlotsLoading}
                  onSaveSlot={handleSaveSlot}
                  onLoadSlot={handleLoadSlot}
                  onClearSlot={handleClearSlot}
                />
              </div>
            )}
          </div>

          {/* 3) 맨 오른쪽 로그인 버튼 (항상 표시) */}
          <button
            type="button"
            onClick={() => {
              // 필요하면 /login 대신 실제 로그인 경로로 바꿔줘
              window.location.href = "/login";
            }}
            className="h-9 px-4 rounded-md border border-[#6C2DFF] text-sm font-semibold text-[#6C2DFF] hover:bg-[#F4F0FB]"
          >
            로그인
          </button>
        </div>
      </div>

      {/* 1탭: 카트 */}
      <aside
        className="hidden md:flex fixed top-16 bottom-0 left-0 z-[60] bg-white border-r border-[#E5E7EB]"
        /* ✅ 폭만 동적으로 반영 */
        style={{ width: CART_W }}
      >
        <div className="flex flex-col h-full w-full px-5 py-5 gap-3">
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

          <div className="relative">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && runSearch()}
              className="w-full h-10 rounded-md border border-[#E5E7EB] pl-3 pr-10 text-sm placeholder:text-[#757575] outline-none"
              placeholder="지역명, 단지명, 건물명을 입력하세요"
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

          <div className="space-y-2">
            <div className="text-sm font-semibold">총 비용</div>
            <div className="h-10 rounded-[10px] bg-[#F4F0FB] flex items-center px-3 text-sm text-[#6C2DFF] font-bold">
              {fmtWon(cartTotal)}원 <span className="ml-1 text-[11px] font-normal">(VAT별도)</span>
            </div>
          </div>

          <div className="rounded-2xl border border-[#E5E7EB] bg-white flex-1 min-h-0 overflow-hidden">
            {cart.length === 0 ? (
              <div className="relative h-full">
                <div className="absolute inset-0 grid place-items-center p-6">
                  <div className="w-full max-w-[320px] min-h-[200px] grid place-items-center text-center">
                    <img src="/atp.png" alt="아파트 아이콘" className="w-16 h-16 mb-3 object-contain" />
                    <div className="text-x1 text-[#6B7280] font-semibold leading-relaxed">
                      <span className="block">광고를 원하는</span>
                      <span className="block">아파트 단지를 담아주세요!</span>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="h-full overflow-y-auto">
                <div
                  className="sticky top-0 z-10 bg-white/95 backdrop-blur px-5 pt-5 pb-2 border-b border-[#F3F4F6]"
                  id="bulkMonthsApply"
                >
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

                <div className="px-5 pb-4 space-y-3">
                  {cart.map((item) => (
                    <CartItemCard
                      key={item.id}
                      item={item}
                      onChangeMonths={updateMonths}
                      onRemove={removeItem}
                      onTitleClick={() => focusFromCart(item)}
                    />
                  ))}
                </div>

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

      {/* 2탭: 상세 */}
      {selected && (
        <aside
          className="hidden md:block fixed top-16 z-[60] pointer-events-none"
          /* ✅ 왼쪽 오프셋과 폭을 동적으로 반영 (기존 left/w 클래스를 인라인 style로 덮어씀) */
          style={{ left: CART_W, width: DETAIL_W, bottom: 0 }}
        >
          <div className="h-full px-6 py-5 max-h-[calc(100vh-4rem)] overflow-y-auto">
            <div className="pointer-events-auto flex flex-col gap-4">
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

              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="text-xl font-bold text.black whitespace-pre-wrap break-words">{selected.name}</div>
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

              <div className="rounded-2xl bg-[#F6F7FB] h-14 px-5 flex items-center justify-between">
                <div className="text-[#6B7280]">월 광고료</div>
                <div className="text-lg font-semibold text-black">
                  {fmtWon(selected.monthlyFee)}{" "}
                  <span className="align-baseline text-[11px] text-[#111827] font-normal">(VAT별도)</span>
                </div>
              </div>

              <div className="rounded-2xl border border-[#7C3AED] bg-[#F4F0FB] h-14 px-4 flex items-center justify-between text-[#7C3AED]">
                <span className="text-sm font-medium">1년 계약 시 월 광고료</span>
                <span className="text-base font-bold">
                  {fmtWon(computedY1)} <span className="align-baseline text-[11px] font-medium">(VAT별도)</span>
                </span>
              </div>

              {/* 즉시 토글 */}
              <button
                className={`mt-1 h-12 w-full rounded-xl font-semibold transition-colors ${
                  inCart ? "bg-[#E5E7EB] text-[#6B7280]" : "bg-[#6C2DFF] text-white"
                }`}
                onClick={onClickAddOrCancel}
              >
                {inCart ? "담기취소" : "아파트 담기"}
              </button>

              <div className="rounded-2xl border border-[#E5E7EB] bg-white overflow-hidden">
                <div className="px-4 py-3 text-base font-semibold text-black border-b border-[#F3F4F6]">상세정보</div>
                <dl className="px-4 py-2 text-sm">
                  <Row label="상품명">
                    <span className="text-[#6C2DFF] font-semibold whitespace-pre-wrap break-words">
                      {selected.productName || "—"}
                    </span>
                  </Row>
                  <Row label="설치 위치">
                    <span className="whitespace-pre-wrap break-words">
                      {selected.installLocation ?? (selected as any)?.install_location ?? "—"}
                    </span>
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
        onSubmitInquiry={() => {
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
  onTitleClick: () => void;
};
function CartItemCard({ item, onChangeMonths, onRemove, onTitleClick }: CartItemCardProps) {
  // 🔍 카트 아이템 로그
  console.log("[CartItem]", {
    name: item.name,
    productName: item.productName,
    district: item.district,
    productKey: item.productKey,
    months: item.months,
  });
  const rule = item.productKey ? DEFAULT_POLICY[item.productKey] : undefined;
  const periodRate = findRate(rule?.period, item.months);
  const preRate = item.productKey === "ELEVATOR TV" ? findRate(rule?.precomp, item.months) : 0;
  const monthlyAfter = Math.round((item.baseMonthly ?? 0) * (1 - preRate) * (1 - periodRate));
  const total = monthlyAfter * item.months;
  const discountCombined = 1 - (1 - preRate) * (1 - periodRate);

  return (
    <div className="rounded-2xl border border-[#E5E7EB] bg.white p-4">
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <button
            onClick={onTitleClick}
            className="font-semibold text-black leading-tight truncate hover:underline text-left"
            title="지도로 이동하여 상세보기"
          >
            {item.name}
          </button>
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
        <div className="text-sm text-[#6B7280]">월광고료</div>
        <div className="text-sm text-black whitespace-nowrap">{monthlyAfter.toLocaleString()}원</div>
      </div>

      <div className="mt-2 flex items-center justify-between">
        <div className="text-sm text-[#6B7280]">총광고료</div>
        <div className="text-sm text-right text-black whitespace-nowrap">
          {discountCombined > 0 ? (
            <span className="inline-flex items-center rounded-md bg-[#F4F0FB] text-[#6C2DFF] text-[11px] font-semibold px-2 py-[2px] mr-2 align-middle">
              {(Math.round(discountCombined * 1000) / 10).toFixed(1).replace(/\.0$/, "")}
              %할인
            </span>
          ) : null}
          <span className="text-[#6C2DFF] font-bold align-middle">{total.toLocaleString()}원</span>
        </div>
      </div>
    </div>
  );
}
