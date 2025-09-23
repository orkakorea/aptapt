import React from "react";
import { createPortal } from "react-dom";

type Props = {
  show: boolean;
  backdropOpacity?: number; // 0~1 (기본 0.3)
};

export default function LoadingOverlay({
  show,
  backdropOpacity = 0.3,
}: Props) {
  if (!show) return null;

  return createPortal(
    <div
      role="status"
      aria-busy="true"
      aria-live="polite"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        backgroundColor: `rgba(0,0,0,${backdropOpacity})`,
        backdropFilter: "saturate(120%) blur(2px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <p style={{ color: "#fff", fontSize: "1rem" }}>Loading...</p>
    </div>,
    document.body
  );
}
