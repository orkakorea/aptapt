// src/main.tsx
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import showOrkaConsoleBanner from "@/lib/consoleBanner"; // ✅ 콘솔 배너

/** =========================================================
 *  콘솔 배너: 앱 시작 시 가장 먼저 1회 출력 (HMR 중복 방지)
 * ======================================================= */
(() => {
  try {
    const w = window as any;
    if (!w.__ORKA_BANNER_SHOWN) {
      showOrkaConsoleBanner();
      w.__ORKA_BANNER_SHOWN = true;
    }
  } catch (e) {
    // noop
  }
})();

/** =========================================================
 *  URL 강제 토글: ?forceTablet=1 또는 ?ft=1
 *  → <html class="force-tablet"> 추가 (App.css의 65% 축소 규칙 작동)
 *  ======================================================= */
(function applyForceTabletFromQuery() {
  try {
    const params = new URLSearchParams(window.location.search);
    const raw = params.get("forceTablet") ?? params.get("ft");
    const enable =
      raw !== null && (raw === "" || raw === "1" || raw.toLowerCase() === "true" || raw.toLowerCase() === "on");
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

/** =========================================================
 *  Favicon 주입 (index.html 없이 런타임에서 추가/갱신)
 *  - 사용 파일: /public/favicon.ico.png
 *  - 기존 rel~="icon" 링크가 있으면 type/href만 정리
 * ======================================================= */
(function ensureFavicon() {
  const href = "/favicon2.ico.png"; // 네가 업로드한 파일명 그대로 사용
  const head = document.head;
  const icons = Array.from(head.querySelectorAll<HTMLLinkElement>('link[rel~="icon"]'));

  if (icons.length === 0) {
    const link = document.createElement("link");
    link.rel = "icon";
    link.type = "image/png";
    link.href = href;
    head.appendChild(link);
  } else {
    // 여러 개 있으면 모두 PNG로 통일
    icons.forEach((link) => {
      link.rel = "icon";
      link.type = "image/png";
      link.href = href;
    });
  }
})();

createRoot(document.getElementById("root")!).render(<App />);
