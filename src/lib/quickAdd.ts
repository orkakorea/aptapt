// path: src/lib/quickAdd.ts
/**
 * Kakao MarkerImage 팩토리 (Quick Add 전용)
 * - +/- 아이콘을 핀 머리 "정중앙"에 맞춰 그림
 * - devicePixelRatio 스케일 반영
 * - 캐싱으로 불필요한 재생성 최소화
 *
 * 사용법:
 *   const factory = getQuickImageFactory(kakao.maps, { size: 51, offset: {x: 25.5, y: 51} });
 *   const img = factory.get({ quickOn: true, selected: false, inCart: false, clicked: false });
 *   new kakao.maps.Marker({ image: img, ... });
 */

type KakaoMapsNS = {
  Size: new (w: number, h: number) => any;
  Point: new (x: number, y: number) => any;
  MarkerImage: new (src: string, size: any, opts?: { offset?: any }) => any;
};

type GetOpts = {
  quickOn: boolean;
  selected: boolean; // = inCart
  inCart: boolean;
  clicked: boolean;
};

type FactoryOptions = {
  /** 전체 마커 크기(px). 기본 51 */
  size?: number;
  /** MarkerImage offset. 보통 {x: size/2, y: size} */
  offset?: { x: number; y: number };
  /** 비-퀵모드일 때 사용하는 기본 이미지 URL들(선택) */
  baseUrls?: {
    purple?: string; // 기본
    yellow?: string; // 선택(담김)
    clicked?: string; // 클릭 강조
  };
};

/* 기본 에셋(프로젝트 public/ 경로 기준). 필요 시 옵션으로 덮어쓸 수 있음 */
const DEFAULT_BASE = {
  purple: "/makers/pin-purple@2x.png",
  yellow: "/makers/pin-yellow@2x.png",
  clicked: "/makers/pin-purple@3x.png",
};

/* 디자인 토큰 */
const COLOR_PURPLE = "#6F4BF2";
const COLOR_WHITE = "#FFFFFF";

/* 중앙 정렬 핵심 파라미터
   - CX: 가로 중앙
   - CY: 핀 머리 원의 시각적 중심. size * 0.38~0.40 권장
   - R : 흰 원 반지름 (아이콘 배경)
*/
const CY_RATIO = 0.39;
const R_RATIO = 0.2;

/**
 * 캔버스에 보라색 핀 모양을 벡터로 그리고, 중앙에 흰 원 + +/- 아이콘을 그린 후 dataURL 반환
 * - DPR 스케일 반영
 */
function drawQuickCanvas(size: number, mode: "plus" | "minus"): string {
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(size * dpr);
  canvas.height = Math.round(size * dpr);

  const ctx = canvas.getContext("2d")!;
  // CSS 좌표계에서 그리도록 스케일
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, size, size);

  // ---- 핀 기본 형태(보라) ----
  const CX = size / 2;
  const CY = Math.round(size * CY_RATIO);
  const HEAD_R = Math.round(size * 0.33);

  ctx.fillStyle = COLOR_PURPLE;
  ctx.beginPath();
  ctx.arc(CX, CY, HEAD_R, 0, Math.PI * 2);
  ctx.fill();

  // 하단 꼬리(드롭 핀)
  const tailTopY = CY + HEAD_R * 0.6;
  const tailHeight = Math.max(8, Math.round(size * 0.22));
  const tailWidth = Math.max(10, Math.round(size * 0.18));

  ctx.beginPath();
  ctx.moveTo(CX - tailWidth / 2, tailTopY);
  ctx.lineTo(CX + tailWidth / 2, tailTopY);
  ctx.lineTo(CX, tailTopY + tailHeight);
  ctx.closePath();
  ctx.fillStyle = COLOR_PURPLE;
  ctx.fill();

  // ---- 중앙 흰 원(배경) ----
  const R = Math.round(size * R_RATIO);
  ctx.beginPath();
  ctx.arc(CX, CY, R, 0, Math.PI * 2);
  ctx.fillStyle = COLOR_WHITE;
  ctx.fill();

  // ---- +/- 아이콘 ----
  ctx.strokeStyle = COLOR_PURPLE;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  // DPR 반영 후 두께가 무겁지 않도록 size 기준으로 산정
  const bar = Math.max(2, Math.round(size * 0.06)); // 선 두께
  ctx.lineWidth = bar;

  const half = Math.round(R * 0.65); // 선 길이의 절반
  // 수평선(마이너스 공통)
  ctx.beginPath();
  ctx.moveTo(CX - half, CY);
  ctx.lineTo(CX + half, CY);
  ctx.stroke();

  if (mode === "plus") {
    // 수직선(플러스일 때만)
    ctx.beginPath();
    ctx.moveTo(CX, CY - half);
    ctx.lineTo(CX, CY + half);
    ctx.stroke();
  }

  return canvas.toDataURL("image/png");
}

/** 비-퀵모드용 기본 MarkerImage 생성기 */
function makeBaseImage(maps: KakaoMapsNS, url: string, size: number, offset: { x: number; y: number }) {
  return new maps.MarkerImage(url, new maps.Size(size, size), {
    offset: new maps.Point(offset.x, offset.y),
  });
}

/**
 * 팩토리 본체
 */
export default function getQuickImageFactory(maps: KakaoMapsNS, opts?: FactoryOptions) {
  const size = opts?.size ?? 51;
  const offset = opts?.offset ?? { x: size / 2, y: size };
  const base = {
    purple: opts?.baseUrls?.purple ?? DEFAULT_BASE.purple,
    yellow: opts?.baseUrls?.yellow ?? DEFAULT_BASE.yellow,
    clicked: opts?.baseUrls?.clicked ?? DEFAULT_BASE.clicked,
  };

  // 캐시
  const cache = new Map<string, any>();

  // 비-퀵모드 기본 이미지 3종(지연 생성)
  function basePurple() {
    const k = "base:purple";
    if (!cache.has(k)) cache.set(k, makeBaseImage(maps, base.purple, size, offset));
    return cache.get(k);
  }
  function baseYellow() {
    const k = "base:yellow";
    if (!cache.has(k)) cache.set(k, makeBaseImage(maps, base.yellow, size, offset));
    return cache.get(k);
  }
  function baseClicked() {
    const k = "base:clicked";
    if (!cache.has(k)) cache.set(k, makeBaseImage(maps, base.clicked, size, offset));
    return cache.get(k);
  }

  // 퀵모드 이미지 2종(플러스/마이너스) 캐시
  function quickPlus() {
    const k = "quick:plus";
    if (!cache.has(k)) {
      const dataUrl = drawQuickCanvas(size, "plus");
      cache.set(k, makeBaseImage(maps, dataUrl, size, offset));
    }
    return cache.get(k);
  }
  function quickMinus() {
    const k = "quick:minus";
    if (!cache.has(k)) {
      const dataUrl = drawQuickCanvas(size, "minus");
      cache.set(k, makeBaseImage(maps, dataUrl, size, offset));
    }
    return cache.get(k);
  }

  return {
    /**
     * 상태에 맞는 MarkerImage 반환
     * - quickOn=true 이면 플러스/마이너스 오버레이 버전(벡터) 사용
     * - quickOn=false 이면 기본 에셋(purple/yellow/clicked)
     */
    get(o: GetOpts) {
      if (o.quickOn) {
        // 선택(=담김) 상태면 마이너스, 아니면 플러스
        return o.selected || o.inCart ? quickMinus() : quickPlus();
      }
      // 일반 모드
      if (o.selected || o.inCart) return baseYellow();
      if (o.clicked) return baseClicked();
      return basePurple();
    },
  };
}
