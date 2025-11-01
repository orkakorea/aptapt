// src/core/utils/capture.ts
import { toPng, toCanvas } from "html-to-image";
import jsPDF from "jspdf";

/** 내부 유틸: 픽셀/밀리미터 변환(브라우저 논리 DPI 96 기준) */
const PX_PER_MM = 96 / 25.4;

/** 캡처 전용: 노드 및 하위 스크롤 컨테이너를 일시적으로 펼쳐 전체 높이를 캡처 가능하게 만들기 */
function expandDomForCapture(root: HTMLElement): () => void {
  const changed: Array<{ el: HTMLElement; style: Partial<CSSStyleDeclaration> }> = [];

  const setStyle = (el: HTMLElement, patch: Partial<CSSStyleDeclaration>) => {
    const prev: Partial<CSSStyleDeclaration> = {};
    for (const k of Object.keys(patch) as Array<keyof CSSStyleDeclaration>) {
      // @ts-expect-error - index access
      prev[k] = el.style[k];
      // @ts-expect-error
      el.style[k] = patch[k] ?? "";
    }
    changed.push({ el, style: prev });
  };

  // 루트 자체 확장
  setStyle(root, {
    overflow: "visible",
    maxHeight: "none",
    height: "auto",
  });

  // 하위 모든 요소 중 스크롤/클리핑 유발하는 컨테이너 확장
  const all = Array.from(root.querySelectorAll<HTMLElement>("*"));
  for (const el of all) {
    const cs = getComputedStyle(el);
    const isScrollable =
      /(auto|scroll)/.test(cs.overflowY) || /(auto|scroll)/.test(cs.overflow) || el.scrollHeight > el.clientHeight;

    // 캡처를 방해하는 transform/sticky/fixed도 가급적 무력화
    if (isScrollable) {
      setStyle(el, { overflow: "visible", maxHeight: "none" });
    }
    if (cs.position === "sticky") {
      setStyle(el, { position: "static", top: "auto" });
    }
    // 매우 드물지만 transform이 캔버스 좌표계를 왜곡해 잘리는 경우 방지
    if (cs.transform && cs.transform !== "none") {
      setStyle(el, { transform: "none", transformOrigin: "initial" });
    }
  }

  // 되돌리기
  return () => {
    for (let i = changed.length - 1; i >= 0; i--) {
      const { el, style } = changed[i];
      for (const k of Object.keys(style) as Array<keyof CSSStyleDeclaration>) {
        // @ts-expect-error
        el.style[k] = style[k] ?? "";
      }
    }
  };
}

/** 노드의 전체 렌더 크기(스크롤 포함) 계산 */
function getFullSize(node: HTMLElement) {
  const w = Math.max(node.scrollWidth, node.clientWidth, node.offsetWidth);
  const h = Math.max(node.scrollHeight, node.clientHeight, node.offsetHeight);
  return { width: w, height: h };
}

/** PNG 저장: 잘림 없이 전체 영역을 한 장으로 */
export async function saveNodeAsPNG(node: HTMLElement, filename: string) {
  const restore = expandDomForCapture(node);
  try {
    const { width, height } = getFullSize(node);
    const pixelRatio = 2; // 해상도(메모리 여유에 따라 2~3)
    const dataUrl = await toPng(node, {
      cacheBust: true,
      backgroundColor: "#ffffff",
      pixelRatio,
      width,
      height,
      canvasWidth: width,
      canvasHeight: height,
    });

    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = filename.endsWith(".png") ? filename : `${filename}.png`;
    a.click();
  } finally {
    restore();
  }
}

/** PDF 저장: A4 여러 페이지로 자동 분할 (여백 10mm) */
export async function saveNodeAsPDF(node: HTMLElement, filename: string) {
  const restore = expandDomForCapture(node);
  try {
    const { width, height } = getFullSize(node);
    const pixelRatio = 2;

    // html-to-image에서 캔버스 직접 생성
    const canvas = await toCanvas(node, {
      cacheBust: true,
      backgroundColor: "#ffffff",
      pixelRatio,
      width,
      height,
      canvasWidth: width,
      canvasHeight: height,
    });

    const cw = canvas.width; // 원본 캔버스 가로(px)
    const ch = canvas.height; // 원본 캔버스 세로(px)

    // PDF 설정(A4 세로)
    const pageW = 210; // mm
    const pageH = 297; // mm
    const margin = 10; // mm
    const contentWmm = pageW - margin * 2;
    const contentHmm = pageH - margin * 2;

    // 한 페이지에 들어갈 "원본 캔버스 픽셀" 높이(가로를 PDF 폭에 맞춰 스케일한다고 가정)
    // (segmentPx / cw) * contentWmm == contentHmm  =>  segmentPx = cw * contentHmm / contentWmm
    const segmentPx = Math.max(1, Math.floor((cw * contentHmm) / contentWmm));

    const pdf = new jsPDF({ orientation: "p", unit: "mm", format: "a4" });

    // 슬라이스용 캔버스
    const slice = document.createElement("canvas");
    slice.width = cw;
    const ctx = slice.getContext("2d")!;

    let y = 0;
    let isFirstPage = true;

    while (y < ch) {
      const hPx = Math.min(segmentPx, ch - y);
      slice.height = hPx;

      // 원본에서 y~y+hPx 구간을 슬라이스에 그려 넣음
      ctx.clearRect(0, 0, cw, hPx);
      ctx.drawImage(canvas, 0, y, cw, hPx, 0, 0, cw, hPx);

      const dataUrl = slice.toDataURL("image/png");

      // 현재 슬라이스의 렌더 높이(mm) = (hPx / cw) * contentWmm
      const renderHmm = (hPx / cw) * contentWmm;

      if (!isFirstPage) pdf.addPage();
      pdf.addImage(dataUrl, "PNG", margin, margin, contentWmm, renderHmm, undefined, "FAST");

      isFirstPage = false;
      y += hPx;
    }

    pdf.save(filename.endsWith(".pdf") ? filename : `${filename}.pdf`);
  } finally {
    restore();
  }
}
