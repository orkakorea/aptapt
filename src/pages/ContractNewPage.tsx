// src/pages/ContractNewPage.tsx
import React, { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";

// 계약서 템플릿 PNG 경로
const TEMPLATE_URL = "/products/orka-contract-top.png";

/** ============ 날짜 유틸 ============ */
function addMonthsInclusive(startISO: string, months: number): string {
  if (!startISO || !months) return "";
  const parts = startISO.split("-");
  if (parts.length !== 3) return "";
  const [y, m, d] = parts.map((v) => Number(v));
  if (!y || !m || !d) return "";
  const date = new Date(y, m - 1, d);
  date.setMonth(date.getMonth() + months);
  date.setDate(date.getDate() - 1); // 포함 기간 → 마지막 날
  const yy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

function addWeeksInclusive(startISO: string, months: number): string {
  if (!startISO || !months) return "";
  const parts = startISO.split("-");
  if (parts.length !== 3) return "";
  const [y, m, d] = parts.map((v) => Number(v));
  if (!y || !m || !d) return "";
  const weeks = months * 4;
  const days = weeks * 7;
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + days - 1); // 포함 기간
  const yy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

const norm = (s: string) => s.replace(/\s+/g, "").toLowerCase();
const isElevatorProduct = (prod?: string) => {
  if (!prod) return false;
  const n = norm(prod);
  return n.includes("elevatortv") || n.includes("엘리베이터tv") || n.includes("elevator") || n.includes("엘리베이터");
};

const ContractNewPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation() as any;

  const handlePrint = () => {
    window.print();
  };

  const todayISO = new Date().toISOString().slice(0, 10);

  // ============================
  // 견적서(QuoteModal)에서 넘어온 값 읽기
  // ============================
  const contractPrefill = (location?.state && location.state.contractPrefill) || {};

  // 원본 상품명 (예: "ELEVATOR TV 외 11건")
  const rawProductName: string = contractPrefill.productName ?? "";

  // 1개일 땐 그대로, "ELEVATOR TV 외 11건"일 땐 "ELEVATOR TV 외" 로 변환
  const productName: string = rawProductName.replace(/\s*외\s*\d+\s*건?$/, " 외").trim();

  const baseAmount: number | undefined =
    typeof contractPrefill.baseAmount === "number" && Number.isFinite(contractPrefill.baseAmount)
      ? contractPrefill.baseAmount
      : undefined;
  const initialContractAmount: number =
    typeof contractPrefill.contractAmount === "number" && Number.isFinite(contractPrefill.contractAmount)
      ? contractPrefill.contractAmount
      : 0;
  const monitorCount: number | undefined =
    typeof contractPrefill.monitorCount === "number" && Number.isFinite(contractPrefill.monitorCount)
      ? contractPrefill.monitorCount
      : undefined;
  const adMonths: number | undefined =
    typeof contractPrefill.adMonths === "number" && Number.isFinite(contractPrefill.adMonths)
      ? contractPrefill.adMonths
      : undefined;

  // 계약기간(개월) 상태: 자동입력값을 기본으로, 수정 시 비고 종료일 재계산
  const initialPeriodMonths: number | undefined =
    typeof adMonths === "number" && Number.isFinite(adMonths) && adMonths > 0 ? adMonths : undefined;
  const [periodMonths, setPeriodMonths] = useState<number | undefined>(initialPeriodMonths);
  const [periodInput, setPeriodInput] = useState<string>(initialPeriodMonths ? String(initialPeriodMonths) : "");

  const contractAptLinesRaw: string[] = Array.isArray(contractPrefill.contractAptLines)
    ? (contractPrefill.contractAptLines as string[])
    : [];

  // "상품명: 단지1, 단지2..." 형식을 상품명/단지명으로 분리
  const remarkProducts: string[] = [];
  const remarkApts: string[] = [];
  contractAptLinesRaw.slice(0, 6).forEach((line) => {
    if (!line) {
      remarkProducts.push("");
      remarkApts.push("");
      return;
    }
    const [prod, rest] = line.split(":");
    remarkProducts.push((prod ?? "").trim());
    remarkApts.push((rest ?? "").trim());
  });
  while (remarkProducts.length < 6) remarkProducts.push("");
  while (remarkApts.length < 6) remarkApts.push("");

  // 계약 단지명: 자동입력 + 수정 가능
  const [aptLines, setAptLines] = useState<string[]>(remarkApts);

  const [companyName, setCompanyName] = useState("");

  const hasRowProduct = (index: number) => {
    const txt = remarkProducts[index];
    return !!(txt && txt.trim().length > 0);
  };

  // 숫자 포맷 (쉼표만, "원" 없음)
  const fmtNumberPlain = (n?: number) =>
    typeof n === "number" && Number.isFinite(n) && n > 0 ? n.toLocaleString() : "";

  const parseNumber = (s: string): number => {
    if (!s) return 0;
    const cleaned = s.replace(/[^0-9.-]/g, "");
    if (!cleaned) return 0;
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : 0;
  };

  // 2) 계약금액: 자동 입력 + 수정 가능한 필드
  const [contractAmountValue, setContractAmountValue] = useState<number>(initialContractAmount);
  // 제작비
  const [prodFeeValue, setProdFeeValue] = useState<number>(0);

  // 총계약금액(VAT별도) = 계약금액 + 제작비
  const vatExcludedTotal = (contractAmountValue || 0) + (prodFeeValue || 0);
  const vatIncludedTotal = vatExcludedTotal > 0 ? Math.round(vatExcludedTotal * 1.1) : 0;

  const contractAmountDisplay = fmtNumberPlain(contractAmountValue);
  const prodFeeDisplay = fmtNumberPlain(prodFeeValue);
  const vatExcludedDisplay = fmtNumberPlain(vatExcludedTotal);
  const vatIncludedDisplay = fmtNumberPlain(vatIncludedTotal);

  // 계약 단지명 글자 수에 따라 폰트 크기 조절
  const getAptFontSize = (text: string) => {
    const len = text?.length ?? 0;
    if (len === 0) return 11;
    if (len > 160) return 7;
    if (len > 120) return 8;
    if (len > 80) return 9;
    if (len > 40) return 10;
    return 11;
  };
  const aptFontSizes = aptLines.map((t) => getAptFontSize(t));

  const handleAptChange = (index: number, value: string) => {
    setAptLines((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  };

  // 송출 시작/종료일 상태 (각 6줄)
  const [startDates, setStartDates] = useState<string[]>(Array(6).fill(""));
  const [endDates, setEndDates] = useState<string[]>(Array(6).fill(""));

  // 첫 번째 송출개시 일괄 적용 여부
  const [applyFirstStartToAll, setApplyFirstStartToAll] = useState<boolean>(true); // 기본 체크 ON

  const recalcEndForRow = (rowIndex: number, startISO: string, months: number | undefined): string => {
    if (!startISO || !months || months <= 0) return "";
    const rowProd = remarkProducts[rowIndex];
    const prodNameForRow = rowProd && rowProd.trim().length > 0 ? rowProd : productName;
    const isElevator = isElevatorProduct(prodNameForRow);
    return isElevator ? addWeeksInclusive(startISO, months) : addMonthsInclusive(startISO, months);
  };

  const handleStartChange = (index: number, value: string) => {
    // 체크박스가 체크되어 있고, 첫 번째 행을 수정한 경우 → 아래 행들 일괄 적용
    if (applyFirstStartToAll && index === 0) {
      const newStarts = [...startDates];
      const newEnds = [...endDates];

      newStarts[0] = value;
      newEnds[0] = value && periodMonths ? recalcEndForRow(0, value, periodMonths) : "";

      if (value && periodMonths && periodMonths > 0) {
        for (let i = 1; i < 6; i++) {
          if (!hasRowProduct(i)) continue; // 상품명이 있을 때만
          newStarts[i] = value;
          newEnds[i] = recalcEndForRow(i, value, periodMonths);
        }
      } else {
        // 시작일이 비워진 경우, 아래 행들도 시작/종료를 비워줌
        for (let i = 1; i < 6; i++) {
          if (!hasRowProduct(i)) continue;
          newStarts[i] = "";
          newEnds[i] = "";
        }
      }

      setStartDates(newStarts);
      setEndDates(newEnds);
      return;
    }

    // 체크해제거나 1행이 아닌 경우 → 개별 행만 처리
    const newStarts = [...startDates];
    newStarts[index] = value;
    setStartDates(newStarts);

    const newEnds = [...endDates];
    if (!value || !periodMonths || periodMonths <= 0) {
      newEnds[index] = "";
    } else {
      newEnds[index] = recalcEndForRow(index, value, periodMonths);
    }
    setEndDates(newEnds);
  };

  const handleEndChange = (index: number, value: string) => {
    const newEnds = [...endDates];
    newEnds[index] = value;
    setEndDates(newEnds);
  };

  // 계약기간(개월) 변경 시 → 상태 업데이트 + 비고 종료일 재계산
  const handlePeriodChange = (value: string) => {
    setPeriodInput(value);
    const num = parseNumber(value);
    const monthsVal = num > 0 ? num : undefined;
    setPeriodMonths(monthsVal);

    if (!monthsVal) {
      // 기간이 없으면 종료일 모두 비움
      setEndDates(Array(6).fill(""));
      return;
    }

    // 기존 시작일 기준으로 종료일 재계산
    setEndDates((prev) => {
      const next = [...prev];
      for (let i = 0; i < 6; i++) {
        const startISO = startDates[i];
        if (!startISO || !hasRowProduct(i)) {
          next[i] = "";
          continue;
        }
        next[i] = recalcEndForRow(i, startISO, monthsVal);
      }
      return next;
    });
  };

  return (
    <div className="contract-root">
      <style>{`
  .contract-root {
    padding: 16px;
    background: #e5e7eb;
  }

  .contract-toolbar {
    max-width: 900px;
    margin: 0 auto 12px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }

  .contract-toolbar button {
    padding: 6px 12px;
    font-size: 13px;
    border-radius: 4px;
    border: 1px solid #d1d5db;
    background: #ffffff;
    cursor: pointer;
  }

  .contract-toolbar button.primary {
    border-color: #6f4bf2;
    background: #6f4bf2;
    color: #ffffff;
    font-weight: 600;
  }

  .contract-paper {
    max-width: 900px;
    margin: 0 auto 32px;
    background: #ffffff;
    padding: 16px;
    box-shadow: 0 8px 18px rgba(15, 23, 42, 0.16);
    box-sizing: border-box;
    font-family: "Pretendard", -apple-system, BlinkMacSystemFont, system-ui,
      "Segoe UI", sans-serif;
    color: #111827;
    font-size: 11px;
    line-height: 1.4;
  }

  /* ====== 위쪽 PNG 영역 ====== */
  .contract-sheet-wrapper {
    width: 100%;
    max-height: 80vh;      /* 🔹 세로 스크롤 영역 높이 제한 */
    overflow-y: auto;      /* 🔹 세로 스크롤 생성 */
    display: flex;
    justify-content: center;
  }

  .contract-sheet {
    position: relative;
    width: 100%;
    max-width: 820px;
    /* 원본 PNG 1765 x 2600 기준 비율 */
    aspect-ratio: 1765 / 2600;
  }

  /* 배경 PNG (background-image 대신 img로 인쇄 호환용) */
  .contract-bg {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: contain;
    z-index: 0;
  }

  /* 공통 필드 컨테이너 */
  .field {
    position: absolute;
    background: transparent;
    color: #111827;
    font-size: 11px;
    padding: 0 2px;
    box-sizing: border-box;
    z-index: 1;
  }

  .field::placeholder {
    color: rgba(75, 85, 99, 0.8);
  }

  /* ===== 입력 필드: 기본은 노란 박스 ===== */
  .field-input,
  .field-select,
  .field-textarea {
    width: 100%;
    height: 100%;
    border: none;
    outline: none;
    background: #FFF6BC;
    padding: 0 4px;
    box-sizing: border-box;
    font-size: 11px;
    font-family: inherit;
    color: #111827;
  }

  /* ===== date 인풋에서 기본 달력 아이콘 숨기기 ===== */
  .field-input[type="date"] {
    padding-right: 4px;
    -moz-appearance: textfield;
  }

  .field-input[type="date"]::-webkit-inner-spin-button,
  .field-input[type="date"]::-webkit-calendar-picker-indicator {
    display: none;
    -webkit-appearance: none;
  }

  .field-textarea {
    padding-top: 4px;
    padding-bottom: 4px;
    resize: none;
  }

  /* 자동입력(readOnly)은 완전 투명 */
  .field-input[readonly],
  .field-textarea[readonly] {
    background: transparent;
  }

  /* 드롭다운(입력용) – 텍스트 잘리지 않게 약간 여유 */
  .field-select {
    padding: 2px 16px 0 4px;
  }

  /* 체크박스 컨테이너는 노란 박스 */
  .field-checkbox {
    display: flex;
    align-items: center;
    justify-content: center;
    border: none;
    background: #FFF6BC;
  }

  .field-checkbox input {
    width: 14px;
    height: 14px;
  }

  /* ===== 좌표: 원본 PNG 1765 x 2600 기준 → % 변환 ===== */

  /* 광고주 정보 + 상단 계약 정보 */
  
    /* === 계약금액 리셋 버튼 필드 === */
  .field-contractAmtReset {
    left: 88.3853%;   /* 1560 / 1765 * 100 */
    top: 25.3077%;    /* 658 / 2600 * 100 */
    width: 1.6997%;   /* 30 / 1765 * 100 */
    height: 1.1538%;  /* 30 / 2600 * 100 */
  }

  .field-reset-btn {
    width: 100%;
    height: 100%;
    border: none;
    outline: none;
    background: #FFF6BC;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 10px;
    font-family: inherit;
    cursor: pointer;
    padding: 0;
  }

    /* === 정렬 규칙 === */

  /* 1. 광고주 정보 영역: 가운데 정렬 */
  .field-company .field-input,
  .field-ceo .field-input,
  .field-bizno .field-input,
  .field-manager .field-input,
  .field-email .field-input,
  .field-phone1 .field-input,
  .field-biztype .field-input,
  .field-address .field-input {
    text-align: center;
  }

  /* 2. 브랜드명 / 상품명도 가운데 정렬 */
  .field-brand .field-input,
  .field-productName .field-input {
    text-align: center;
  }

  /* 3. 그 외 계약내용 + 결제정보 숫자/날짜 필드: 우측 정렬 */
  .field-baseAmount .field-input,
  .field-qty .field-input,
  .field-contractAmt1 .field-input,
  .field-period .field-input,
  .field-prodFee .field-input,
  .field-contractAmt2 .field-input,
  .field-finalQuote .field-input,
  .field-billDate .field-input,
  .field-paidDate .field-input {
    text-align: right;
  }

  .field-company { left: 21.5297%; top: 9.6154%; width: 28.3286%; height: 1.1538%; }
  .field-ceo { left: 60.6232%; top: 9.6154%; width: 28.3286%; height: 1.1538%; }
  .field-bizno { left: 21.5297%; top: 11.4615%; width: 28.3286%; height: 1.1538%; }
  .field-manager { left: 60.6232%; top: 11.5000%; width: 28.3286%; height: 1.1538%; }
  .field-email { left: 21.5297%; top: 13.3462%; width: 28.3286%; height: 1.1538%; }
  .field-phone1 { left: 60.6232%; top: 13.3077%; width: 28.3286%; height: 1.1538%; }
  .field-biztype { left: 21.5297%; top: 15.1923%; width: 67.4221%; height: 1.1538%; }
  .field-address { left: 21.5297%; top: 17.0385%; width: 67.4221%; height: 1.1538%; }

  .field-brand { left: 21.5297%; top: 19.7308%; width: 67.4221%; height: 1.1538%; }
  .field-productName { left: 21.5297%; top: 21.5769%; width: 67.4221%; height: 1.1538%; }

  .field-drop1 { left: 21.5297%; top: 23.4131%; width: 9.8584%; height: 1.1538%; }
  .field-drop2 { left: 37.9037%; top: 23.4131%; width: 8.0453%; height: 1.1538%; }
  .field-baseAmount { left: 65.6657%; top: 23.4231%; width: 20.5666%; height: 1.1538%; }

  .field-qty { left: 21.5297%; top: 25.2692%; width: 24.4193%; height: 1.1538%; }
  .field-contractAmt1 { left: 65.6657%; top: 25.2692%; width: 20.5666%; height: 1.1538%; }

  .field-period { left: 37.9037%; top: 27.1538%; width: 8.0453%; height: 1.1538%; }
  .field-prodFee { left: 65.6657%; top: 27.1538%; width: 20.5666%; height: 1.1538%; }

  .field-contractAmt2 { left: 21.5297%; top: 29.7692%; width: 24.4193%; height: 1.1538%; }
  .field-finalQuote { left: 65.6657%; top: 29.7692%; width: 20.5666%; height: 1.1538%; }

  /* 결제 정보 체크박스 + 날짜 + 회차 필드 */
  .field-cb1 { left: 11.8414%; top: 32.5385%; width: 1.6997%; height: 1.1538%; }
  .field-cb2 { left: 21.5297%; top: 32.5000%; width: 1.6997%; height: 1.1538%; }
  .field-cb3 { left: 26.9122%; top: 32.5000%; width: 1.6997%; height: 1.1538%; }
  .field-cb4 { left: 11.8414%; top: 34.3077%; width: 1.6997%; height: 1.1538%; }
  .field-cb5 { left: 21.5297%; top: 34.3077%; width: 1.6997%; height: 1.1538%; }
  .field-cb6 { left: 26.9122%; top: 34.3077%; width: 1.6997%; height: 1.1538%; }

  /* ✅ 신규 체크박스: 첫 행 송출개시 일괄적용 여부 */
  .field-cb9 { left: 30.3683%; top: 38.8462%; width: 1.6997%; height: 1.1538%; }

  /* 회차1/회차2 (수기입력) */
  .field-round1 { left: 31.3881%; top: 32.5000%; width: 4.5326%; height: 1.1538%; }
  .field-round2 { left: 31.3881%; top: 34.3077%; width: 4.5326%; height: 1.1538%; }

  .field-billDate { left: 61.3598%; top: 32.5000%; width: 24.9292%; height: 1.1538%; }
  .field-paidDate { left: 61.3598%; top: 34.3077%; width: 24.9292%; height: 1.1538%; }

  /* 비고 영역 – 상품/송출/단지명 */
  .field-item1 { left: 9.4618%; top: 41.6154%; width: 10.0283%; height: 1.1538%; }
  .field-item2 { left: 9.4618%; top: 45.3077%; width: 10.0283%; height: 1.1538%; }
  .field-item3 { left: 9.4618%; top: 49.1538%; width: 10.0283%; height: 1.1538%; }
  .field-item4 { left: 9.4618%; top: 52.8462%; width: 10.0283%; height: 1.1538%; }
  .field-item5 { left: 9.4618%; top: 56.4231%; width: 10.0283%; height: 1.1538%; }
  .field-item6 { left: 9.4618%; top: 60.1923%; width: 10.0283%; height: 1.1538%; }

  .field-start1 { left: 20.9065%; top: 41.6154%; width: 9.1218%; height: 1.1538%; }
  .field-start2 { left: 20.9065%; top: 45.3077%; width: 9.1218%; height: 1.1538%; }
  .field-start3 { left: 20.9065%; top: 49.0769%; width: 9.1218%; height: 1.1538%; }
  .field-start4 { left: 20.9065%; top: 52.8077%; width: 9.1218%; height: 1.1538%; }
  .field-start5 { left: 20.9065%; top: 56.4231%; width: 9.1218%; height: 1.1538%; }
  .field-start6 { left: 20.9065%; top: 60.1923%; width: 9.1218%; height: 1.1538%; }

  .field-end1 { left: 31.2380%; top: 41.6154%; width: 9.9218%; height: 1.1538%; }
  .field-end2 { left: 31.2380%; top: 45.3077%; width: 9.9218%; height: 1.1538%; }
  .field-end3 { left: 31.2380%; top: 49.0769%; width: 9.9218%; height: 1.1538%; }
  .field-end4 { left: 31.2380%; top: 52.8077%; width: 9.9218%; height: 1.1538%; }
  .field-end5 { left: 31.2380%; top: 56.4231%; width: 9.9218%; height: 1.1538%; }
  .field-end6 { left: 31.2380%; top: 60.1923%; width: 9.9218%; height: 1.1538%; }

  .field-apt1 { left: 44.3626%; top: 40.6538%; width: 50.9915%; height: 3.0769%; }
  .field-apt2 { left: 44.3626%; top: 44.3462%; width: 50.9915%; height: 3.0769%; }
  .field-apt3 { left: 44.3626%; top: 48.1154%; width: 50.9915%; height: 3.0769%; }
  .field-apt4 { left: 44.3626%; top: 51.8462%; width: 50.9915%; height: 3.0769%; }
  .field-apt5 { left: 44.3626%; top: 55.4615%; width: 50.9915%; height: 3.0769%; }
  .field-apt6 { left: 44.3626%; top: 59.2308%; width: 50.9915%; height: 3.0769%; }

  /* 비고 상품명: 최대 2줄 표시, 나머지는 숨김 */
  .field-item-multiline {
    width: 100%;
    height: 100%;
    font-size: 11px;
    font-family: inherit;
    line-height: 1.1;
    white-space: normal;        /* 줄바꿈 허용 */
    overflow: hidden;
    display: -webkit-box;       /* 2줄 클램프용 */
    -webkit-line-clamp: 2;      /* 최대 2줄 */
    -webkit-box-orient: vertical;
    word-break: keep-all;       /* 한글 단어 단위 줄바꿈 */
  }

  /* 하단 계약 담당자/고객 영역 */
  .field-contractManager { left: 85.8357%; top: 82.3462%; width: 9.6317%; height: 1.1538%; }
  .field-contact2 { left: 85.8357%; top: 83.8077%; width: 9.6317%; height: 1.1538%; }
  .field-contractDate { left: 74.1643%; top: 85.6923%; width: 16.9972%; height: 1.1538%; }
  .field-contractCustomer { left: 71.7847%; top: 94.2308%; width: 17.5637%; height: 1.9231%; }
  .field-cb7 { left: 43.3994%; top: 87.7692%; width: 1.6997%; height: 1.1538%; }
  .field-cb8 { left: 43.3994%; top: 95.1538%; width: 1.6997%; height: 1.1538%; }

  /* 인쇄 설정: PDF 저장 시 필드 배경 투명 */
  @media print {
    @page {
      size: A4 portrait;
      margin: 5mm;
    }

    body {
      margin: 0;
    }

    .contract-root {
      padding: 0;
      background: #ffffff;
    }

    .contract-paper {
      margin: 0 auto;
      box-shadow: none;
      padding: 4mm 6mm 6mm;
    }

    .contract-sheet-wrapper {
      max-height: none;
      overflow: visible;
    }

    .contract-sheet,
    .contract-bg {
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    .field-input,
    .field-select,
    .field-textarea,
    .field-checkbox {
      background: transparent !important;
    }

    .contract-toolbar {
      display: none !important;
    }

    .field {
      border: none;
    }
  }
`}</style>

      <div className="contract-toolbar">
        <button type="button" onClick={() => navigate(-1)}>
          ← 이전 화면으로
        </button>
        <button type="button" className="primary" onClick={handlePrint}>
          계약서 인쇄 / PDF 저장
        </button>
      </div>

      <div className="contract-paper">
        <div className="contract-sheet-wrapper">
          <div className="contract-sheet">
            <img src={TEMPLATE_URL} className="contract-bg" alt="" />

            {/* 광고주 정보 */}
            <div className="field field-company">
              <input className="field-input" value={companyName} onChange={(e) => setCompanyName(e.target.value)} />
            </div>
            <div className="field field-ceo">
              <input className="field-input" />
            </div>
            <div className="field field-bizno">
              <input className="field-input" />
            </div>
            <div className="field field-manager">
              <input className="field-input" />
            </div>
            <div className="field field-email">
              <input className="field-input" />
            </div>
            <div className="field field-phone1">
              <input className="field-input" />
            </div>
            <div className="field field-biztype">
              <input className="field-input" />
            </div>
            <div className="field field-address">
              <input className="field-input" />
            </div>

            {/* 계약 내용 */}
            <div className="field field-brand">
              <input className="field-input" />
            </div>
            <div className="field field-productName">
              <input
                className="field-input"
                readOnly
                defaultValue={productName}
                style={{ fontSize: 10 }} // 상품명 글씨 1 작게
              />
            </div>

            <div className="field field-drop1">
              <select className="field-select" defaultValue="">
                <option value="">초 선택</option>
                <option value="15">15초</option>
                <option value="20">20초</option>
                <option value="30">30초</option>
              </select>
            </div>
            <div className="field field-drop2">
              <select className="field-select" defaultValue="">
                <option value="">1</option>
                <option value="1">0.5</option>
                <option value="2">2</option>
              </select>
            </div>

            <div className="field field-baseAmount">
              <input className="field-input" readOnly value={fmtNumberPlain(baseAmount)} />
            </div>

            <div className="field field-qty">
              <input className="field-input" readOnly defaultValue={fmtNumberPlain(monitorCount)} />
            </div>

            {/* 2) 계약금액: 자동 입력 + 수정 가능 */}
            <div className="field field-contractAmt1">
              <input
                className="field-input"
                value={contractAmountDisplay}
                onChange={(e) => setContractAmountValue(parseNumber(e.target.value))}
              />
            </div>
            {/* 계약금액 리셋 버튼 (1560,658,30,30) */}
            <div className="field field-contractAmtReset">
              <button
                type="button"
                className="field-reset-btn"
                onClick={() => setContractAmountValue(initialContractAmount)}
                title="계약금액 원래 값으로 되돌리기"
              >
                ↺
              </button>
            </div>

            {/* 광고기간: 최장 기간 하나만 표시, 수정 가능 + 비고 종료일 연동 */}
            <div className="field field-period">
              <input className="field-input" value={periodInput} onChange={(e) => handlePeriodChange(e.target.value)} />
            </div>

            {/* 제작비 */}
            <div className="field field-prodFee">
              <input
                className="field-input"
                value={prodFeeDisplay}
                onChange={(e) => setProdFeeValue(parseNumber(e.target.value))}
              />
            </div>

            {/* 3) 총계약금액 (VAT 별도) = 계약금액 + 제작비 */}
            <div className="field field-contractAmt2">
              <input className="field-input" readOnly value={vatExcludedDisplay} style={{ fontWeight: 700 }} />
            </div>

            {/* 4) 총계약금액 (VAT 포함) = VAT 별도 × 1.1 */}
            <div className="field field-finalQuote">
              <input className="field-input" readOnly value={vatIncludedDisplay} style={{ fontWeight: 700 }} />
            </div>

            {/* 결제 정보 체크박스 + 회차 */}
            <div className="field field-cb1 field-checkbox">
              <input type="checkbox" />
            </div>
            <div className="field field-cb2 field-checkbox">
              <input type="checkbox" />
            </div>
            <div className="field field-cb3 field-checkbox">
              <input type="checkbox" />
            </div>
            <div className="field field-cb4 field-checkbox">
              <input type="checkbox" />
            </div>
            <div className="field field-cb5 field-checkbox">
              <input type="checkbox" />
            </div>
            <div className="field field-cb6 field-checkbox">
              <input type="checkbox" />
            </div>

            {/* 첫 번째 송출개시 → 아래 행 일괄 변경 */}
            <div className="field field-cb9 field-checkbox">
              <input
                type="checkbox"
                checked={applyFirstStartToAll}
                onChange={(e) => setApplyFirstStartToAll(e.target.checked)}
              />
            </div>

            {/* 회차1 / 회차2 */}
            <div className="field field-round1">
              <input className="field-input" />
            </div>
            <div className="field field-round2">
              <input className="field-input" />
            </div>

            <div className="field field-billDate">
              <input
                className="field-input"
                type="date"
                defaultValue={todayISO} // ← 계산서 발행일: 오늘 날짜 디폴트
              />
            </div>
            <div className="field field-paidDate">
              <input
                className="field-input"
                type="date"
                defaultValue={todayISO} // ← 입금일자: 오늘 날짜 디폴트
              />
            </div>

            {/* 비고 – 상품명 (최대 2줄) */}
            <div className="field field-item1">
              <div className="field-item-multiline">{remarkProducts[0]}</div>
            </div>
            <div className="field field-item2">
              <div className="field-item-multiline">{remarkProducts[1]}</div>
            </div>
            <div className="field field-item3">
              <div className="field-item-multiline">{remarkProducts[2]}</div>
            </div>
            <div className="field field-item4">
              <div className="field-item-multiline">{remarkProducts[3]}</div>
            </div>
            <div className="field field-item5">
              <div className="field-item-multiline">{remarkProducts[4]}</div>
            </div>
            <div className="field field-item6">
              <div className="field-item-multiline">{remarkProducts[5]}</div>
            </div>

            {/* 송출 개시 (각 행별, 상품명 있을 때만 date 타입) */}
            <div className="field field-start1">
              <input
                className="field-input"
                type={hasRowProduct(0) ? "date" : "text"}
                value={startDates[0]}
                onChange={(e) => handleStartChange(0, e.target.value)}
              />
            </div>
            <div className="field field-start2">
              <input
                className="field-input"
                type={hasRowProduct(1) ? "date" : "text"}
                value={startDates[1]}
                onChange={(e) => handleStartChange(1, e.target.value)}
              />
            </div>
            <div className="field field-start3">
              <input
                className="field-input"
                type={hasRowProduct(2) ? "date" : "text"}
                value={startDates[2]}
                onChange={(e) => handleStartChange(2, e.target.value)}
              />
            </div>
            <div className="field field-start4">
              <input
                className="field-input"
                type={hasRowProduct(3) ? "date" : "text"}
                value={startDates[3]}
                onChange={(e) => handleStartChange(3, e.target.value)}
              />
            </div>
            <div className="field field-start5">
              <input
                className="field-input"
                type={hasRowProduct(4) ? "date" : "text"}
                value={startDates[4]}
                onChange={(e) => handleStartChange(4, e.target.value)}
              />
            </div>
            <div className="field field-start6">
              <input
                className="field-input"
                type={hasRowProduct(5) ? "date" : "text"}
                value={startDates[5]}
                onChange={(e) => handleStartChange(5, e.target.value)}
              />
            </div>

            {/* 송출 종료 (자동 계산 + 수정 가능, 행별 상품명 기준) */}
            <div className="field field-end1">
              <input
                className="field-input"
                type={hasRowProduct(0) ? "date" : "text"}
                value={endDates[0]}
                onChange={(e) => handleEndChange(0, e.target.value)}
              />
            </div>
            <div className="field field-end2">
              <input
                className="field-input"
                type={hasRowProduct(1) ? "date" : "text"}
                value={endDates[1]}
                onChange={(e) => handleEndChange(1, e.target.value)}
              />
            </div>
            <div className="field field-end3">
              <input
                className="field-input"
                type={hasRowProduct(2) ? "date" : "text"}
                value={endDates[2]}
                onChange={(e) => handleEndChange(2, e.target.value)}
              />
            </div>
            <div className="field field-end4">
              <input
                className="field-input"
                type={hasRowProduct(3) ? "date" : "text"}
                value={endDates[3]}
                onChange={(e) => handleEndChange(3, e.target.value)}
              />
            </div>
            <div className="field field-end5">
              <input
                className="field-input"
                type={hasRowProduct(4) ? "date" : "text"}
                value={endDates[4]}
                onChange={(e) => handleEndChange(4, e.target.value)}
              />
            </div>
            <div className="field field-end6">
              <input
                className="field-input"
                type={hasRowProduct(5) ? "date" : "text"}
                value={endDates[5]}
                onChange={(e) => handleEndChange(5, e.target.value)}
              />
            </div>

            {/* 계약 단지명 (상품별 단지 리스트) – 자동입력 + 수정 가능 */}
            <div className="field field-apt1">
              <textarea
                className="field-textarea"
                value={aptLines[0]}
                onChange={(e) => handleAptChange(0, e.target.value)}
                style={{ fontSize: aptFontSizes[0] }}
              />
            </div>
            <div className="field field-apt2">
              <textarea
                className="field-textarea"
                value={aptLines[1]}
                onChange={(e) => handleAptChange(1, e.target.value)}
                style={{ fontSize: aptFontSizes[1] }}
              />
            </div>
            <div className="field field-apt3">
              <textarea
                className="field-textarea"
                value={aptLines[2]}
                onChange={(e) => handleAptChange(2, e.target.value)}
                style={{ fontSize: aptFontSizes[2] }}
              />
            </div>
            <div className="field field-apt4">
              <textarea
                className="field-textarea"
                value={aptLines[3]}
                onChange={(e) => handleAptChange(3, e.target.value)}
                style={{ fontSize: aptFontSizes[3] }}
              />
            </div>
            <div className="field field-apt5">
              <textarea
                className="field-textarea"
                value={aptLines[4]}
                onChange={(e) => handleAptChange(4, e.target.value)}
                style={{ fontSize: aptFontSizes[4] }}
              />
            </div>
            <div className="field field-apt6">
              <textarea
                className="field-textarea"
                value={aptLines[5]}
                onChange={(e) => handleAptChange(5, e.target.value)}
                style={{ fontSize: aptFontSizes[5] }}
              />
            </div>

            {/* 하단 계약 담당자 / 고객 */}
            <div className="field field-contractManager">
              <input className="field-input" />
            </div>
            <div className="field field-contact2">
              <input className="field-input" />
            </div>
            <div className="field field-contractDate">
              <input className="field-input" type="date" defaultValue={todayISO} />
            </div>
            <div className="field field-contractCustomer">
              <input className="field-input" readOnly value={companyName} />
            </div>

            <div className="field field-cb7 field-checkbox">
              <input type="checkbox" />
            </div>
            <div className="field field-cb8 field-checkbox">
              <input type="checkbox" />
            </div>
          </div>
        </div>

        {/* 아래 텍스트/약관 영역 – 실제 약관 텍스트로 교체 예정 */}
        <div className="contract-bottom" />
      </div>
    </div>
  );
};

export default ContractNewPage;
