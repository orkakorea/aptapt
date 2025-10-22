/**
 * 공통 유틸 (PC·모바일 공용)
 * - 프레임워크/SDK 의존 없음(SSR 안전).
 * - 숫자/문자 처리, 이미지 프리로드, 상품별 기본 이미지 매핑.
 */

/* =========================
 * 숫자/통화 포맷
 * ========================= */

/** 숫자(또는 숫자형 문자열)를 "1,234" 형태로. 값이 없으면 "-" */
export function fmtNum(n?: number | string | null): string {
  const v = Number(n);
  return Number.isFinite(v) ? v.toLocaleString("ko-KR") : "-";
}

/** 숫자(또는 숫자형 문자열)를 "1,234원" 형태로. 값이 없으면 "-" */
export function fmtWon(n?: number | string | null): string {
  const v = Number(n);
  return Number.isFinite(v) ? `${v.toLocaleString("ko-KR")}원` : "-";
}

/**
 * 문자열 안의 숫자만 느슨하게 파싱(쉼표/원/공백 등 제거).
 * - "1,200원" -> 1200
 * - 빈 값/NaN이면 undefined
 */
export function toNumLoose(v: unknown): number | undefined {
  if (v == null) return undefined;
  if (typeof v === "number") return Number.isFinite(v) ? v : undefined;
  const cleaned = String(v).replace(/[^0-9.-]/g, "");
  if (!cleaned) return undefined;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : undefined;
}

/* =========================
 * 객체 필드 접근
 * ========================= */

/**
 * 여러 키 후보 중 첫 번째로 값이 있는 필드를 반환.
 * - 값이 null/undefined/빈문자열("")이면 건너뜀
 */
export function getField<T extends Record<string, any>>(obj: T, keys: string[]): any {
  if (!obj) return undefined;
  for (const k of keys) {
    if (k in obj && obj[k] != null && obj[k] !== "") return obj[k];
  }
  return undefined;
}

/* =========================
 * 이미지 도우미
 * ========================= */

/**
 * 브라우저에서 이미지 미리 불러오기.
 * - SSR/Node 환경에서도 안전(guard 포함).
 */
export function preloadImages(paths: string[]): void {
  if (typeof Image === "undefined") return; // SSR/Node 보호
  paths.forEach((p) => {
    try {
      const img = new Image();
      img.src = p;
    } catch {
      /* no-op */
    }
  });
}

/**
 * 상품명으로 대표 이미지 경로를 추론.
 * - 프로젝트의 public/products/* 자산 기준.
 * - 일치하지 않으면 "/placeholder.svg" 반환.
 */
export function imageForProduct(productName?: string): string {
  const p = (productName || "").toLowerCase().replace(/\s+/g, "");
  if (p.includes("elevat")) return "/products/elevator-tv.png";
  if (p.includes("townbord") || p.includes("townboard")) {
    if (p.includes("_l") || p.endsWith("l")) return "/products/townbord-b.png"; // L 사이즈
    return "/products/townbord-a.png"; // S/기본
  }
  if (p.includes("media")) return "/products/media-meet-a.png";
  if (p.includes("space")) return "/products/space-living.png";
  if (p.includes("hipost") || (p.includes("hi") && p.includes("post"))) return "/products/hi-post.png";
  return "/placeholder.svg";
}
