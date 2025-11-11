// src/components/PanelZoomButtons.tsx
import React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

/**
 * 타이틀(“응답하라 입주민이여”) 오른쪽에 붙이는
 * 1탭(카트)+2탭(상세) 묶음 확대/축소 버튼.
 *
 * 기본 동작:
 *  - window 에 "orka:panels:zoom" 커스텀 이벤트를 발행합니다.
 *    detail: { delta: number, min: number, max: number }
 *    예) delta = +0.1(확대), -0.1(축소)
 *
 * 사용법(예시):
 *  <h1 className="...">
 *    응답하라 입주민이여
 *    <PanelZoomButtons className="ml-3 align-middle" />
 *  </h1>
 *
 * 수신측(MapPage 등)에서는 아래처럼 한 번만 리스닝하면 됩니다.
 *
 *  useEffect(() => {
 *    const onZoom = (e: Event) => {
 *      const { delta, min, max } = (e as CustomEvent).detail || {};
 *      setPanelScale((s) => Math.min(max, Math.max(min, s + (delta ?? 0))));
 *    };
 *    window.addEventListener("orka:panels:zoom", onZoom as EventListener);
 *    return () => window.removeEventListener("orka:panels:zoom", onZoom as EventListener);
 *  }, []);
 *
 * 필요 시 onZoom 콜백을 넘겨 직접 처리할 수도 있습니다.
 */

type Props = {
  /** 한번 클릭 시 증감될 스케일 값 (기본 0.1) */
  step?: number;
  /** 허용 스케일 최소/최대값 (기본 0.8 ~ 1.3) */
  min?: number;
  max?: number;
  /** 타이틀 옆 정렬/여백용 */
  className?: string;
  /** 기본 커스텀 이벤트 대신 직접 처리하고 싶을 때 */
  onZoom?: (delta: number) => void;
};

export default function PanelZoomButtons({ step = 0.1, min = 0.8, max = 1.3, className, onZoom }: Props) {
  const emit = (delta: number) => {
    if (onZoom) {
      onZoom(delta);
      return;
    }
    try {
      window.dispatchEvent(
        new CustomEvent("orka:panels:zoom", {
          detail: { delta, min, max },
        }),
      );
    } catch {
      /* no-op */
    }
  };

  const btnBase =
    "w-8 h-8 rounded bg-black text-white inline-flex items-center justify-center " +
    "hover:brightness-110 active:scale-95 transition";

  return (
    <span
      className={`inline-flex items-center gap-2 align-middle ${className ?? ""}`}
      data-role="panel-zoom-buttons"
      aria-label="패널 크기 조절"
    >
      <button type="button" aria-label="패널 축소" className={btnBase} onClick={() => emit(-step)} title="패널 축소">
        <ChevronLeft className="w-4 h-4" />
      </button>
      <button type="button" aria-label="패널 확대" className={btnBase} onClick={() => emit(+step)} title="패널 확대">
        <ChevronRight className="w-4 h-4" />
      </button>
    </span>
  );
}
