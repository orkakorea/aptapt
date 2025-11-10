// src/components/mobile/GestureHint.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";

/**
 * GestureHint (Mobile)
 * - 모바일 맵 첫 진입 시에만 1회 노출되는 두 손가락(핀치/스와이프) 가이드 오버레이
 * - 사용자가 터치/드래그/핀치 등 제스처를 하면 즉시 닫힘
 * - 2.5~3초 뒤 자동 페이드아웃
 * - localStorage 플래그로 재방문 시 노출 방지
 * - 지도 인스턴스를 전달하면 카카오 이벤트(dragstart/zoom_changed)로도 닫힘을 감지
 */

export type GestureHintProps = {
  /** Kakao 지도 인스턴스(선택). 전달되면 dragstart/zoom_changed로 닫기 트리거를 연결합니다. */
  map?: any;
  /** localStorage 키 (필요 시 커스터마이즈) */
  storageKey?: string;
  /** 자동 사라짐(ms). 기본 2800ms */
  autoHideMs?: number;
  /** 강제 노출(디버그용) */
  forceShow?: boolean;
  /** 닫힐 때 콜백 */
  onDismiss?: () => void;
  /** 외부에서 컨테이너에 클래스 추가하고 싶을 때 */
  className?: string;
};

const DEFAULT_KEY = "gesture_hint_seen_v1";

const isTouchEnv = () => {
  if (typeof window === "undefined") return false;
  // 터치 가능 환경 추정
  return "ontouchstart" in window || (navigator as any).maxTouchPoints > 0 || (navigator as any).msMaxTouchPoints > 0;
};

const getDebugFlag = () => {
  if (typeof window === "undefined") return false;
  try {
    const p = new URLSearchParams(window.location.search);
    return p.get("debug") === "gestures";
  } catch {
    return false;
  }
};

export default function GestureHint({
  map,
  storageKey = DEFAULT_KEY,
  autoHideMs = 2800,
  forceShow,
  onDismiss,
  className,
}: GestureHintProps) {
  const [visible, setVisible] = useState(false);
  const [exiting, setExiting] = useState(false);
  const dismissRef = useRef(false);
  const autoTimerRef = useRef<number | null>(null);

  const allowMotion = useMemo(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return true;
    try {
      return !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    } catch {
      return true;
    }
  }, []);

  // 초기 노출 조건 판단
  useEffect(() => {
    if (typeof window === "undefined") return;

    const debug = forceShow ?? getDebugFlag();
    const seen = window.localStorage.getItem(storageKey);
    const shouldShow = (debug || !seen) && isTouchEnv();

    if (shouldShow) {
      // 살짝 지연해 첫 프레임 안정화 후 노출 (맵 idle 스텝 이후 느낌)
      const t = window.setTimeout(() => setVisible(true), 400);
      return () => window.clearTimeout(t);
    }
  }, [forceShow, storageKey]);

  // 자동 닫힘 타이머
  useEffect(() => {
    if (!visible) return;
    if (autoTimerRef.current) {
      window.clearTimeout(autoTimerRef.current);
    }
    autoTimerRef.current = window.setTimeout(() => dismiss("timer"), autoHideMs) as unknown as number;
    return () => {
      if (autoTimerRef.current) {
        window.clearTimeout(autoTimerRef.current);
        autoTimerRef.current = null;
      }
    };
  }, [visible, autoHideMs]);

  // 전역 터치로 즉시 닫힘
  useEffect(() => {
    if (!visible || typeof window === "undefined") return;
    const onTouch = () => dismiss("touch");
    const onPointer = () => dismiss("pointer");

    window.addEventListener("touchstart", onTouch, { passive: true });
    window.addEventListener("pointerdown", onPointer, { passive: true });

    return () => {
      window.removeEventListener("touchstart", onTouch as any);
      window.removeEventListener("pointerdown", onPointer as any);
    };
  }, [visible]);

  // Kakao 지도 이벤트(있을 때만)로 닫힘
  useEffect(() => {
    if (!visible || !map || typeof kakao === "undefined") return;

    const handleDragStart = () => dismiss("dragstart");
    const handleZoomChanged = () => dismiss("zoom");

    kakao.maps.event.addListener(map, "dragstart", handleDragStart);
    kakao.maps.event.addListener(map, "zoom_changed", handleZoomChanged);

    return () => {
      try {
        kakao.maps.event.removeListener(map, "dragstart", handleDragStart);
        kakao.maps.event.removeListener(map, "zoom_changed", handleZoomChanged);
      } catch {
        // noop
      }
    };
  }, [visible, map]);

  const dismiss = (reason: string) => {
    if (dismissRef.current) return;
    dismissRef.current = true;
    // console.debug(`[GestureHint] dismiss via ${reason}`);

    try {
      if (typeof window !== "undefined") {
        window.localStorage.setItem(storageKey, "1");
      }
    } catch {
      // storage가 막혀 있어도 UX만 유지
    }

    setExiting(true);
    window.setTimeout(() => {
      setVisible(false);
      setExiting(false);
      if (onDismiss) onDismiss();
    }, 220); // 페이드아웃 시간과 일치
  };

  if (!visible) return null;

  return (
    <div
      className={[
        "fixed inset-0 z-[9999] flex items-center justify-center",
        "pointer-events-none",
        exiting ? "gsh-fadeout" : "gsh-fadein",
        className ?? "",
      ].join(" ")}
      aria-live="polite"
      aria-atomic="true"
      role="status"
    >
      {/* 반투명 배경 (포인터 통과) */}
      <div className="absolute inset-0 bg-black/40" />

      {/* 카드 컨텐트 */}
      <div className="relative pointer-events-none select-none flex flex-col items-center gap-3 text-white">
        {/* SVG 애니메이션: 두 손가락 핀치 + 살짝 스와이프 힌트 */}
        <div className="w-[120px] h-[120px] max-w-[50vw] max-h-[50vw]">
          <svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
            {/* 스와이프 힌트 화살표 (좌우로 은은하게) */}
            <g className="gsh-swipe">
              <path d="M20 88 L40 88" stroke="white" strokeWidth="3" strokeLinecap="round" opacity="0.8" />
              <path d="M100 88 L80 88" stroke="white" strokeWidth="3" strokeLinecap="round" opacity="0.8" />
              <circle cx="18" cy="88" r="2" fill="white" opacity="0.9" />
              <circle cx="102" cy="88" r="2" fill="white" opacity="0.9" />
            </g>

            {/* 두 손가락 그룹 (핀치 애니메이션) */}
            <g className={allowMotion ? "gsh-pinch" : undefined} transform={allowMotion ? undefined : "translate(0,0)"}>
              {/* 왼쪽 손가락 */}
              <g className="gsh-finger-left">
                <rect x="40" y="20" width="14" height="44" rx="7" fill="#f2f2f2" />
                <circle cx="47" cy="20" r="7" fill="#ffffff" />
              </g>
              {/* 오른쪽 손가락 */}
              <g className="gsh-finger-right">
                <rect x="66" y="20" width="14" height="44" rx="7" fill="#f2f2f2" />
                <circle cx="73" cy="20" r="7" fill="#ffffff" />
              </g>
            </g>

            {/* 중앙 텍스트 가이드 (SVG 내 간단한 표시) */}
            <text x="60" y="108" textAnchor="middle" fontSize="10" fill="#ffffff" opacity="0.9">
              Pinch & Swipe
            </text>
          </svg>
        </div>

        {/* 설명 카피 */}
        <div className="text-center space-y-1">
          <div className="text-sm font-semibold drop-shadow">두 손가락으로 확대/축소</div>
          <div className="text-[12px] opacity-90 drop-shadow">한 손가락으로 지도를 이동해요</div>
        </div>
      </div>

      {/* 컴포넌트 전용 스타일 */}
      <style>{`
        .gsh-fadein { animation: gshFadeIn 180ms ease-out both; }
        .gsh-fadeout { animation: gshFadeOut 200ms ease-in both; }

        @keyframes gshFadeIn {
          from { opacity: 0; transform: scale(0.98); }
          to   { opacity: 1; transform: scale(1); }
        }
        @keyframes gshFadeOut {
          from { opacity: 1; transform: scale(1); }
          to   { opacity: 0; transform: scale(0.98); }
        }

        /* 두 손가락이 모였다 벌어지는 느낌 */
        .gsh-pinch .gsh-finger-left { animation: gshFingerLeft 1400ms ease-in-out infinite alternate; }
        .gsh-pinch .gsh-finger-right { animation: gshFingerRight 1400ms ease-in-out infinite alternate; }
        @keyframes gshFingerLeft {
          0%   { transform: translateX(6px); }
          100% { transform: translateX(-10px); }
        }
        @keyframes gshFingerRight {
          0%   { transform: translateX(-6px); }
          100% { transform: translateX(10px); }
        }

        /* 아래쪽 스와이프 힌트는 좌우로 살짝씩 왕복 */
        .gsh-swipe { animation: gshSwipe 1600ms ease-in-out infinite alternate; }
        @keyframes gshSwipe {
          0%   { transform: translateX(-6px); opacity: .9; }
          100% { transform: translateX(6px); opacity: .9; }
        }
      `}</style>
    </div>
  );
}

// kakao 타입 선언이 전역에 없을 수 있어 안전 가드 제공
declare const kakao: any;
