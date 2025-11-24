// src/pages/ContractNewPage.tsx
import React from "react";
import { useNavigate } from "react-router-dom";

// ✅ 실제 사용 중인 PNG 경로로 변경
const TEMPLATE_URL = "/products/orka-contract-top.png";

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
          /* PNG 비율(1626x2048) */
          aspect-ratio: 1626 / 2048;
          background: url("${TEMPLATE_URL}") no-repeat center / contain;
        }

        .field {
          position: absolute;
          border: 1px dashed rgba(239, 68, 68, 0.8); /* 위치 잡기용 가이드 */
          background: transparent;
          color: #111827; /* ✅ 검은 글씨 */
          font-size: 11px;
          padding: 0 2px;
          box-sizing: border-box;
        }

        .field::placeholder {
          color: rgba(75, 85, 99, 0.8);
        }

        /* ===================================================================
         * 광고주 정보 필드들 (좌표는 모두 % 단위)
         *  - PNG 크기: 1626 x 2048
         *  - Figma(상호명): x=-941, y=-1031, w=488, h=37 (전역 기준)
         *  - 폭/높이는: w/1626≈30.0%, h/2048≈1.8% 그대로 반영
         *  - left/top 은 눈으로 맞춰보고 미세조정 (+ 네가 다시 알려줄 값으로 교체)
         * =================================================================== */

        .field-company {
          /* 상호명 */
          /* Figma: w=488px, h=37px → width≈30.0%, height≈1.8% */
          left: 22%;     /* ← 여기랑 */
          top: 15%;      /* ← 여기를 네가 측정한 %로 갈아끼우면 됨 */
          width: 30.0%;
          height: 1.8%;
        }

        .field-ceo {
          /* 대표자 – 아직 대략값, 나중에 좌표 확정 후 조정 */
          left: 64%;
          top: 15%;
          width: 20%;
          height: 1.8%;
        }

        .field-bizno {
          /* 사업자등록번호 */
          left: 22%;
          top: 19%;
          width: 30%;
          height: 1.8%;
        }

        .field-manager {
          /* 담당자 */
          left: 64%;
          top: 19%;
          width: 20%;
          height: 1.8%;
        }

        .field-email {
          /* 계산서용이메일 */
          left: 22%;
          top: 23%;
          width: 30%;
          height: 1.8%;
        }

        .field-phone {
          /* 연락처 */
          left: 64%;
          top: 23%;
          width: 20%;
          height: 1.8%;
        }

        .field-biztype {
          /* 업태/종목 */
          left: 22%;
          top: 27%;
          width: 62%;
          height: 1.8%;
        }

        .field-address {
          /* 사업장주소 */
          left: 22%;
          top: 31%;
          width: 62%;
          height: 1.8%;
        }

        /* --- 계약 내용 일부 예시 (아직 러프값, 나중에 전부 조정) --- */
        .field-brand {
          /* 브랜드명 */
          left: 22%;
          top: 36%;
          width: 30%;
          height: 1.8%;
        }

        .field-product-desc {
          /* 상품 내역 (초/구좌) */
          left: 22%;
          top: 40%;
          width: 30%;
          height: 1.8%;
        }

        .field-contract-amount {
          /* 계약금액 (숫자) */
          left: 64%;
          top: 44%;
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

            {/* === 계약 내용 일부 예시 (추후 전체 확장) === */}
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
