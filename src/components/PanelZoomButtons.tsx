// src/components/PanelZoomButtons.tsx
import React from "react";
import { Plus, Minus } from "lucide-react";

type Props = {
  className?: string;
  stepPx?: number; // 패널 폭을 얼마나 조정할지(기본 120px)
};

export default function PanelZoomButtons({ className = "", stepPx = 120 }: Props) {
  const emit = (op: "expand" | "collapse") => {
    try {
      // MapPage에서 window.addEventListener('orka:panel:zoom', ...)로 수신
      window.dispatchEvent(
        new CustomEvent("orka:panel:zoom", {
          detail: {
            op, // "expand" | "collapse"
            step: stepPx, // 조정 폭(px)
            target: "both", // 1탭/2탭 함께 조정(원하면 MapPage에서 무시/커스터마이즈)
          },
        }),
      );
    } catch (e) {
      console.warn("[PanelZoomButtons] dispatch failed:", e);
    }
  };

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <button
        type="button"
        onClick={() => emit("expand")}
        aria-label="패널 확대"
        title="패널 확대"
        className="h-8 w-8 inline-flex items-center justify-center rounded-md border border-[#E5E7EB] bg-white hover:bg-[#F9FAFB] active:scale-95"
      >
        <Plus className="w-4 h-4" />
      </button>
      <button
        type="button"
        onClick={() => emit("collapse")}
        aria-label="패널 축소"
        title="패널 축소"
        className="h-8 w-8 inline-flex items-center justify-center rounded-md border border-[#E5E7EB] bg-white hover:bg-[#F9FAFB] active:scale-95"
      >
        <Minus className="w-4 h-4" />
      </button>
    </div>
  );
}
