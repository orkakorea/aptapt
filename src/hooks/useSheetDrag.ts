/**
 * 모바일 바텀시트 드래그 훅
 * - 시트 손잡이(Handle)에 onPointerDown만 붙여주면 됩니다.
 * - 드래그 거리 translateY(px)를 제공하고, 임계치(threshold) 넘으면 onClose를 호출합니다.
 * - iOS 스크롤 버그 방지를 위해 드래그 중 pointermove에서 preventDefault 처리.
 *
 * 사용 예)
 * const { translateY, onHandlePointerDown, reset } = useSheetDrag({
 *   open, onClose: () => setOpen(false), threshold: 120
 * });
 * <div onPointerDown={onHandlePointerDown}> ... handle ... </div>
 * <Sheet style={{ transform: open ? `translateY(${translateY}px)` : "translateY(110%)" }} />
 */

import { useCallback, useEffect, useRef, useState } from "react";

export type UseSheetDragOptions = {
  /** 시트가 현재 열려 있는지(열려 있을 때만 드래그 동작) */
  open: boolean;
  /** 드래그 후 닫힘으로 판단할 임계치(px). 기본 120 */
  threshold?: number;
  /** 닫힘 콜백(임계치 초과 시 호출) */
  onClose?: () => void;
};

export function useSheetDrag(opts: UseSheetDragOptions) {
  const threshold = Math.max(0, opts.threshold ?? 120);

  const [translateY, setTranslateY] = useState(0);
  const draggingRef = useRef(false);
  const startYRef = useRef<number | null>(null);

  const moveHandlerRef = useRef<(ev: PointerEvent) => void>();
  const upHandlerRef = useRef<(ev: PointerEvent) => void>();

  const reset = useCallback(() => {
    draggingRef.current = false;
    startYRef.current = null;
    setTranslateY(0);
  }, []);

  const detach = useCallback(() => {
    if (moveHandlerRef.current) {
      window.removeEventListener("pointermove", moveHandlerRef.current as any, { passive: false } as any);
    }
    if (upHandlerRef.current) {
      window.removeEventListener("pointerup", upHandlerRef.current as any, { passive: false } as any);
      window.removeEventListener("pointercancel", upHandlerRef.current as any, { passive: false } as any);
    }
    moveHandlerRef.current = undefined;
    upHandlerRef.current = undefined;
  }, []);

  const onHandlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!opts.open) return;
      (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
      draggingRef.current = true;
      startYRef.current = e.clientY;
      setTranslateY(0);

      const move = (ev: PointerEvent) => {
        if (!draggingRef.current || startYRef.current == null) return;
        // 모바일 사파리에서 드래그 중 스크롤 방지
        ev.preventDefault();
        const dy = Math.max(0, ev.clientY - startYRef.current);
        setTranslateY(dy);
      };

      const up = (ev: PointerEvent) => {
        ev.preventDefault();
        if (!draggingRef.current) return;
        const dy = Math.max(0, ev.clientY - (startYRef.current ?? ev.clientY));
        draggingRef.current = false;
        startYRef.current = null;
        setTranslateY(0);
        detach();
        if (dy > threshold) {
          try {
            opts.onClose?.();
          } catch {
            /* no-op */
          }
        }
      };

      moveHandlerRef.current = move;
      upHandlerRef.current = up;

      // passive:false로 등록해야 preventDefault가 유효
      const opt: AddEventListenerOptions = { passive: false };
      window.addEventListener("pointermove", move, opt);
      window.addEventListener("pointerup", up, opt);
      window.addEventListener("pointercancel", up, opt);
    },
    [opts.open, opts.onClose, threshold, detach],
  );

  // 열림 상태가 false로 바뀌면 드래그 상태 초기화
  useEffect(() => {
    if (!opts.open) {
      reset();
      detach();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opts.open]);

  // 언마운트 시 리스너 해제
  useEffect(() => {
    return () => {
      detach();
    };
  }, [detach]);

  return {
    translateY,
    onHandlePointerDown,
    reset,
    /** 드래그 중인지 여부(필요 시 확장 가능) */
    // isDragging: draggingRef.current,
  };
}

export default useSheetDrag;
