import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

/**
 * SpinnerImageOverlay
 * - 임의의 이미지(GIF/PNG/SVG)를 중앙에 배치해 회전시키는 로딩 오버레이
 * - 깜빡임 방지용 delayMs, 체감 전환 조절용 minDurationMs 지원
 *
 * 기본 이미지 경로: /spinners/orka-spinner.png (public 폴더 기준)
 *   → 예: public/spinners/orka-spinner.png 로 저장
 *   → 또는 src로 깃허브 RAW 링크(예: https://raw.githubusercontent.com/.../spinner.png) 전달 가능
 *
 * 사용 예)
 *   <SpinnerImageOverlay show={busy} src="/spinners/orka-spinner.png" size={96} spinDurationMs={900} />
 *
 * props
 * - show: boolean            로딩 표시 on/off
 * - src?: string             이미지 경로/URL(미지정 시 기본값 사용)
 * - alt?: string             대체 텍스트
 * - size?: number            한 변(px), 기본 96
 * - spinDurationMs?: number  1회전 시간(ms), 기본 900
 * - delayMs?: number         표시 지연(ms), 기본 120 (깜빡임 방지)
 * - minDurationMs?: number   최소 노출시간(ms), 기본 500
 * - backdropOpacity?: number 배경 어둡기(0~1), 기본 0.3
 */

type Props = {
  show: boolean;
  src?: string;
  alt?: string;
  size?: number;
  spinDurationMs?: number;
  delayMs?: number;
  minDurationMs?: number;
  backdropOpacity?: number;
};

export default function SpinnerImageOverlay({
  show,
  src,
  alt = "로딩 중",
  size = 96,
  spinDurationMs = 900,
  delayMs = 120,
  minDurationMs = 500,
  backdropOpacity = 0.3,
}: Props) {
  const [mounted, setMounted] = useState(false);
  const [shouldRender, setShouldRender] = useState(false);
  const shownAtRef = useRef<number | null>(null);
  const delayTimerRef = useRef<number | null>(null);
  const hideTimerRef = useRef<number | null>(null);

  // 포털 mount
  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  // 표시/숨김 타이밍 제어
  useEffect(() => {
    const clearTimers = () => {
      if (delayTimerRef.current) {
        window.clearTimeout(delayTimerRef.current);
        delayTimerRef.current = null;
      }
      if (hideTimerRef.current) {
        window.clearTimeout(hideTimerRef.current);
        hideTimerRef.current = null;
      }
    };

    if (show) {
      clearTimers();
      delayTimerRef.current = window.setTimeout(() => {
        shownAtRef.current = Date.now();
        setShouldRender(true);
      }, Math.max(0, delayMs));
    } else {
      const hideWithMin = () => {
        if (!shouldRender) {
          clearTimers();
          return setShouldRender(false);
        }
        const since = shownAtRef.current ?? Date.now();
        const elapsed = Date.now() - since;
        const remain = Math.max(0, minDurationMs - elapsed);

        hideTimerRef.current = window.setTimeout(() => {
          setShouldRender(false);
          shownAtRef.current = null;
        }, remain);
      };
      hideWithMin();
    }
    return () => clearTimers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show]);

  const backdropStyle = useMemo<React.CSSProperties>(
    () => ({
      position: "fixed",
      inset: 0,
      zIndex: 9999,
      backgroundColor: `rgba(0,0,0,${backdropOpacity})`,
      backdropFilter: "saturate(120%) blur(2px)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
    }),
    [backdropOpacity]
  );

  // 이미지 소스 기본값: public/spinners/orka-spinner.png
  const imgSrc = src ?? "/spinners/orka-spinner.png";

  if (!mounted || !shouldRender) return null;

  return createPortal(
    <div role="status" aria-busy="true" aria-live="polite" style={backdropStyle}>
      <style>{`
        @keyframes _orka_spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
      `}</style>
      <img
        src={imgSrc}
        alt={alt}
        width={size}
        height={size}
        style={{
          animation: `_orka_spin ${spinDurationMs}ms linear infinite`,
          userSelect: "none",
          pointerEvents: "none",
          display: "block",
          imageRendering: "auto",
          filter: "drop-shadow(0 2px 6px rgba(0,0,0,.25))",
        }}
      />
    </div>,
    document.body
  );
}
