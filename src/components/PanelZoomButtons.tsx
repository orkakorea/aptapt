// src/components/PanelZoomButtons.tsx
import React from "react";

type Props = {
  className?: string;
};

/**
 * PanelZoomButtons
 * - 1탭(카트) + 2탭(상세) 패널 폭을 동시에 확대/축소하는 버튼
 * - 클릭 시 window.dispatchEvent(CustomEvent<'orka:panel:zoom'>) 발생
 * - detail: { op: 'expand' | 'collapse', target: 'both' | 'cart' | 'detail', step: number }
 *
 * 이번 버전:
 *  - 더 부드럽게: step을 36px로 낮춤(기존 120px → 36px)
 *  - target은 'both'로 고정(카트/상세 동시 확대/축소)
 */
export default function PanelZoomButtons({ className }: Props) {
  const STEP = 36; // ⬅️ 부드러운 확대/축소(원하면 24~48 사이로 미세 조정)

  const emit = (op: "expand" | "collapse") => {
    window.dispatchEvent(
      new CustomEvent("orka:panel:zoom", {
        detail: {
          op, // 'expand' | 'collapse'
          target: "both", // 카트+상세 동시
          step: STEP, // ⬅️ MapPage 리스너가 그대로 사용
        },
      }),
    );
  };

  return (
    <div className={className ?? ""}>
      <div className="inline-flex items-center gap-2">
        <button
          type="button"
          aria-label="패널 확대"
          title="패널 확대"
          onClick={() => emit("expand")}
          className="h-8 w-8 rounded-md border border-[#E5E7EB] bg-white hover:bg-[#F9FAFB] flex items-center justify-center"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" stroke="currentColor" fill="none">
            <path d="M12 5v14M5 12h14" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
        <button
          type="button"
          aria-label="패널 축소"
          title="패널 축소"
          onClick={() => emit("collapse")}
          className="h-8 w-8 rounded-md border border-[#E5E7EB] bg-white hover:bg-[#F9FAFB] flex items-center justify-center"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" stroke="currentColor" fill="none">
            <path d="M5 12h14" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
      </div>
    </div>
  );
}
