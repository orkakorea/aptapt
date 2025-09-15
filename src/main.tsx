// src/main.tsx
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

/** =========================================================
 *  URL 강제 토글: ?forceTablet=1 또는 ?ft=1
 *  → <html class="force-tablet"> 추가 (App.css의 65% 축소 규칙 작동)
 *  ======================================================= */
(function applyForceTabletFromQuery() {
  try {
    const params = new URLSearchParams(window.location.search);
    const raw = params.get("forceTablet") ?? params.get("ft");
    const enable =
      raw !== null &&
      (raw === "" ||
        raw === "1" ||
        raw.toLowerCase() === "true" ||
        raw.toLowerCase() === "on");
    document.documentElement.classList.toggle("force-tablet", enable);
  } catch (e) {
    console.warn("[main] forceTablet parse skipped:", e);
  }
})();

/** 뷰포트 메타가 없을 때 안전하게 추가 (일부 템플릿/프록시 환경 대비) */
(function ensureViewportMeta() {
  if (!document.querySelector('meta[name="viewport"]')) {
    const m = document.createElement("meta");
    m.name = "viewport";
    m.content = "width=device-width, initial-scale=1, viewport-fit=cover";
    document.head.appendChild(m);
  }
})();

createRoot(document.getElementById("root")!).render(<App />);
