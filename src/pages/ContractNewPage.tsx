// src/pages/ContractNewPage.tsx
import React from "react";
import { useNavigate } from "react-router-dom";

// ✅ 실제 사용 중인 PNG 경로
const TEMPLATE_URL = "/products/orka-contract-top.png";

// Figma 기준 프레임 사이즈 (좌표 계산용 설명용 주석)
// width: 1702px, height: 2508px → PNG로 1390 x 2048으로 스케일링

const ContractNewPage: React.FC = () => {
  const navigate = useNavigate();

  const handlePrint = () => {
    window.print();
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
          /* PNG 비율: 1390 x 2048 */
          aspect-ratio: 1390 / 2048;
          background: url("${TEMPLATE_URL}") no-repeat center / contain;
        }

        .field {
          position: absolute;
          border: 1px dashed rgba(239, 68, 68, 0.8); /* 위치 잡기용 가이드 */
          background: transparent;
          color: #111827; /* 검은 글씨 */
          font-size: 11px;
          padding: 0 2px;
          box-sizing: border-box;
        }

        .field::placeholder {
          color: rgba(75, 85, 99, 0.8);
        }

        /* ===================================================================
         * 광고주 정보 (Figma 좌표 → % 변환)
         *  - Figma frame: 1702 x 2508
         *  - left%  = x / 1702 * 100
         *  - top%   = y / 2508 * 100
         *  - width% = w / 1702 * 100
         *  - height%= h / 2508 * 100
         * =================================================================== */

        /* 상호명: x=355, y=245, w=511, h=36 */
        .field-company {
          left: 20.86%;
          top: 9.77%;
          width: 30.02%;
          height: 1.44%;
        }

        /* 대표자: x=1040, y=248, w=662, h=36 */
        .field-ceo {
          left: 61.10%;
          top: 9.89%;
          width: 38.90%;
          height: 1.44%;
        }

        /* 사업자등록번호: x=355, y=296, w=511, h=36 */
        .field-bizno {
          left: 20.86%;
          top: 11.80%;
          width: 30.02%;
          height: 1.44%;
        }

        /* 담당자: x=1040, y=296, w=662, h=36 */
        .field-manager {
          left: 61.10%;
          top: 11.80%;
          width: 38.90%;
          height: 1.44%;
        }

        /* 계산서용이메일: x=355, y=344, w=511, h=36 */
        .field-email {
          left: 20.86%;
          top: 13.72%;
          width: 30.02%;
          height: 1.44%;
        }

        /* 연락처: x=1040, y=344, w=662, h=36 */
        .field-phone {
          left: 61.10%;
          top: 13.72%;
          width: 38.90%;
          height: 1.44%;
        }

        /* 업태/종목: x=355, y=392, w=1347, h=36 */
        .field-biztype {
          left: 20.86%;
          top: 15.63%;
          width: 79.14%;
          height: 1.44%;
        }

        /* 사업장주소: x=355, y=440, w=1347, h=36 */
        .field-address {
          left: 20.86%;
          top: 17.54%;
          width: 79.14%;
          height: 1.44%;
        }

        /* ====== 계약 내용 이하 필드들은 아직 러프값 (추후 좌표 적용) ====== */
        .field-brand {
          left: 22%;
          top: 22%;
          width: 30%;
          height: 1.8%;
        }

        .field-product-desc {
          left: 22%;
          top: 26%;
          width: 30%;
          height: 1.8%;
        }

        .field-contract-amount {
          left: 64%;
          top: 30%;
          width: 20%;
          height: 1.8%;
        }

        /* ====== 아래쪽 텍스트(이용약관 등) 영역 컨테이너 ====== */
        .contract-bottom {
          margin-top: 24px;
          font-size: 11px;
          line-height: 1.6;
        }

        .contract-bottom-title {
          font-weight: 700;
          margin-bottom: 4px;
        }

        @media print {
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
            padding: 10mm 12mm 12mm;
          }
          .contract-toolbar {
            display: none !important;
          }
          /* 인쇄 시에는 가이드 보더 제거 */
          .field {
            border: none;
          }
        }
      `}</style>

      {/* 상단 툴바 (인쇄 시 숨김) */}
      <div className="contract-toolbar">
        <button type="button" onClick={() => navigate(-1)}>
          ← 이전 화면으로
        </button>
        <button type="button" className="primary" onClick={handlePrint}>
          계약서 PDF로 저장
        </button>
      </div>

      {/* A4 용지 영역 */}
      <div className="contract-paper">
        {/* ① PNG + 입력필드 영역 */}
        <div className="contract-sheet-wrapper">
          <div className="contract-sheet">
            {/* === 광고주 정보 === */}
            <input className="field field-company" placeholder="상호명" />
            <input className="field field-ceo" placeholder="대표자" />
            <input className="field field-bizno" placeholder="사업자등록번호" />
            <input className="field field-manager" placeholder="담당자" />
            <input className="field field-email" placeholder="계산서용이메일" />
            <input className="field field-phone" placeholder="연락처" />
            <input className="field field-biztype" placeholder="업태 / 종목" />
            <input className="field field-address" placeholder="사업장주소" />

            {/* === 계약 내용 일부 예시 (추후 좌표 정교화 예정) === */}
            <input className="field field-brand" placeholder="브랜드명" />
            <input className="field field-product-desc" placeholder="상품 내역 / 초 / 구좌" />
            <input className="field field-contract-amount" placeholder="계약금액(원)" />
          </div>
        </div>

        {/* ② 이용약관/개인정보/서명 텍스트 영역 (지금은 뼈대만) */}
        <div className="contract-bottom">
          <div className="contract-bottom-title">이용약관 · 개인정보 동의 · 서명 영역</div>
          <div>
            이 아래에는 약관/개인정보 동의 문구와 계약담당자·계약일자·계약 고객 서명 영역을 텍스트/표 형태로 추가해
            나가면 돼. (차후 단계에서 하나씩 채우자)
          </div>
        </div>
      </div>
    </div>
  );
};

export default ContractNewPage;
