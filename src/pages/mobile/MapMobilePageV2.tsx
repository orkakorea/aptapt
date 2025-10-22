import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useKakaoLoader } from "@/hooks/useKakaoLoader";
import { useKakaoMap } from "@/hooks/useKakaoMap";
import { useMarkers } from "@/hooks/useMarkers";
import { usePlaceSearch } from "@/hooks/usePlaceSearch";
import { useSheetDrag } from "@/hooks/useSheetDrag";
import BottomSheet from "@/components/mobile/BottomSheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, ShoppingCart, Phone, Package, X } from "lucide-react";

/* =========================================================================
 * Types
 * ========================================================================= */
type SelectedApt = {
  rowKey: string;
  name: string;
  address?: string;
  productName?: string;
  installLocation?: string;
  households?: number;
  residents?: number;
  monitors?: number;
  monthlyImpressions?: number;
  costPerPlay?: number;
  hours?: string;
  monthlyFee?: number;
  monthlyFeeY1?: number;
  imageUrl?: string;
  lat: number;
  lng: number;
};

type CartItem = {
  rowKey: string;
  aptName: string;
  productName?: string;
  months: number;
  baseMonthly?: number;
  monthlyFeeY1?: number;
};

/* =========================================================================
 * Utilities
 * ========================================================================= */
const fmtNum = (n?: number | null) => (Number.isFinite(Number(n)) ? Number(n).toLocaleString("ko-KR") : "-");
const fmtWon = (n?: number | null) => (Number.isFinite(Number(n)) ? `${Number(n).toLocaleString("ko-KR")}원` : "-");

function imageForProduct(productName?: string): string {
  const p = (productName || "").toLowerCase().replace(/\s+/g, "");
  if (p.includes("elevat")) return "/products/elevator-tv.png";
  if (p.includes("townbord") || p.includes("townboard")) {
    if (p.includes("_l") || p.endsWith("l")) return "/products/townbord-b.png";
    return "/products/townbord-a.png";
  }
  if (p.includes("media")) return "/products/media-meet-a.png";
  if (p.includes("space")) return "/products/space-living.png";
  if (p.includes("hipost") || (p.includes("hi") && p.includes("post"))) return "/products/hi-post.png";
  return "/placeholder.svg";
}

const monthOptions: number[] = Array.from({ length: 12 }, (_, i) => i + 1);

/* =========================================================================
 * Main Component
 * ========================================================================= */
export default function MapMobilePageV2() {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  
  // Kakao SDK
  const { kakao, loading: kakaoLoading, error: kakaoError } = useKakaoLoader();
  
  // Map Instance
  const mapApi = useKakaoMap(mapContainerRef, {
    kakao,
    center: { lat: 37.5665, lng: 126.978 },
    level: 6,
    onReady: () => {
      console.log("[MapV2] Map ready");
    },
    onIdle: () => {
      console.log("[MapV2] Map idle");
    },
    clusterer: {
      enable: true,
      options: {
        averageCenter: true,
        minLevel: 6,
        disableClickZoom: true,
        gridSize: 80,
      },
    },
  });

  const { map, clusterer } = mapApi;

  // Markers
  const markersApi = useMarkers({
    kakao,
    map,
    clusterer,
    autoReloadOnIdle: true,
    limitForLevel: (level) => {
      if (level <= 5) return 1000;
      if (level <= 7) return 500;
      return 200;
    },
    onSelect: (selected) => {
      if (selected) {
        setSelected(selected);
        setSheetOpen(true);
        setActiveTab("detail");
      }
    },
  });

  // Place Search
  const { run: searchPlace } = usePlaceSearch({
    kakao,
    map,
    defaultLevel: 5,
    smoothPan: true,
    onSearched: (result) => {
      console.log("[MapV2] Search result:", result);
    },
  });

  // UI State
  const [selected, setSelected] = useState<SelectedApt | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"cart" | "detail">("cart");
  const [searchQ, setSearchQ] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [snack, setSnack] = useState<string | null>(null);

  // Bottom Sheet Drag
  const { translateY, onHandlePointerDown } = useSheetDrag({
    open: sheetOpen,
    threshold: 100,
    onClose: () => setSheetOpen(false),
  });

  // Snackbar
  const showSnack = (msg: string) => {
    setSnack(msg);
    setTimeout(() => setSnack(null), 2200);
  };

  // Search Handler
  const handleSearch = async () => {
    if (!searchQ.trim()) return;
    const success = await searchPlace(searchQ);
    if (!success) {
      showSnack("검색 결과가 없습니다");
    }
  };

  // Cart Actions
  const addToCart = (item: CartItem) => {
    setCart((prev) => {
      const exists = prev.find((c) => c.rowKey === item.rowKey);
      if (exists) {
        showSnack("이미 장바구니에 있습니다");
        return prev;
      }
      showSnack("장바구니에 추가되었습니다");
      return [...prev, item];
    });
  };

  const removeFromCart = (rowKey: string) => {
    setCart((prev) => prev.filter((c) => c.rowKey !== rowKey));
    showSnack("장바구니에서 제거되었습니다");
  };

  // Update cart months
  const updateCartMonths = (rowKey: string, months: number) => {
    setCart((prev) => prev.map((item) => (item.rowKey === rowKey ? { ...item, months } : item)));
  };

  // Cart total
  const cartTotal = useMemo(() => {
    return cart.reduce((sum, item) => {
      const monthly = item.baseMonthly || 0;
      return sum + monthly * item.months;
    }, 0);
  }, [cart]);

  return (
    <div className="relative w-full h-screen overflow-hidden">
      {/* Map Container */}
      <div ref={mapContainerRef} className="absolute inset-0 w-full h-full" />

      {/* Top Search Bar */}
      <div className="absolute top-4 left-4 right-4 z-10 flex gap-2">
        <div className="flex-1 flex gap-2 bg-white rounded-lg shadow-lg p-2">
          <Input
            ref={useRef<HTMLInputElement>(null)}
            type="text"
            placeholder="아파트, 지역 검색"
            value={searchQ}
            onChange={(e) => setSearchQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSearch();
            }}
            className="flex-1 border-0 focus-visible:ring-0"
          />
          <Button onClick={handleSearch} size="icon" variant="ghost">
            <Search className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* Loading Overlay */}
      {kakaoLoading && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-white/80">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4" />
            <p className="text-sm text-muted-foreground">지도 로딩 중...</p>
          </div>
        </div>
      )}

      {/* Error Display */}
      {kakaoError && (
        <div className="absolute top-20 left-4 right-4 z-50 bg-destructive text-destructive-foreground p-4 rounded-lg shadow-lg">
          <p className="font-semibold">지도 로딩 오류</p>
          <p className="text-sm mt-1">{kakaoError}</p>
        </div>
      )}

      {/* Floating Cart Button */}
      <button
        onClick={() => {
          setSheetOpen(true);
          setActiveTab("cart");
        }}
        className="fixed bottom-20 right-4 z-20 bg-primary text-primary-foreground rounded-full p-4 shadow-lg hover:scale-105 transition-transform"
      >
        <ShoppingCart className="h-6 w-6" />
        {cart.length > 0 && (
          <span className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
            {cart.length}
          </span>
        )}
      </button>

      {/* Phone Button */}
      <a
        href="tel:123-456-7890"
        className="fixed bottom-4 right-4 z-20 bg-secondary text-secondary-foreground rounded-full p-4 shadow-lg hover:scale-105 transition-transform"
      >
        <Phone className="h-6 w-6" />
      </a>

      {/* Bottom Sheet */}
      <BottomSheet
        open={sheetOpen}
        translateY={translateY}
        maxHeightPx={600}
        onHandlePointerDown={onHandlePointerDown}
      >
        <div className="flex flex-col h-full">
          {/* Tabs */}
          <div className="flex border-b border-border">
            <button
              onClick={() => setActiveTab("cart")}
              className={`flex-1 py-3 text-sm font-medium transition-colors ${
                activeTab === "cart"
                  ? "text-primary border-b-2 border-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              장바구니 ({cart.length})
            </button>
            <button
              onClick={() => setActiveTab("detail")}
              className={`flex-1 py-3 text-sm font-medium transition-colors ${
                activeTab === "detail"
                  ? "text-primary border-b-2 border-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              상세정보
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto">
            {activeTab === "cart" ? (
              <CartView
                cart={cart}
                onRemove={removeFromCart}
                onUpdateMonths={updateCartMonths}
                total={cartTotal}
              />
            ) : (
              <DetailView selected={selected} onAddToCart={addToCart} />
            )}
          </div>

          {/* Close Button */}
          <button
            onClick={() => setSheetOpen(false)}
            className="absolute top-2 right-2 p-2 hover:bg-accent rounded-full transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </BottomSheet>

      {/* Snackbar */}
      {snack && (
        <div className="fixed bottom-32 left-1/2 -translate-x-1/2 z-50 bg-foreground text-background px-4 py-2 rounded-lg shadow-lg animate-fade-in">
          {snack}
        </div>
      )}
    </div>
  );
}

/* =========================================================================
 * Cart View
 * ========================================================================= */
function CartView({
  cart,
  onRemove,
  onUpdateMonths,
  total,
}: {
  cart: CartItem[];
  onRemove: (rowKey: string) => void;
  onUpdateMonths: (rowKey: string, months: number) => void;
  total: number;
}) {
  if (cart.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-8">
        <ShoppingCart className="h-16 w-16 text-muted-foreground mb-4" />
        <p className="text-lg font-semibold text-foreground mb-2">장바구니가 비어있습니다</p>
        <p className="text-sm text-muted-foreground">지도에서 원하는 광고를 선택해주세요</p>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      {cart.map((item) => (
        <div key={item.rowKey} className="bg-card border border-border rounded-lg p-4 space-y-3">
          <div className="flex justify-between items-start">
            <div className="flex-1">
              <h3 className="font-semibold text-foreground">{item.aptName}</h3>
              <p className="text-sm text-muted-foreground">{item.productName || "상품명 없음"}</p>
            </div>
            <button
              onClick={() => onRemove(item.rowKey)}
              className="p-1 hover:bg-accent rounded transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">계약 기간:</span>
            <select
              value={item.months}
              onChange={(e) => onUpdateMonths(item.rowKey, Number(e.target.value))}
              className="flex-1 px-2 py-1 border border-border rounded text-sm bg-background"
            >
              {monthOptions.map((m) => (
                <option key={m} value={m}>
                  {m}개월
                </option>
              ))}
            </select>
          </div>

          <div className="flex justify-between items-center pt-2 border-t border-border">
            <span className="text-sm font-medium">월 광고료</span>
            <span className="font-bold text-primary">{fmtWon(item.baseMonthly)}</span>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-sm font-medium">총액</span>
            <span className="font-bold text-lg">{fmtWon((item.baseMonthly || 0) * item.months)}</span>
          </div>
        </div>
      ))}

      <div className="sticky bottom-0 bg-background border-t border-border pt-4 mt-4">
        <div className="flex justify-between items-center mb-4">
          <span className="text-lg font-bold">총 계약금액</span>
          <span className="text-2xl font-bold text-primary">{fmtWon(total)}</span>
        </div>
        <Button className="w-full" size="lg">
          <Package className="mr-2 h-5 w-5" />
          견적서 받기
        </Button>
      </div>
    </div>
  );
}

/* =========================================================================
 * Detail View
 * ========================================================================= */
function DetailView({
  selected,
  onAddToCart,
}: {
  selected: SelectedApt | null;
  onAddToCart: (item: CartItem) => void;
}) {
  const [months, setMonths] = useState(1);

  if (!selected) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-8">
        <p className="text-lg font-semibold text-foreground mb-2">선택된 광고가 없습니다</p>
        <p className="text-sm text-muted-foreground">지도에서 마커를 클릭해주세요</p>
      </div>
    );
  }

  const handleAddToCart = () => {
    onAddToCart({
      rowKey: selected.rowKey,
      aptName: selected.name,
      productName: selected.productName,
      months,
      baseMonthly: selected.monthlyFee,
      monthlyFeeY1: selected.monthlyFeeY1,
    });
  };

  return (
    <div className="p-4 space-y-4">
      {/* Product Image */}
      <div className="relative w-full aspect-video rounded-lg overflow-hidden bg-muted">
        <img
          src={imageForProduct(selected.productName)}
          alt={selected.productName || "상품"}
          className="w-full h-full object-cover"
        />
      </div>

      {/* Basic Info */}
      <div>
        <h2 className="text-xl font-bold text-foreground mb-1">{selected.name}</h2>
        <p className="text-sm text-muted-foreground">{selected.address || "주소 정보 없음"}</p>
      </div>

      {/* Product Details */}
      <div className="bg-card border border-border rounded-lg p-4 space-y-2">
        <div className="flex justify-between">
          <span className="text-sm text-muted-foreground">상품명</span>
          <span className="text-sm font-medium">{selected.productName || "-"}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-sm text-muted-foreground">설치위치</span>
          <span className="text-sm font-medium">{selected.installLocation || "-"}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-sm text-muted-foreground">세대수</span>
          <span className="text-sm font-medium">{fmtNum(selected.households)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-sm text-muted-foreground">거주민</span>
          <span className="text-sm font-medium">{fmtNum(selected.residents)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-sm text-muted-foreground">모니터수</span>
          <span className="text-sm font-medium">{fmtNum(selected.monitors)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-sm text-muted-foreground">월 노출수</span>
          <span className="text-sm font-medium">{fmtNum(selected.monthlyImpressions)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-sm text-muted-foreground">노출당 비용</span>
          <span className="text-sm font-medium">{fmtWon(selected.costPerPlay)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-sm text-muted-foreground">방영시간</span>
          <span className="text-sm font-medium">{selected.hours || "-"}</span>
        </div>
      </div>

      {/* Pricing */}
      <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm font-medium">월 광고료</span>
          <span className="text-xl font-bold text-primary">{fmtWon(selected.monthlyFee)}</span>
        </div>
        {selected.monthlyFeeY1 && (
          <div className="flex justify-between items-center text-sm">
            <span className="text-muted-foreground">12개월 계약 시</span>
            <span className="font-semibold">{fmtWon(selected.monthlyFeeY1)}/월</span>
          </div>
        )}
      </div>

      {/* Month Selection */}
      <div className="space-y-2">
        <label className="text-sm font-medium">계약 기간 선택</label>
        <select
          value={months}
          onChange={(e) => setMonths(Number(e.target.value))}
          className="w-full px-3 py-2 border border-border rounded-lg bg-background"
        >
          {monthOptions.map((m) => (
            <option key={m} value={m}>
              {m}개월
            </option>
          ))}
        </select>
      </div>

      {/* Add to Cart Button */}
      <Button onClick={handleAddToCart} className="w-full" size="lg">
        <ShoppingCart className="mr-2 h-5 w-5" />
        장바구니에 담기
      </Button>
    </div>
  );
}
