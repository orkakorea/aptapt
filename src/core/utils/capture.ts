// src/core/utils/capture.ts
import { toPng } from "html-to-image";
import jsPDF from "jspdf";

/* =========================================================================
 * 1) 기존: 보이는 영역만 PNG 저장
 * ========================================================================= */
export async function saveNodeAsPNG(node: HTMLElement, filename: string) {
  const dataUrl = await toPng(node, { cacheBust: true, pixelRatio: 2, backgroundColor: "#ffffff" });
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename.endsWith(".png") ? filename : `${filename}.png`;
  a.click();
}

/* =========================================================================
 * 2) 기존: 보이는 영역만 PDF 저장(단일 페이지 스냅샷)
 *    - 긴 콘텐츠는 잘릴 수 있습니다. (호환 유지용)
 * ========================================================================= */
export async function saveNodeAsPDF(node: HTMLElement, filename: string) {
  const dataUrl = await toPng(node, { cacheBust: true, pixelRatio: 2, backgroundColor: "#ffffff" });

  const pdf = new jsPDF({ orientation: "p", unit: "mm", format: "a4" });
  const img = new Image();
  img.src = dataUrl;
  await img.decode();

  const pageW = 210; // A4(mm)
  const pageH = 297;
  const margin = 10;
  const imgWmm = pageW - margin * 2;
  const ratio = img.height / img.width;
  const imgHmm = imgWmm * ratio;

  pdf.addImage(dataUrl, "PNG", margin, margin, imgWmm, imgHmm);
  pdf.save(filename.endsWith(".pdf") ? filename : `${filename}.pdf`);
}

/* =========================================================================
 * 공통 유틸: 캡처 전 임시로 섹션 펼치고 스크롤 해제
 *  - data-capture-scroll : 스크롤 영역(높이/오버플로 해제)
 *  - data-capture-force-open : 접힘 방지(강제 표시)
 *  - scrollContainers 파라미터로 명시 전달 가능(우선 적용)
 * ========================================================================= */
type SavedStyle = {
  el: HTMLElement;
  prev: Partial<CSSStyleDeclaration>;
  // 스크롤 위치 복원용
  prevScrollTop?: number;
  prevScrollLeft?: number;
};

function ensureOpenDuringCapture(root: HTMLElement, scrollContainers?: HTMLElement[] | null): { restore: () => void } {
  const touched: SavedStyle[] = [];

  const push = (el: HTMLElement, next: Partial<CSSStyleDeclaration>) => {
    const prev: Partial<CSSStyleDeclaration> = {
      maxHeight: el.style.maxHeight,
      height: el.style.height,
      overflow: el.style.overflow,
      overflowY: el.style.overflowY,
      overflowX: el.style.overflowX,
      display: el.style.display,
      visibility: el.style.visibility,
      position: el.style.position,
    };
    touched.push({ el, prev });
    Object.assign(el.style, next);
  };

  // 1) 강제 표시 대상: data-capture-force-open
  const forceNodes = Array.from(root.querySelectorAll<HTMLElement>("[data-capture-force-open]"));
  forceNodes.forEach((el) => {
    push(el, {
      display: "block",
      visibility: "visible",
      height: "auto",
      maxHeight: "none",
      overflow: "visible",
    });
  });

  // 2) 스크롤 영역: 전달 인자 우선, 없으면 data-capture-scroll 자동 수집
  const scrollNodes =
    (scrollContainers && scrollContainers.length > 0
      ? scrollContainers
      : Array.from(root.querySelectorAll<HTMLElement>("[data-capture-scroll]"))) || [];

  scrollNodes.forEach((el) => {
    const saved: SavedStyle = {
      el,
      prev: {
        maxHeight: el.style.maxHeight,
        height: el.style.height,
        overflow: el.style.overflow,
        overflowY: el.style.overflowY,
        overflowX: el.style.overflowX,
      },
      prevScrollTop: el.scrollTop,
      prevScrollLeft: el.scrollLeft,
    };
    touched.push(saved);

    // 스크롤 해제 + 맨 위로
    el.scrollTop = 0;
    el.scrollLeft = 0;
    Object.assign(el.style, {
      maxHeight: "none",
      height: "auto",
      overflow: "visible",
      overflowY: "visible",
      overflowX: "visible",
    } as Partial<CSSStyleDeclaration>);
  });

  // 3) 루트 자체도 스크롤 해제(가능한 경우)
  push(root, {
    maxHeight: "none",
    height: "auto",
    overflow: "visible",
  });

  const restore = () => {
    for (const t of touched) {
      Object.assign(t.el.style, t.prev);
      if (typeof t.prevScrollTop === "number") t.el.scrollTop = t.prevScrollTop;
      if (typeof t.prevScrollLeft === "number") t.el.scrollLeft = t.prevScrollLeft;
    }
  };

  return { restore };
}

/* =========================================================================
 * 내부: HTML → PNG(DataURL)
 *  - 캡처 직전 ensureOpenDuringCapture로 펼친 뒤 이미지 생성
 * ========================================================================= */
async function captureExpandedToDataURL(
  root: HTMLElement,
  options?: {
    scrollContainers?: HTMLElement[] | null;
    pixelRatio?: number;
    backgroundColor?: string;
  },
): Promise<string> {
  const { restore } = ensureOpenDuringCapture(root, options?.scrollContainers);
  try {
    // 레이아웃 안정화(리플로우 보장)
    await new Promise((r) => setTimeout(r, 40));
    return await toPng(root, {
      cacheBust: true,
      pixelRatio: options?.pixelRatio ?? 2,
      backgroundColor: options?.backgroundColor ?? "#ffffff",
    });
  } finally {
    restore();
  }
}

/* =========================================================================
 * 3) 전체 콘텐츠 PNG 저장 (접힘/스크롤 무시하고 전부 펼쳐서 캡처)
 *    - CompleteModal에서 root(예: #receipt-capture)와 스크롤 영역 노드들을
 *      넘기면, 잘림 없이 한 장의 긴 PNG로 저장됩니다.
 * ========================================================================= */
export async function saveFullContentAsPNG(
  root: HTMLElement,
  filename: string,
  scrollContainers?: HTMLElement[] | null,
) {
  const dataUrl = await captureExpandedToDataURL(root, { scrollContainers, pixelRatio: 2, backgroundColor: "#ffffff" });
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename.endsWith(".png") ? filename : `${filename}.png`;
  a.click();
}

/* =========================================================================
 * 4) 전체 콘텐츠 PDF 저장 (멀티페이지 분할)
 *    - 한 장의 긴 이미지를 A4 폭에 맞춰 여러 페이지로 잘라 넣습니다.
 * ========================================================================= */
export async function saveFullContentAsPDF(
  root: HTMLElement,
  filename: string,
  scrollContainers?: HTMLElement[] | null,
) {
  const dataUrl = await captureExpandedToDataURL(root, { scrollContainers, pixelRatio: 2, backgroundColor: "#ffffff" });

  // 원본 이미지 로드
  const img = new Image();
  img.src = dataUrl;
  await img.decode();

  // PDF 설정
  const pageWmm = 210; // A4
  const pageHmm = 297;
  const margin = 10; // 상하좌우 10mm
  const contentWmm = pageWmm - margin * 2;
  const contentHmm = pageHmm - margin * 2;

  // 픽셀-밀리미터 환산(폭 기준 스케일)
  const pxPerMm = img.width / contentWmm; // 이미지 폭(px) / PDF 내용 폭(mm)
  const sliceHeightPx = Math.floor(pxPerMm * contentHmm); // 페이지 한 장당 담을 수 있는 이미지 높이(px)

  const pdf = new jsPDF({ orientation: "p", unit: "mm", format: "a4" });

  // 슬라이스 반복
  const totalHeight = img.height;
  let yPx = 0;
  let isFirstPage = true;

  // 슬라이스용 캔버스
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d")!;

  while (yPx < totalHeight) {
    const slicePx = Math.min(sliceHeightPx, totalHeight - yPx);
    canvas.width = img.width;
    canvas.height = slicePx;

    // drawImage(source, sx, sy, sWidth, sHeight, dx, dy, dWidth, dHeight)
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, yPx, img.width, slicePx, 0, 0, canvas.width, canvas.height);

    const sliceUrl = canvas.toDataURL("image/png");
    const sliceHmm = slicePx / pxPerMm; // 해당 조각의 PDF 높이(mm)

    if (!isFirstPage) pdf.addPage();
    pdf.addImage(sliceUrl, "PNG", margin, margin, contentWmm, sliceHmm);

    yPx += slicePx;
    isFirstPage = false;
  }

  pdf.save(filename.endsWith(".pdf") ? filename : `${filename}.pdf`);
}
// src/core/utils/capture.ts
import { toPng } from "html-to-image";
import jsPDF from "jspdf";

/* =========================================================================
 * 1) 기존: 보이는 영역만 PNG 저장
 * ========================================================================= */
export async function saveNodeAsPNG(node: HTMLElement, filename: string) {
  const dataUrl = await toPng(node, { cacheBust: true, pixelRatio: 2, backgroundColor: "#ffffff" });
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename.endsWith(".png") ? filename : `${filename}.png`;
  a.click();
}

/* =========================================================================
 * 2) 기존: 보이는 영역만 PDF 저장(단일 페이지 스냅샷)
 *    - 긴 콘텐츠는 잘릴 수 있습니다. (호환 유지용)
 * ========================================================================= */
export async function saveNodeAsPDF(node: HTMLElement, filename: string) {
  const dataUrl = await toPng(node, { cacheBust: true, pixelRatio: 2, backgroundColor: "#ffffff" });

  const pdf = new jsPDF({ orientation: "p", unit: "mm", format: "a4" });
  const img = new Image();
  img.src = dataUrl;
  await img.decode();

  const pageW = 210; // A4(mm)
  const pageH = 297;
  const margin = 10;
  const imgWmm = pageW - margin * 2;
  const ratio = img.height / img.width;
  const imgHmm = imgWmm * ratio;

  pdf.addImage(dataUrl, "PNG", margin, margin, imgWmm, imgHmm);
  pdf.save(filename.endsWith(".pdf") ? filename : `${filename}.pdf`);
}

/* =========================================================================
 * 공통 유틸: 캡처 전 임시로 섹션 펼치고 스크롤 해제
 *  - data-capture-scroll : 스크롤 영역(높이/오버플로 해제)
 *  - data-capture-force-open : 접힘 방지(강제 표시)
 *  - scrollContainers 파라미터로 명시 전달 가능(우선 적용)
 * ========================================================================= */
type SavedStyle = {
  el: HTMLElement;
  prev: Partial<CSSStyleDeclaration>;
  // 스크롤 위치 복원용
  prevScrollTop?: number;
  prevScrollLeft?: number;
};

function ensureOpenDuringCapture(root: HTMLElement, scrollContainers?: HTMLElement[] | null): { restore: () => void } {
  const touched: SavedStyle[] = [];

  const push = (el: HTMLElement, next: Partial<CSSStyleDeclaration>) => {
    const prev: Partial<CSSStyleDeclaration> = {
      maxHeight: el.style.maxHeight,
      height: el.style.height,
      overflow: el.style.overflow,
      overflowY: el.style.overflowY,
      overflowX: el.style.overflowX,
      display: el.style.display,
      visibility: el.style.visibility,
      position: el.style.position,
    };
    touched.push({ el, prev });
    Object.assign(el.style, next);
  };

  // 1) 강제 표시 대상: data-capture-force-open
  const forceNodes = Array.from(root.querySelectorAll<HTMLElement>("[data-capture-force-open]"));
  forceNodes.forEach((el) => {
    push(el, {
      display: "block",
      visibility: "visible",
      height: "auto",
      maxHeight: "none",
      overflow: "visible",
    });
  });

  // 2) 스크롤 영역: 전달 인자 우선, 없으면 data-capture-scroll 자동 수집
  const scrollNodes =
    (scrollContainers && scrollContainers.length > 0
      ? scrollContainers
      : Array.from(root.querySelectorAll<HTMLElement>("[data-capture-scroll]"))) || [];

  scrollNodes.forEach((el) => {
    const saved: SavedStyle = {
      el,
      prev: {
        maxHeight: el.style.maxHeight,
        height: el.style.height,
        overflow: el.style.overflow,
        overflowY: el.style.overflowY,
        overflowX: el.style.overflowX,
      },
      prevScrollTop: el.scrollTop,
      prevScrollLeft: el.scrollLeft,
    };
    touched.push(saved);

    // 스크롤 해제 + 맨 위로
    el.scrollTop = 0;
    el.scrollLeft = 0;
    Object.assign(el.style, {
      maxHeight: "none",
      height: "auto",
      overflow: "visible",
      overflowY: "visible",
      overflowX: "visible",
    } as Partial<CSSStyleDeclaration>);
  });

  // 3) 루트 자체도 스크롤 해제(가능한 경우)
  push(root, {
    maxHeight: "none",
    height: "auto",
    overflow: "visible",
  });

  const restore = () => {
    for (const t of touched) {
      Object.assign(t.el.style, t.prev);
      if (typeof t.prevScrollTop === "number") t.el.scrollTop = t.prevScrollTop;
      if (typeof t.prevScrollLeft === "number") t.el.scrollLeft = t.prevScrollLeft;
    }
  };

  return { restore };
}

/* =========================================================================
 * 내부: HTML → PNG(DataURL)
 *  - 캡처 직전 ensureOpenDuringCapture로 펼친 뒤 이미지 생성
 * ========================================================================= */
async function captureExpandedToDataURL(
  root: HTMLElement,
  options?: {
    scrollContainers?: HTMLElement[] | null;
    pixelRatio?: number;
    backgroundColor?: string;
  },
): Promise<string> {
  const { restore } = ensureOpenDuringCapture(root, options?.scrollContainers);
  try {
    // 레이아웃 안정화(리플로우 보장)
    await new Promise((r) => setTimeout(r, 40));
    return await toPng(root, {
      cacheBust: true,
      pixelRatio: options?.pixelRatio ?? 2,
      backgroundColor: options?.backgroundColor ?? "#ffffff",
    });
  } finally {
    restore();
  }
}

/* =========================================================================
 * 3) 전체 콘텐츠 PNG 저장 (접힘/스크롤 무시하고 전부 펼쳐서 캡처)
 *    - CompleteModal에서 root(예: #receipt-capture)와 스크롤 영역 노드들을
 *      넘기면, 잘림 없이 한 장의 긴 PNG로 저장됩니다.
 * ========================================================================= */
export async function saveFullContentAsPNG(
  root: HTMLElement,
  filename: string,
  scrollContainers?: HTMLElement[] | null,
) {
  const dataUrl = await captureExpandedToDataURL(root, { scrollContainers, pixelRatio: 2, backgroundColor: "#ffffff" });
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename.endsWith(".png") ? filename : `${filename}.png`;
  a.click();
}

/* =========================================================================
 * 4) 전체 콘텐츠 PDF 저장 (멀티페이지 분할)
 *    - 한 장의 긴 이미지를 A4 폭에 맞춰 여러 페이지로 잘라 넣습니다.
 * ========================================================================= */
export async function saveFullContentAsPDF(
  root: HTMLElement,
  filename: string,
  scrollContainers?: HTMLElement[] | null,
) {
  const dataUrl = await captureExpandedToDataURL(root, { scrollContainers, pixelRatio: 2, backgroundColor: "#ffffff" });

  // 원본 이미지 로드
  const img = new Image();
  img.src = dataUrl;
  await img.decode();

  // PDF 설정
  const pageWmm = 210; // A4
  const pageHmm = 297;
  const margin = 10; // 상하좌우 10mm
  const contentWmm = pageWmm - margin * 2;
  const contentHmm = pageHmm - margin * 2;

  // 픽셀-밀리미터 환산(폭 기준 스케일)
  const pxPerMm = img.width / contentWmm; // 이미지 폭(px) / PDF 내용 폭(mm)
  const sliceHeightPx = Math.floor(pxPerMm * contentHmm); // 페이지 한 장당 담을 수 있는 이미지 높이(px)

  const pdf = new jsPDF({ orientation: "p", unit: "mm", format: "a4" });

  // 슬라이스 반복
  const totalHeight = img.height;
  let yPx = 0;
  let isFirstPage = true;

  // 슬라이스용 캔버스
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d")!;

  while (yPx < totalHeight) {
    const slicePx = Math.min(sliceHeightPx, totalHeight - yPx);
    canvas.width = img.width;
    canvas.height = slicePx;

    // drawImage(source, sx, sy, sWidth, sHeight, dx, dy, dWidth, dHeight)
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, yPx, img.width, slicePx, 0, 0, canvas.width, canvas.height);

    const sliceUrl = canvas.toDataURL("image/png");
    const sliceHmm = slicePx / pxPerMm; // 해당 조각의 PDF 높이(mm)

    if (!isFirstPage) pdf.addPage();
    pdf.addImage(sliceUrl, "PNG", margin, margin, contentWmm, sliceHmm);

    yPx += slicePx;
    isFirstPage = false;
  }

  pdf.save(filename.endsWith(".pdf") ? filename : `${filename}.pdf`);
}
