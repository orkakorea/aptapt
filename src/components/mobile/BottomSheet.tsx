import React from "react";

type BottomSheetProps = {
  open: boolean;
  /** useSheetDrag().translateY 값을 그대로 넣어주세요 */
  translateY?: number;
  /** 시트 최대 높이(px). 없으면 콘텐츠 높이대로 */
  maxHeightPx?: number;
  /** 손잡이(상단 바)에서 pointerdown 이벤트 핸들러 */
  onHandlePointerDown?: (e: React.PointerEvent) => void;
  /** 시트 내용 */
  children: React.ReactNode;
  /** z-index 커스터마이즈(기본 55) */
  zIndex?: number;
};

/**
 * 매우 단순한 프레젠테이션 전용 바텀시트
 * - iOS 스크롤 버그 회피: 열림+드래그중 아님 → transform 제거
 * - 드래그 제스처는 useSheetDrag 훅에서 처리하고, 여기에는 결과만 주입
 */
export default function BottomSheet({
  open,
  translateY = 0,
  maxHeightPx,
  onHandlePointerDown,
  children,
  zIndex = 55,
}: BottomSheetProps) {
  const isRestOpen = open && translateY === 0;

  return (
    <div
      className={`fixed left-0 right-0 ${open ? "pointer-events-auto" : "pointer-events-none"}`}
      style={{
        bottom: 0,
        zIndex,
        transform: open ? (isRestOpen ? "none" : `translateY(${translateY}px)`) : "translateY(110%)",
        transition: "transform 200ms ease-out",
        willChange: isRestOpen ? ("auto" as any) : "transform",
      }}
      aria-hidden={!open}
    >
      <div
        className="mx-auto w-full max-w-[560px] rounded-t-2xl bg-white shadow-[0_-10px_30px_rgba(0,0,0,0.12)] overflow-hidden flex flex-col min-h-0"
        style={{ height: maxHeightPx ?? undefined, maxHeight: maxHeightPx ?? undefined }}
        role="dialog"
        aria-modal={open}
      >
        <div className="pt-3 pb-2 cursor-grab touch-none select-none" onPointerDown={onHandlePointerDown}>
          <div className="mx-auto h-1.5 w-12 rounded-full bg-gray-300" />
        </div>
        <div className="flex-1 min-h-0 overflow-hidden">{children}</div>
      </div>
    </div>
  );
}
