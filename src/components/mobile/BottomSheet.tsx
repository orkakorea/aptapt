import React, { useCallback, useEffect, useRef, useState } from "react";

type Props = {
  open: boolean;
  maxHeightPx?: number; // 시트 전체 최대 높이
  thresholdPx?: number; // 드래그로 닫기 임계값 (기본 120px)
  onClose: () => void;
  resetScrollKey?: string; // ✅ 값이 바뀔 때마다 스크롤 맨 위로
  children: React.ReactNode;
};

export default function BottomSheet({
  open,
  maxHeightPx,
  thresholdPx = 120,
  onClose,
  resetScrollKey,
  children,
}: Props) {
  // -----------------------------
  // 내부 상태/레퍼런스
  // -----------------------------
  const [dragY, setDragY] = useState(0);
  const startYRef = useRef<number | null>(null);
  const draggingRef = useRef(false);

  const contentRef = useRef<HTMLDivElement>(null);

  // SSR 안전: window 없이 초기 높이 결정
  const [heightPx, setHeightPx] = useState<number>(() =>
    typeof window === "undefined" ? (maxHeightPx ?? 480) : (maxHeightPx ?? Math.floor(window.innerHeight * 0.75)),
  );

  // 힌트 상태 (ref로도 보관해서 스크롤 핸들러의 stale state 방지)
  const [hasOverflow, setHasOverflow] = useState(false);
  const hasOverflowRef = useRef(false);
  useEffect(() => {
    hasOverflowRef.current = hasOverflow;
  }, [hasOverflow]);

  const [showHint, setShowHint] = useState(false);

  // 열려 있고 드래그 중이 아니면 transform 제거(iOS 스크롤 버그 회피)
  const isRestOpen = open && dragY === 0;

  // -----------------------------
  // 높이 재계산 (open/리사이즈/props 변경 시)
  // -----------------------------
  const recalcHeight = useCallback(() => {
    const base = typeof window === "undefined" ? 480 : Math.floor(window.innerHeight * 0.75);
    setHeightPx(maxHeightPx ?? base);
  }, [maxHeightPx]);

  useEffect(() => {
    if (!open) return;
    recalcHeight();
    const onResize = () => recalcHeight();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [open, recalcHeight]);

  // -----------------------------
  // 스크롤 리셋
  // -----------------------------
  useEffect(() => {
    if (!open) return;
    const el = contentRef.current;
    if (!el) return;
    el.scrollTo({ top: 0, behavior: "auto" });
  }, [open, resetScrollKey]);

  // -----------------------------
  // 오버플로우 힌트 계산
  // -----------------------------
  const recomputeOverflow = useCallback(() => {
    const el = contentRef.current;
    if (!el) return;
    const overflow = el.scrollHeight > el.clientHeight + 2;
    setHasOverflow(overflow);
    hasOverflowRef.current = overflow;
    setShowHint(overflow && el.scrollTop <= 4);
  }, []);

  useEffect(() => {
    if (!open) return;
    const el = contentRef.current;
    if (!el) return;

    recomputeOverflow();

    const onScroll = () => {
      if (!el) return;
      // 맨 위면 힌트 보이기(오버플로우 있을 때만), 내려가면 숨기기
      if (el.scrollTop > 4) setShowHint(false);
      else if (hasOverflowRef.current) setShowHint(true);
    };

    const onResize = () => recomputeOverflow();

    el.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize);

    return () => {
      el.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
    };
  }, [open, recomputeOverflow]);

  // -----------------------------
  // 드래그(스와이프 다운) 핸들
  // -----------------------------
  const onHandleDown = (e: React.PointerEvent) => {
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    draggingRef.current = true;
    startYRef.current = e.clientY;
    setDragY(0);

    const onMove = (ev: PointerEvent) => {
      if (!draggingRef.current || startYRef.current == null) return;
      ev.preventDefault(); // iOS 스크롤 차단(핸들 드래그 중)
      const dy = Math.max(0, ev.clientY - startYRef.current);
      setDragY(dy);
    };

    const onEnd = (ev: PointerEvent) => {
      // 일부 브라우저에서 preventDefault가 영향 없음 — 그래도 호출
      ev.preventDefault?.();
      if (!draggingRef.current) return;
      const dy = Math.max(0, ev.clientY - (startYRef.current ?? ev.clientY));
      draggingRef.current = false;
      startYRef.current = null;
      setDragY(0);
      if (dy > thresholdPx) onClose();

      // removeEventListener는 'capture' 일치만 중요 → false로 고정
      window.removeEventListener("pointermove", onMove, false);
      window.removeEventListener("pointerup", onEnd, false);
      window.removeEventListener("pointercancel", onEnd, false);
    };

    // passive:false 가 필요한 케이스이지만, remove 시에는 capture 플래그만 맞추면 됨
    window.addEventListener("pointermove", onMove, { passive: false });
    window.addEventListener("pointerup", onEnd, false);
    window.addEventListener("pointercancel", onEnd, false);
  };

  // -----------------------------
  // 렌더
  // -----------------------------
  return (
    <div
      className={`fixed left-0 right-0 z-[55] transition-transform duration-200 ease-out ${
        open ? "pointer-events-auto" : "pointer-events-none"
      }`}
      style={{
        bottom: 0,
        transform: open ? (isRestOpen ? "none" : `translateY(${dragY}px)`) : "translateY(110%)",
        willChange: isRestOpen ? "auto" : "transform",
      }}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="mx-auto w-full max-w-[560px] rounded-t-2xl bg-white shadow-[0_-10px_30px_rgba(0,0,0,0.12)] overflow-hidden flex flex-col min-h-0 relative"
        style={{ height: heightPx }}
      >
        {/* 드래그 핸들 (여길 아래로 끌면 닫힘) */}
        <div className="pt-3 pb-2 cursor-grab touch-none select-none" onPointerDown={onHandleDown}>
          <div className="mx-auto h-1.5 w-12 rounded-full bg-gray-300" />
        </div>

        {/* 내부 스크롤 컨테이너 */}
        <div
          ref={contentRef}
          className="flex-1 min-h-0 overflow-y-auto"
          style={{ WebkitOverflowScrolling: "touch", overscrollBehavior: "contain" as any }}
        >
          {children}
        </div>

        {/* 아래로 스와이프 힌트 */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center">
          <div
            className={`relative w-full max-w-[560px] transition-opacity duration-200 ${
              showHint ? "opacity-100" : "opacity-0"
            }`}
          >
            <div className="absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-white to-transparent" />
            <div className="pb-2 flex items-center justify-center gap-1 text-xs text-gray-500">
              <span className="animate-bounce">⬇︎</span>
              <span>아래로 스와이프 하세요</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
