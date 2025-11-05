// src/lib/quickAdd.ts
// 공통: 빠른 아파트 담기(Quick Add) 마커 이미지 팩토리
// - Kakao maps.MarkerImage 를 상태 조합에 맞춰 생성/캐시합니다.
// - 외부 PNG 에셋 없이 인라인 SVG로 즉시 렌더링합니다.

export type QuickState = {
  /** 장바구니에 담겨 '선택됨' 상태인지 (노랑) */
  selected?: boolean;
  /** 클릭 강조 상태인지 (보라 강조) */
  clicked?: boolean;
  /** 퀵모드 토글 여부 (+/− 뱃지 표시) */
  quickOn?: boolean;
  /** 현재 마커가 카트에 담겨 있는지(퀵모드에서 − 표시를 위한 플래그) */
  inCart?: boolean;
};

export type QuickFactoryOptions = {
  /** 마커 이미지 정사각 사이즈(px). 기본 51 */
  size?: number;
  /** 앵커 오프셋. 기본 { x: size/2, y: size } (하단 중앙) */
  offset?: { x: number; y: number };
  /** 컬러 커스터마이즈(선택) */
  colors?: {
    purple?: string; // 기본
    yellow?: string; // 선택됨
    white?: string;  // 내부 원/스트로크
    shadow?: string; // 그림자(옅은 테두리 느낌)
  };
};

export type QuickImageFactory = {
  /** 상태 조합에 맞는 kakao.maps.MarkerImage 반환(캐시됨) */
  get(state: QuickState): any; // kakao.maps.MarkerImage
  /** 내부 캐시 비우기(선택) */
  clear(): void;
};

function encodeSvg(svg: string): string {
  // data URL 용 인코딩
  return (
    "data:image/svg+xml;charset=UTF-8," +
    encodeURIComponent(svg.replace(/\s{2,}/g, " ").trim())
  );
}

function buildPinSvg(opts: {
  size: number;
  baseColor: string;
  innerColor: string;
  clicked?: boolean;
  badge?: "plus" | "minus"; // 퀵모드 뱃지
  white: string;
  shadow: string;
}) {
  const { size, baseColor, innerColor, clicked, badge, white, shadow } = opts;
  const cx = size / 2;
  const cy = size * 0.44; // 원 중심
  const r = size * 0.22;  // 원 반지름
  const tipY = size - 1;  // 하단 포인터 Y

  // 핀 도형(원 + 아래 포인터) - 외곽 흰 스트로크로 시인성 강화
  const pinPath = `
    M ${cx} ${cy - r}
    A ${r} ${r} 0 1 1 ${cx} ${cy + r}
    L ${cx} ${tipY}
    L ${cx} ${cy + r}
    A ${r} ${r} 0 1 1 ${cx} ${cy - r}
    Z
  `;

  // 클릭 강조: 외곽에 굵은 흰 테두리(약간 큰 외곽선 효과)
  const clickedStrokeWidth = Math.max(2, Math.floor(size * 0.06));

  // 내부 라운드(기본은 흰색)
  const innerR = r * 0.9;

  // 뱃지(퀵모드 +/−) 크기/선 굵기
  const badgeR = innerR * 0.75;
  const lineW = Math.max(2, Math.floor(size * 0.06));

  const plusMinus = (() => {
    if (!badge) return "";
    const hor = `
      <line x1="${cx - badgeR * 0.55}" y1="${cy}" x2="${cx + badgeR * 0.55}" y2="${cy}" stroke="${white}" stroke-width="${lineW}" stroke-linecap="round" />
    `;
    const ver = `
      <line x1="${cx}" y1="${cy - badgeR * 0.55}" x2="${cx}" y2="${cy + badgeR * 0.55}" stroke="${white}" stroke-width="${lineW}" stroke-linecap="round" />
    `;
    return badge === "plus" ? hor + ver : hor; // minus는 가로선만
  })();

  const svg = `
  <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <!-- 그림자 비슷한 외곽(연보라) -->
    <path d="${pinPath}" fill="${shadow}" />
    <!-- 본체 -->
    <path d="${pinPath}" fill="${baseColor}" stroke="${white}" stroke-width="${Math.max(1, Math.floor(size*0.03))}"/>
    ${clicked ? `<path d="${pinPath}" fill="none" stroke="${white}" stroke-width="${clickedStrokeWidth}" opacity="0.45"/>` : ""}

    <!-- 내부 원 -->
    <circle cx="${cx}" cy="${cy}" r="${innerR}" fill="${innerColor}" />

    <!-- 퀵모드 뱃지 -->
    ${plusMinus}
  </svg>
  `;
  return svg;
}

function buildMarkerImage(maps: any, url: string, size: number, offset?: { x: number; y: number }) {
  const s = new maps.Size(size, size);
  const o = new maps.Point(offset?.x ?? size / 2, offset?.y ?? size);
  return new maps.MarkerImage(url, s, { offset: o });
}

/**
 * 공통 팩토리: 상태 조합 -> MarkerImage
 * @param maps kakao.maps 네임스페이스
 */
export function getQuickImageFactory(maps: any, options?: QuickFactoryOptions): QuickImageFactory {
  const size = options?.size ?? 51;
  const offset = options?.offset ?? { x: size / 2, y: size };
  const colors = {
    purple: options?.colors?.purple ?? "#6F4BF2",
    yellow: options?.colors?.yellow ?? "#FFD400",
    white: options?.colors?.white ?? "#FFFFFF",
    shadow: options?.colors?.shadow ?? "rgba(111,75,242,0.20)",
  };

  // 조합 캐시: key -> MarkerImage
  const cache = new Map<string, any>();

  function keyOf(state: QuickState): string {
    const s = state || {};
    return [
      s.selected ? "sel" : "nsel",
      s.clicked ? "clk" : "nclk",
      s.quickOn ? "qon" : "qoff",
      s.inCart ? "cart" : "nocart",
      `sz${size}`,
    ].join("|");
  }

  function get(state: QuickState) {
    const k = keyOf(state);
    const found = cache.get(k);
    if (found) return found;

    // 1) 베이스 컬러 결정
    const baseColor = state.selected || state.inCart ? colors.yellow : colors.purple;

    // 2) 퀵모드 뱃지 결정
    const badge: "plus" | "minus" | undefined =
      state.quickOn ? (state.inCart ? "minus" : "plus") : undefined;

    // 3) 내부 원 색상 (기본 흰색, 선택일 땐 살짝 노란빛 도는 흰색도 가능하지만 단순화)
    const innerColor = colors.white;

    // 4) SVG 생성 → 데이터 URL → MarkerImage
    const svg = buildPinSvg({
      size,
      baseColor,
      innerColor,
      clicked: Boolean(state.clicked && !(state.selected || state.inCart)), // 선택 상태면 클릭 강조는 생략
      badge,
      white: colors.white,
      shadow: colors.shadow,
    });
    const url = encodeSvg(svg);
    const image = buildMarkerImage(maps, url, size, offset);
    cache.set(k, image);
    return image;
  }

  function clear() {
    cache.clear();
  }

  return { get, clear };
}

export default getQuickImageFactory;
// Empty file - ready for implementation
