// src/core/utils/capture.ts
import { toPng } from "html-to-image";
import jsPDF from "jspdf";

/* =========================================================================
 * 1) 기존 기능: 보이는 영역만 PNG 저장
 * ========================================================================= */
export async function saveNodeAsPNG(node: HTMLElement, filename: string) {
  const dataUrl = await toPng(node, { cacheBust: true, pixelRatio: 2, backgroundColor: "#ffffff" });
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename.endsWith(".png") ? filename : `${filename}.png`;
  a.click();
}

/* =========================================================================
 * 2) 기존 기능: 보이는 영역만 PDF 저장(단일 페이지)
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
 * 공통 유틸: 캡처 시 섹션 강제 펼침 & 스크롤 해제
 *  - [data-capture-force-open]: display/height/overflow를 강제로 펼침
 *  - [data-capture-scroll]: 스크롤 영역을 height:auto, overflow:visible로 전환
 *  - scrollContainers 인자로 명시 전달 시 해당 노드 우선 사용
 * ========================================================================= */
type SavedStyle = {
  el: HTMLElement;
  prev: Partial<CSSStyleDeclaration>;
  prevScrollTop?: number;
  prevScrollLeft?: number;
};

function ensureOpenDuringCapture(root: HTMLElement, scrollContainers?: HTMLElement[] | null): { restore: () => void } {
  const touched: SavedStyle[] = [];

  const rememberAndApply = (el: HTMLElement, next: Partial<CSSStyleDeclaration>) => {
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

  // 1) 강제 펼침 대상
  const forceNodes = Array.from(root.querySelectorAll<HTMLElement>("[data-capture-force-open]"));
  forceNodes.forEach((el) => {
    rememberAndApply(el, {
      display: "block",
      visibility: "visible",
      height: "auto",
      maxHeight: "none",
      overflow: "visible",
    });
  });

  // 2) 스크롤 영역 처리
  const scrollNodes =
    (scrollContainers && scrollContainers.length > 0
      ? scrollContainers
      : Array.from(root.querySelectorAll<HTMLElement>("[data-capture-scroll]"))) || [];

  scrollNodes.forEach((el) => {
    touched.push({
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
    });

    // 스크롤 맨 위로 & 해제
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

  // 3) 루트도 스크롤 해제
  rememberAndApply(root, {
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
 * 내부: 펼친 상태로 PNG(DataURL) 생성
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
    // 레이아웃 안정화
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
 * 3) 전체 콘텐츠 PNG 저장 (접힘/스크롤 무시하고 전체 캡처)
 * ========================================================================= */
export async function saveFullContentAsPNG(
  root: HTMLElement,
  filename: string,
  scrollContainers?: HTMLElement[] | null,
) {
  const dataUrl = await captureExpandedToDataURL(root, {
    scrollContainers,
    pixelRatio: 2,
    backgroundColor: "#ffffff",
  });
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename.endsWith(".png") ? filename : `${filename}.png`;
  a.click();
}

/* =========================================================================
 * 4) 전체 콘텐츠 PDF 저장 (긴 이미지 → A4 다중 페이지 분할)
 * ========================================================================= */
export async function saveFullContentAsPDF(
  root: HTMLElement,
  filename: string,
  scrollContainers?: HTMLElement[] | null,
) {
  const dataUrl = await captureExpandedToDataURL(root, {
    scrollContainers,
    pixelRatio: 2,
    backgroundColor: "#ffffff",
  });

  // 원본 이미지 로드
  const img = new Image();
  img.src = dataUrl;
  await img.decode();

  // PDF 설정
  const pageWmm = 210; // A4
  const pageHmm = 297;
  const margin = 10;
  const contentWmm = pageWmm - margin * 2;
  const contentHmm = pageHmm - margin * 2;

  // 픽셀-밀리미터 환산(폭 기준)
  const pxPerMm = img.width / contentWmm;
  const sliceHeightPx = Math.floor(pxPerMm * contentHmm);

  const pdf = new jsPDF({ orientation: "p", unit: "mm", format: "a4" });

  // 자를 캔버스
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d")!;

  let yPx = 0;
  let isFirst = true;
  while (yPx < img.height) {
    const slicePx = Math.min(sliceHeightPx, img.height - yPx);
    canvas.width = img.width;
    canvas.height = slicePx;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, yPx, img.width, slicePx, 0, 0, canvas.width, canvas.height);

    const sliceUrl = canvas.toDataURL("image/png");
    const sliceHmm = slicePx / pxPerMm;

    if (!isFirst) pdf.addPage();
    pdf.addImage(sliceUrl, "PNG", margin, margin, contentWmm, sliceHmm);

    yPx += slicePx;
    isFirst = false;
  }

  pdf.save(filename.endsWith(".pdf") ? filename : `${filename}.pdf`);
}
