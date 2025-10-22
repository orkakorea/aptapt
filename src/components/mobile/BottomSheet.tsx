import React, { useRef, useState } from "react";

type Props = {
  open: boolean;
  maxHeightPx?: number; // 시트 전체 높이
  thresholdPx?: number; // 드래그로 닫기 임계값 (기본 120px)
  onClose: () => void;
  children: React.ReactNode;
};

export default function BottomSheet({ open, maxHeightPx, thresholdPx = 120, onClose, children }: Props) {
  const [dragY, setDragY] = useState(0);
  const startYRef = useRef<number | null>(null);
  const draggingRef = useRef(false);

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
        {/* 드래그 핸들 (여길 아래로 끌면 닫힘) */}
        <div className="pt-3 pb-2 cursor-grab touch-none select-none" onPointerDown={onHandleDown}>
          <div className="mx-auto h-1.5 w-12 rounded-full bg-gray-300" />
        </div>

        {/* ✅ 내부 스크롤 컨테이너 (여기 하나만 overflow-y-auto) */}
        <div
          className="flex-1 min-h-0 overflow-y-auto"
          style={{ WebkitOverflowScrolling: "touch", overscrollBehavior: "contain" as any }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
