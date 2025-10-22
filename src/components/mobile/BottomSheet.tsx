import React, { useEffect, useRef, useState } from "react";

type Props = {
  open: boolean;
  maxHeightPx?: number; // 시트 전체 높이
  thresholdPx?: number; // 드래그로 닫기 임계값 (기본 120px)
  onClose: () => void;
  resetScrollKey?: string; // ✅ 이 값이 바뀔 때마다 스크롤 맨 위로
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
  const [dragY, setDragY] = useState(0);
  const startYRef = useRef<number | null>(null);
  const draggingRef = useRef(false);

  const contentRef = useRef<HTMLDivElement>(null);

  // 힌트(아래로 스와이프) 상태
  const [hasOverflow, setHasOverflow] = useState(false);
  const [showHint, setShowHint] = useState(false);

  /** 드래그 시작: 여기서 윈도우 리스너를 붙였다가, 끝날 때 해제 */
  const onHandleDown = (e: React.PointerEvent) => {
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    draggingRef.current = true;
    startYRef.current = e.clientY;
    setDragY(0);

    const opts: AddEventListenerOptions = { passive: false };

    const onMove = (ev: PointerEvent) => {
      if (!draggingRef.current || startYRef.current == null) return;
      ev.preventDefault(); // iOS 스크롤 차단(핸들 드래그 중)
      const dy = Math.max(0, ev.clientY - startYRef.current);
      setDragY(dy);
    };

    const onEnd = (ev: PointerEvent) => {
      ev.preventDefault();
      if (!draggingRef.current) return;
      const dy = Math.max(0, ev.clientY - (startYRef.current ?? ev.clientY));
      draggingRef.current = false;
      startYRef.current = null;
      setDragY(0);
      if (dy > thresholdPx) onClose();

      window.removeEventListener("pointermove", onMove, opts);
      window.removeEventListener("pointerup", onEnd, opts);
      window.removeEventListener("pointercancel", onEnd, opts);
    };

    window.addEventListener("pointermove", onMove, opts);
    window.addEventListener("pointerup", onEnd, opts);
    window.addEventListener("pointercancel", onEnd, opts);
  };

  // 열려 있고 드래그 중이 아니면 transform 제거(iOS 스크롤 버그 회피)
  const isRestOpen = open && dragY === 0;

  // ✅ resetScrollKey가 바뀌거나 열릴 때마다 맨 위로 이동
  useEffect(() => {
    if (!open) return;
    const el = contentRef.current;
    if (!el) return;
    el.scrollTo({ top: 0, behavior: "auto" });
  }, [open, resetScrollKey]);

  // 힌트(아래로 스와이프) 표시 조건 계산
  const recomputeOverflow = () => {
    const el = contentRef.current;
    if (!el) return;
    const overflow = el.scrollHeight > el.clientHeight + 2;
    setHasOverflow(overflow);
    setShowHint(overflow && el.scrollTop <= 4);
  };

  useEffect(() => {
    if (!open) return;
    const el = contentRef.current;
    if (!el) return;

    recomputeOverflow();

    const onScroll = () => {
      if (!el) return;
      if (el.scrollTop > 4) setShowHint(false);
      else if (hasOverflow) setShowHint(true);
    };

    const onResize = () => recomputeOverflow();

    el.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize);

    return () => {
      el.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

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
    >
      <div
        className="mx-auto w-full max-w-[560px] rounded-t-2xl bg-white shadow-[0_-10px_30px_rgba(0,0,0,0.12)] overflow-hidden flex flex-col min-h-0 relative"
        style={{ height: maxHeightPx ?? Math.floor(window.innerHeight * 0.75) }}
      >
        {/* 드래그 핸들 (여길 아래로 끌면 닫힘) */}
        <div className="pt-3 pb-2 cursor-grab touch-none select-none" onPointerDown={onHandleDown}>
          <div className="mx-auto h-1.5 w-12 rounded-full bg-gray-300" />
        </div>

        {/* ✅ 내부 스크롤 컨테이너 */}
        <div
          ref={contentRef}
          className="flex-1 min-h-0 overflow-y-auto"
          style={{ WebkitOverflowScrolling: "touch", overscrollBehavior: "contain" as any }}
        >
          {children}
        </div>

        {/* ✅ 아래로 스와이프 힌트 (컨텐츠가 넘치고, 맨 위일 때만) */}
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
