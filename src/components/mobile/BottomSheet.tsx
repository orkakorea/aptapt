import React, { useEffect, useRef, useState } from "react";

type Props = {
  open: boolean;
  maxHeightPx?: number; // 시트 전체 높이(고정)
  thresholdPx?: number; // 드래그로 닫기 임계값 (기본 120px)
  onClose: () => void;
  children: React.ReactNode;
};

export default function BottomSheet({ open, maxHeightPx, thresholdPx = 120, onClose, children }: Props) {
  const [dragY, setDragY] = useState(0);
  const startYRef = useRef<number | null>(null);
  const draggingRef = useRef(false);

  // 드래그 리스너(윈도우 레벨)
  useEffect(() => {
    const opts: AddEventListenerOptions = { passive: false };

    const onMove = (e: PointerEvent) => {
      if (!draggingRef.current || startYRef.current == null) return;
      e.preventDefault(); // iOS에서 스크롤 끊기
      const dy = Math.max(0, e.clientY - startYRef.current);
      setDragY(dy);
    };

    const end = (e: PointerEvent) => {
      if (!draggingRef.current) return;
      e.preventDefault();
      const dy = Math.max(0, e.clientY - (startYRef.current ?? e.clientY));
      draggingRef.current = false;
      startYRef.current = null;
      setDragY(0);
      if (dy > thresholdPx) onClose();
      window.removeEventListener("pointermove", onMove, opts);
      window.removeEventListener("pointerup", end, opts);
      window.removeEventListener("pointercancel", end, opts);
    };

    if (draggingRef.current) {
      window.addEventListener("pointermove", onMove, opts);
      window.addEventListener("pointerup", end, opts);
      window.addEventListener("pointercancel", end, opts);
    }

    return () => {
      window.removeEventListener("pointermove", onMove, opts);
      window.removeEventListener("pointerup", end, opts);
      window.removeEventListener("pointercancel", end, opts);
    };
  }, [onClose, thresholdPx]);

  const onHandleDown = (e: React.PointerEvent) => {
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    draggingRef.current = true;
    startYRef.current = e.clientY;
    setDragY(0);
  };

  const isRestOpen = open && dragY === 0;

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
        className="mx-auto w-full max-w-[560px] rounded-t-2xl bg-white shadow-[0_-10px_30px_rgba(0,0,0,0.12)] overflow-hidden flex flex-col min-h-0"
        style={{ height: maxHeightPx ?? Math.floor(window.innerHeight * 0.75) }}
      >
        <div className="pt-3 pb-2 cursor-grab touch-none select-none" onPointerDown={onHandleDown}>
          <div className="mx-auto h-1.5 w-12 rounded-full bg-gray-300" />
        </div>
        <div className="flex-1 min-h-0 overflow-hidden">{children}</div>
      </div>
    </div>
  );
}
