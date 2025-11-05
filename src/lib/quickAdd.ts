// src/lib/quickAdd.ts
/**
 * Kakao MarkerImage factory for “빠른 아파트 담기”.
 *
 * - 기본 핀(purple/selected-yellow/clicked)을 그대로 쓰되,
 *   퀵모드가 ON일 때는 핀 위에 + / − 뱃지를 합성한 MarkerImage를 반환합니다.
 * - 합성 이미지는 offscreen canvas로 만들어 dataURL → MarkerImage로 캐싱합니다.
 * - 베이스 핀 이미지가 아직 로드되지 않았을 경우에는 합성 없이 기본 핀 이미지를 우선 반환합니다.
 *
 * 사용 예:
 *   const factory = getQuickImageFactory(kakao.maps, { size: 51, offset: {x: 25.5, y: 51} });
 *   const img = factory.get({ quickOn: true, inCart: false }); // 보라핀 + 플러스
 */

type Opts = {
  size?: number;
  offset?: { x: number; y: number };
  /** 필요 시 커스텀 가능 (기본값은 앱에서 쓰는 경로) */
  purpleUrl?: string;
  yellowUrl?: string;
  clickedUrl?: string;
};

type GetArgs = {
  quickOn: boolean;
  selected?: boolean; // (동일 의미) inCart와 둘 중 하나만 써도 됨
  inCart?: boolean;
  clicked?: boolean;
};

export type QuickImageFactory = {
  /** 상태에 맞는 kakao.maps.MarkerImage 반환 */
  get: (args: GetArgs) => any; // kakao.maps.MarkerImage
};

const DEFAULT_PURPLE = "/makers/pin-purple@2x.png";
const DEFAULT_YELLOW = "/makers/pin-yellow@2x.png";
const DEFAULT_CLICKED = "/makers/pin-purple@3x.png";

/** offscreen canvas에 둥근 배지와 아이콘(+ 또는 -)을 그림 */
function drawBadgeOn(
  ctx: CanvasRenderingContext2D,
  pinSize: number,
  symbol: "plus" | "minus",
  theme: { stroke: string; fill: string; icon: string },
) {
  // 배지 위치/크기(감각적으로 보기 좋은 위치)
  const r = Math.max(10, Math.floor(pinSize * 0.18));
  const cx = pinSize / 2;
  const cy = pinSize * 0.6;

  // 배지 배경 (white) + 외곽선
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = theme.fill;
  ctx.fill();
  ctx.lineWidth = Math.max(2, Math.floor(pinSize * 0.035));
  ctx.strokeStyle = theme.stroke;
  ctx.stroke();
  ctx.closePath();

  // 아이콘 (+ or −)
  ctx.strokeStyle = theme.icon;
  ctx.lineCap = "round";
  ctx.lineWidth = Math.max(2, Math.floor(pinSize * 0.08));
  // horizontal
  ctx.beginPath();
  ctx.moveTo(cx - r * 0.55, cy);
  ctx.lineTo(cx + r * 0.55, cy);
  ctx.stroke();
  // vertical(plus 전용)
  if (symbol === "plus") {
    ctx.beginPath();
    ctx.moveTo(cx, cy - r * 0.55);
    ctx.lineTo(cx, cy + r * 0.55);
    ctx.stroke();
  }
  ctx.restore();
}

/** 이미지 로드 (실패해도 resolve) */
function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    // 같은 도메인 정적자산이면 crossOrigin 불필요하나, CDN 가능성을 대비
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

/** dataURL → kakao MarkerImage */
function markerFromDataURL(maps: any, dataUrl: string, size: number, offset: { x: number; y: number }) {
  const { MarkerImage, Size, Point } = maps;
  return new MarkerImage(dataUrl, new Size(size, size), { offset: new Point(offset.x, offset.y) });
}

/** URL → kakao MarkerImage (합성 없이 기본 이미지) */
function markerFromURL(maps: any, url: string, size: number, offset: { x: number; y: number }) {
  const { MarkerImage, Size, Point } = maps;
  return new MarkerImage(url, new Size(size, size), { offset: new Point(offset.x, offset.y) });
}

export default function getQuickImageFactory(maps: any, opts: Opts = {}): QuickImageFactory {
  const size = opts.size ?? 51;
  const offset = opts.offset ?? { x: size / 2, y: size };
  const purpleUrl = opts.purpleUrl ?? DEFAULT_PURPLE;
  const yellowUrl = opts.yellowUrl ?? DEFAULT_YELLOW;
  const clickedUrl = opts.clickedUrl ?? DEFAULT_CLICKED;

  // 기본(합성 없음) 이미지
  const base = {
    purple: markerFromURL(maps, purpleUrl, size, offset),
    yellow: markerFromURL(maps, yellowUrl, size, offset),
    clicked: markerFromURL(maps, clickedUrl, size, offset),
  };

  // 합성 결과 캐시
  const cache: {
    purplePlus?: any; // kakao.maps.MarkerImage
    yellowMinus?: any;
  } = {};

  // 사전 로드 & 합성 kick-off (비동기, 실패해도 기본 핀 사용)
  (async () => {
    const [pImg, yImg] = await Promise.all([loadImage(purpleUrl), loadImage(yellowUrl)]);
    const DPR = Math.max(1, Math.floor(window.devicePixelRatio || 1));

    if (pImg) {
      const cvs = document.createElement("canvas");
      cvs.width = size * DPR;
      cvs.height = size * DPR;
      const ctx = cvs.getContext("2d");
      if (ctx) {
        ctx.scale(DPR, DPR);
        ctx.drawImage(pImg, 0, 0, size, size);
        drawBadgeOn(
          ctx,
          size,
          "plus",
          { stroke: "#6F4BF2", fill: "#ffffff", icon: "#6F4BF2" }, // 보라 테마(+)
        );
        cache.purplePlus = markerFromDataURL(maps, cvs.toDataURL("image/png"), size, offset);
      }
    }

    if (yImg) {
      const cvs = document.createElement("canvas");
      cvs.width = size * DPR;
      cvs.height = size * DPR;
      const ctx = cvs.getContext("2d");
      if (ctx) {
        ctx.scale(DPR, DPR);
        ctx.drawImage(yImg, 0, 0, size, size);
        drawBadgeOn(
          ctx,
          size,
          "minus",
          { stroke: "#222222", fill: "#ffffff", icon: "#222222" }, // 노란핀 위 검정 −
        );
        cache.yellowMinus = markerFromDataURL(maps, cvs.toDataURL("image/png"), size, offset);
      }
    }
  })();

  return {
    get({ quickOn, selected, inCart, clicked }) {
      const selectedNow = Boolean(inCart ?? selected);

      // 퀵 모드가 아닐 때는 기존 로직을 그대로 따름
      if (!quickOn) {
        if (selectedNow) return base.yellow;
        if (clicked) return base.clicked;
        return base.purple;
      }

      // 퀵 모드 ON → + / − 배지 사용 (합성 준비 전엔 기본 핀으로 폴백)
      if (selectedNow) return cache.yellowMinus ?? base.yellow;
      return cache.purplePlus ?? base.purple;
    },
  };
}

// (선택) 네임드 익스포트도 제공 — import { getQuickImageFactory } 사용을 원할 때
export { getQuickImageFactory };
