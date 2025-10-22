import { ReactNode, useEffect } from "react";
import { cn } from "@/lib/utils";
import { useSheetDrag } from "@/hooks/useSheetDrag";

export interface BottomSheetProps {
  /** 시트 열림 상태 */
  open: boolean;
  /** 닫힘 콜백 */
  onClose: () => void;
  /** 시트 내용 */
  children: ReactNode;
  /** 추가 className */
  className?: string;
  /** 드래그로 닫힐 임계치(px), 기본 120 */
  threshold?: number;
}

/**
 * 모바일 바텀시트 컴포넌트
 * - useSheetDrag 훅을 사용하여 드래그로 닫기 기능 제공
 * - 배경 오버레이 클릭 시 닫기
 */
export function BottomSheet({
  open,
  onClose,
  children,
  className,
  threshold = 120,
}: BottomSheetProps) {
  const { translateY, onHandlePointerDown } = useSheetDrag({
    open,
    onClose,
    threshold,
  });

  // 시트가 열렸을 때 body 스크롤 방지
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  if (!open && translateY === 0) return null;

  return (
    <>
      {/* Overlay */}
      <div
        className={cn(
          "fixed inset-0 z-40 bg-black/80 transition-opacity",
          open ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        onClick={onClose}
      />

      {/* Bottom Sheet */}
      <div
        className={cn(
          "fixed inset-x-0 bottom-0 z-50 flex flex-col rounded-t-[20px] bg-background border-t shadow-lg transition-transform",
          "max-h-[85vh]",
          className
        )}
        style={{
          transform: open
            ? `translateY(${translateY}px)`
            : "translateY(100%)",
        }}
      >
        {/* Drag Handle */}
        <div
          className="flex justify-center py-3 cursor-grab active:cursor-grabbing"
          onPointerDown={onHandlePointerDown}
        >
          <div className="w-12 h-1.5 rounded-full bg-muted" />
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-4 pb-6">
          {children}
        </div>
      </div>
    </>
  );
}

export default BottomSheet;
