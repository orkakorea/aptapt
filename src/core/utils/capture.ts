// 이미지/PDF 저장 유틸 (html-to-image + jsPDF)
import { toPng } from "html-to-image";
import jsPDF from "jspdf";

export async function saveNodeAsPNG(node: HTMLElement, filename: string) {
  const dataUrl = await toPng(node, {
    cacheBust: true,
    pixelRatio: 2, // 레티나 품질
    backgroundColor: "#ffffff",
  });
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename.endsWith(".png") ? filename : `${filename}.png`;
  a.click();
}

export async function saveNodeAsPDF(node: HTMLElement, filename: string) {
  // 1) PNG로 렌더
  const dataUrl = await toPng(node, { cacheBust: true, pixelRatio: 2, backgroundColor: "#ffffff" });

  // 2) A4 세로로 맞춰 삽입
  const pdf = new jsPDF({ orientation: "p", unit: "mm", format: "a4" });
  const img = new Image();
  img.src = dataUrl;
  await img.decode();

  const pageW = 210; // A4 mm
  const pageH = 297;
  const imgW = pageW - 20; // 좌우 10mm 여백
  const ratio = img.height / img.width;
  const imgH = imgW * ratio;

  let y = 10;
  let remain = imgH;
  let offset = 0;

  // 이미지가 한 장에 안 들어갈 수 있으니 페이지 분할
  while (remain > 0) {
    pdf.addImage(dataUrl, "PNG", 10, y, imgW, imgH);
    remain -= pageH;
    if (remain > 0) {
      pdf.addPage();
      y = 10;
      offset += pageH;
    }
  }

  pdf.save(filename.endsWith(".pdf") ? filename : `${filename}.pdf`);
}
