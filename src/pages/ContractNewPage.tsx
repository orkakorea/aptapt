// src/pages/ContractNewPage.tsx
import React from "react";
import { useNavigate } from "react-router-dom";

// 계약서 템플릿 PNG 경로
const TEMPLATE_URL = "/products/orka-contract-top.png";

const ContractNewPage: React.FC = () => {
  const navigate = useNavigate();

  const handlePrint = () => {
    window.print();
  };

  const todayISO = new Date().toISOString().slice(0, 10);

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
    font-family: "Malgun Gothic", "Apple SD Gothic Neo", system-ui, -apple-system,
      BlinkMacSystemFont, "Segoe UI", sans-serif;
    color: #111827;
    font-size: 11px;
    line-height: 1.4;
  }

  /* ====== 위쪽 PNG 영역 ====== */
  .contract-sheet-wrapper {
    width: 100%;
    display: flex;
    justify-content: center;
  }

  .contract-sheet {
    position: relative;
    width: 100%;
    max-width: 820px;
    /* 원본 PNG 1765 x 2600 기준 비율 */
    aspect-ratio: 1765 / 2600;
    background: url("${TEMPLATE_URL}") no-repeat center / contain;
  }

  .field {
    position: absolute;
    border: 1px dashed rgba(239, 68, 68, 0.8); /* 위치 보정용 가이드 */
    background: transparent;
    color: #111827; /* 검은 글씨 */
    font-size: 11px;
    padding: 0 2px;
    box-sizing: border-box;
  }

  .field::placeholder {
    color: rgba(75, 85, 99, 0.8);
  }

  .field-input,
  .field-select,
  .field-textarea {
    width: 100%;
    height: 100%;
    border: none;
    outline: none;
    background: rgba(255, 255, 255, 0.8);
    padding: 0 4px;
    box-sizing: border-box;
    font-size: 11px;
    font-family: inherit;
    color: #111827;
  }

  .field-textarea {
    padding-top: 4px;
    padding-bottom: 4px;
    resize: none;
  }

  .field-input[readonly],
  .field-textarea[readonly] {
    background: rgba(249, 250, 251, 0.9);
  }

  .field-select {
    padding-right: 16px;
  }

  .field-checkbox {
    display: flex;
    align-items: center;
    justify-content: center;
    border: none;
  }

  .field-checkbox input {
    width: 14px;
    height: 14px;
  }

  /* ===== 좌표: 원본 PNG 1765 x 2600 기준 → % 변환 ===== */

  /* 광고주 정보 + 상단 계약 정보 */
  .field-company { left: 21.5297%; top: 9.6154%; width: 28.3286%; height: 1.1538%; }
  .field-ceo { left: 60.6232%; top: 9.6154%; width: 28.3286%; height: 1.1538%; }
  .field-bizno { left: 21.5297%; top: 11.4615%; width: 28.3286%; height: 1.1538%; }
  .field-manager { left: 60.6232%; top: 11.5000%; width: 28.3286%; height: 1.1538%; }
  .field-email { left: 21.5297%; top: 13.3462%; width: 28.3286%; height: 1.1538%; }
  .field-phone1 { left: 60.6232%; top: 13.3077%; width: 28.3286%; height: 1.1538%; }
  .field-biztype { left: 21.5297%; top: 15.1923%; width: 28.3286%; height: 1.1538%; }
  .field-address { left: 21.5297%; top: 17.0385%; width: 28.3286%; height: 1.1538%; }

  .field-brand { left: 21.5297%; top: 19.7308%; width: 67.4221%; height: 1.1538%; }
  .field-productName { left: 21.5297%; top: 21.5769%; width: 67.4221%; height: 1.1538%; }

  .field-drop1 { left: 21.5297%; top: 23.4231%; width: 9.8584%; height: 1.1538%; }
  .field-drop2 { left: 37.9037%; top: 23.4231%; width: 8.0453%; height: 1.1538%; }
  .field-baseAmount { left: 65.6657%; top: 23.4231%; width: 20.5666%; height: 1.1538%; }

  .field-qty { left: 21.5297%; top: 25.2692%; width: 24.4193%; height: 1.1538%; }
  .field-contractAmt1 { left: 65.6657%; top: 25.2692%; width: 20.5666%; height: 1.1538%; }

  .field-period { left: 37.9037%; top: 27.1538%; width: 8.0453%; height: 1.1538%; }
  .field-prodFee { left: 65.6657%; top: 27.1538%; width: 20.5666%; height: 1.1538%; }

  .field-contractAmt2 { left: 21.5297%; top: 29.7692%; width: 24.4193%; height: 1.1538%; }
  .field-finalQuote { left: 65.6657%; top: 29.7692%; width: 20.5666%; height: 1.1538%; }

  /* 결제 정보 체크박스 + 날짜 */
  .field-cb1 { left: 11.8414%; top: 32.5385%; width: 1.6997%; height: 1.1538%; }
  .field-cb2 { left: 21.5297%; top: 32.5000%; width: 1.6997%; height: 1.1538%; }
  .field-cb3 { left: 42.2096%; top: 32.5000%; width: 1.6997%; height: 1.1538%; }
  .field-cb4 { left: 11.8414%; top: 34.3077%; width: 1.6997%; height: 1.1538%; }
  .field-cb5 { left: 21.5297%; top: 34.3077%; width: 1.6997%; height: 1.1538%; }
  .field-cb6 { left: 26.9122%; top: 34.3077%; width: 1.6997%; height: 1.1538%; }

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

  .field-end1 { left: 32.2380%; top: 41.6154%; width: 9.0085%; height: 1.1538%; }
  .field-end2 { left: 32.2380%; top: 45.3077%; width: 9.0085%; height: 1.1538%; }
  .field-end3 { left: 32.2380%; top: 49.0769%; width: 9.0085%; height: 1.1538%; }
  .field-end4 { left: 32.2380%; top: 52.8077%; width: 9.0085%; height: 1.1538%; }
  .field-end5 { left: 32.2380%; top: 56.4231%; width: 9.0085%; height: 1.1538%; }
  .field-end6 { left: 32.2380%; top: 60.1923%; width: 9.0085%; height: 1.1538%; }

  .field-apt1 { left: 44.3626%; top: 40.6538%; width: 50.9915%; height: 3.0769%; }
  .field-apt2 { left: 44.3626%; top: 44.3462%; width: 50.9915%; height: 3.0769%; }
  .field-apt3 { left: 44.3626%; top: 48.1154%; width: 50.9915%; height: 3.0769%; }
  .field-apt4 { left: 44.3626%; top: 51.8462%; width: 50.9915%; height: 3.0769%; }
  .field-apt5 { left: 44.3626%; top: 55.4615%; width: 50.9915%; height: 3.0769%; }
  .field-apt6 { left: 44.3626%; top: 59.2308%; width: 50.9915%; height: 3.0769%; }

  /* 하단 계약 담당자/고객 영역 */
  .field-contractManager { left: 85.8357%; top: 82.3462%; width: 9.6317%; height: 1.1538%; }
  .field-contact2 { left: 85.8357%; top: 83.8077%; width: 9.6317%; height: 1.1538%; }
  .field-contractDate { left: 74.1643%; top: 85.6923%; width: 16.9972%; height: 1.1538%; }
  .field-contractCustomer { left: 71.7847%; top: 94.2308%; width: 17.5637%; height: 1.9231%; }
  .field-cb7 { left: 43.3994%; top: 87.7692%; width: 1.6997%; height: 1.1538%; }
  .field-cb8 { left: 43.3994%; top: 95.1538%; width: 1.6997%; height: 1.1538%; }

  /* 이하 @media print 등 기존 코드는 그대로 유지 */
`}</style>

      <div className="contract-toolbar">
        <button type="button" onClick={() => navigate(-1)}>
          ← 이전 화면으로
        </button>
        <button type="button" className="primary" onClick={handlePrint}>
          계약서 PDF로 저장
        </button>
      </div>

      <div className="contract-paper">
        <div className="contract-sheet-wrapper">
          <div className="contract-sheet">
            {/* 광고주 정보 */}
            <div className="field field-company">
              <input className="field-input" placeholder="상호명" />
            </div>
            <div className="field field-ceo">
              <input className="field-input" placeholder="대표자" />
            </div>
            <div className="field field-bizno">
              <input className="field-input" placeholder="사업자등록번호" />
            </div>
            <div className="field field-manager">
              <input className="field-input" placeholder="담당자" />
            </div>
            <div className="field field-email">
              <input className="field-input" placeholder="계산서용 이메일" />
            </div>
            <div className="field field-phone1">
              <input className="field-input" placeholder="연락처" />
            </div>
            <div className="field field-biztype">
              <input className="field-input" placeholder="업태 / 종목" />
            </div>
            <div className="field field-address">
              <input className="field-input" placeholder="사업장 주소" />
            </div>

            {/* 계약 내용 */}
            <div className="field field-brand">
              <input className="field-input" placeholder="브랜드명" />
            </div>
            <div className="field field-productName">
              <input className="field-input" placeholder="상품명 (견적서에서 자동)" readOnly />
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
                <option value="">구좌</option>
                <option value="1">1구좌</option>
                <option value="2">2구좌</option>
              </select>
            </div>

            <div className="field field-baseAmount">
              <input className="field-input" placeholder="기준금액 (자동)" readOnly />
            </div>

            <div className="field field-qty">
              <input className="field-input" placeholder="수량 (자동)" readOnly />
            </div>
            <div className="field field-contractAmt1">
              <input className="field-input" placeholder="계약금액 (자동)" readOnly />
            </div>

            <div className="field field-period">
              <input className="field-input" placeholder="개월 수" />
            </div>
            <div className="field field-prodFee">
              <input className="field-input" placeholder="제작비" />
            </div>

            <div className="field field-contractAmt2">
              <input className="field-input" placeholder="총 계약금액 (자동)" readOnly />
            </div>
            <div className="field field-finalQuote">
              <input className="field-input" placeholder="최종 견적 (자동)" readOnly />
            </div>

            {/* 결제 정보 체크박스 */}
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

            <div className="field field-billDate">
              <input className="field-input" type="date" />
            </div>
            <div className="field field-paidDate">
              <input className="field-input" type="date" />
            </div>

            {/* 비고 – 상품/기간/단지명 */}
            <div className="field field-item1">
              <input className="field-input" placeholder="상품명 (자동)" readOnly />
            </div>
            <div className="field field-item2">
              <input className="field-input" placeholder="상품명 (자동)" readOnly />
            </div>
            <div className="field field-item3">
              <input className="field-input" placeholder="상품명 (자동)" readOnly />
            </div>
            <div className="field field-item4">
              <input className="field-input" placeholder="상품명 (자동)" readOnly />
            </div>
            <div className="field field-item5">
              <input className="field-input" placeholder="상품명 (자동)" readOnly />
            </div>
            <div className="field field-item6">
              <input className="field-input" placeholder="상품명 (자동)" readOnly />
            </div>

            {/* 송출 개시 (달력), 종료(자동) */}
            <div className="field field-start1">
              <input className="field-input" type="date" />
            </div>
            <div className="field field-start2">
              <input className="field-input" type="date" />
            </div>
            <div className="field field-start3">
              <input className="field-input" type="date" />
            </div>
            <div className="field field-start4">
              <input className="field-input" type="date" />
            </div>
            <div className="field field-start5">
              <input className="field-input" type="date" />
            </div>
            <div className="field field-start6">
              <input className="field-input" type="date" />
            </div>

            <div className="field field-end1">
              <input className="field-input" placeholder="자동계산" readOnly />
            </div>
            <div className="field field-end2">
              <input className="field-input" placeholder="자동계산" readOnly />
            </div>
            <div className="field field-end3">
              <input className="field-input" placeholder="자동계산" readOnly />
            </div>
            <div className="field field-end4">
              <input className="field-input" placeholder="자동계산" readOnly />
            </div>
            <div className="field field-end5">
              <input className="field-input" placeholder="자동계산" readOnly />
            </div>
            <div className="field field-end6">
              <input className="field-input" placeholder="자동계산" readOnly />
            </div>

            {/* 계약 단지명 */}
            <div className="field field-apt1">
              <textarea className="field-textarea" placeholder="계약 단지명 (자동)" readOnly />
            </div>
            <div className="field field-apt2">
              <textarea className="field-textarea" placeholder="계약 단지명 (자동)" readOnly />
            </div>
            <div className="field field-apt3">
              <textarea className="field-textarea" placeholder="계약 단지명 (자동)" readOnly />
            </div>
            <div className="field field-apt4">
              <textarea className="field-textarea" placeholder="계약 단지명 (자동)" readOnly />
            </div>
            <div className="field field-apt5">
              <textarea className="field-textarea" placeholder="계약 단지명 (자동)" readOnly />
            </div>
            <div className="field field-apt6">
              <textarea className="field-textarea" placeholder="계약 단지명 (자동)" readOnly />
            </div>

            {/* 하단 계약 담당자 / 고객 */}
            <div className="field field-contractManager">
              <input className="field-input" placeholder="계약담당자" />
            </div>
            <div className="field field-contact2">
              <input className="field-input" placeholder="연락처" />
            </div>
            <div className="field field-contractDate">
              <input className="field-input" type="date" defaultValue={todayISO} />
            </div>
            <div className="field field-contractCustomer">
              <input className="field-input" placeholder="계약 고객 (상호명 자동)" readOnly />
            </div>

            <div className="field field-cb7 field-checkbox">
              <input type="checkbox" />
            </div>
            <div className="field field-cb8 field-checkbox">
              <input type="checkbox" />
            </div>
          </div>
        </div>

        {/* 아래 텍스트/약관 영역 – 나중에 실제 약관 텍스트로 교체 */}
        <div className="contract-bottom">
          <div className="contract-bottom-title">이용약관 · 개인정보 동의 · 서명 영역</div>
          <div>
            이 영역에는 약관 전문, 개인정보 수집·이용 동의, 제3자 제공 동의, 계약담당자/계약고객 서명 안내 문구 등을
            텍스트 또는 표 형식으로 배치하면 돼. (다음 단계에서 실제 문구를 채워 넣자)
          </div>
        </div>
      </div>
    </div>
  );
};

export default ContractNewPage;
