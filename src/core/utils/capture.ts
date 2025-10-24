// src/core/utils/capture.ts
import { toPng } from "html-to-image";
import jsPDF from "jspdf";

export async function saveNodeAsPNG(node: HTMLElement, filename: string) {
  const dataUrl = await toPng(node, { cacheBust: true, pixelRatio: 2, backgroundColor: "#ffffff" });
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename.endsWith(".png") ? filename : `${filename}.png`;
  a.click();
}

export async function saveNodeAsPDF(node: HTMLElement, filename: string) {
  const dataUrl = await toPng(node, { cacheBust: true, pixelRatio: 2, backgroundColor: "#ffffff" });

  const pdf = new jsPDF({ orientation: "p", unit: "mm", format: "a4" });
  const img = new Image();
  img.src = dataUrl;
  await img.decode();

  const pageW = 210; // A4(mm)
  const pageH = 297;
  const imgW = pageW - 20; // 좌우 10mm 여백
  const ratio = img.height / img.width;
  const imgH = imgW * ratio;

  pdf.addImage(dataUrl, "PNG", 10, 10, imgW, imgH);
  pdf.save(filename.endsWith(".pdf") ? filename : `${filename}.pdf`);
}
