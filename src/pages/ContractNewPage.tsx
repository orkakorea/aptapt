// src/pages/ContractNewPage.tsx
import React from "react";
import { useNavigate } from "react-router-dom";

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
          max-width: 840px;
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
          max-width: 840px;
          margin: 0 auto 32px;
          background: #ffffff;
          padding: 0;
          box-shadow: 0 8px 18px rgba(15, 23, 42, 0.16);
          box-sizing: border-box;
          font-family: "Malgun Gothic", "Apple SD Gothic Neo", system-ui, -apple-system,
            BlinkMacSystemFont, "Segoe UI", sans-serif;
          color: #111827;
          font-size: 11px;
          line-height: 1.4;
        }

        /* ===== 상단 검정 배너 ===== */
        .contract-header-banner {
          background: #000000;
          color: #ffffff;
          padding: 10px 18px;
          display: flex;
          align-items: center;
        }

        .contract-header-title {
          flex: 1;
          text-align: center;
          font-size: 22px;
          font-weight: 700;
          letter-spacing: 4px;
        }

        .contract-header-site {
          font-size: 11px;
          min-width: 130px;
          text-align: right;
        }

        /* ===== 광고주 정보 테이블 ===== */
        .contract-table {
          width: 100%;
          border-collapse: collapse;
          table-layout: fixed;
        }

        .contract-table th,
        .contract-table td {
          border: 1px solid #000000;
          padding: 3px 6px;
          word-break: break-all;
          vertical-align: middle;
        }

        .section-label-vertical {
          width: 46px;
          background: #000000;
          color: #ffffff;
          font-weight: 700;
          text-align: center;
          font-size: 11px;
          line-height: 1.3;
        }

        .label-cell {
          width: 90px;
          background: #f3f4f6;
          font-weight: 600;
        }

        .cell-yellow {
          background: #fff8b3;
        }

        .contract-input {
          width: 100%;
          border: none;
          outline: none;
          background: transparent;
          font: inherit;
          padding: 0;
          box-sizing: border-box;
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

          .no-print {
            display: none !important;
          }
        }
      `}</style>

      {/* 상단 툴바 (인쇄 시 숨김) */}
      <div className="contract-toolbar no-print">
        <button type="button" onClick={() => navigate(-1)}>
          ← 이전 화면으로
        </button>
        <button type="button" className="primary" onClick={handlePrint}>
          계약서 PDF로 저장
        </button>
      </div>

      {/* A4 용지 영역 */}
      <div className="contract-paper">
        {/* 섹션 1 : 상단 배너 + 광고주 정보 */}
        <div className="contract-header-banner">
          <div style={{ width: 120, fontSize: 10 }} />
          <div className="contract-header-title">광 고 계 약 서</div>
          <div className="contract-header-site">WWW.ORKA.CO.KR</div>
        </div>

        <table className="contract-table">
          <tbody>
            <tr>
              <td className="section-label-vertical" rowSpan={5}>
                광고주
                <br />
                정보
              </td>
              <th className="label-cell">상 호 명</th>
              <td className="cell-yellow">
                <input className="contract-input" />
              </td>
              <th className="label-cell">대표 자</th>
              <td className="cell-yellow">
                <input className="contract-input" />
              </td>
            </tr>
            <tr>
              <th className="label-cell">사업자등록번호</th>
              <td className="cell-yellow">
                <input className="contract-input" />
              </td>
              <th className="label-cell">담 당 자</th>
              <td className="cell-yellow">
                <input className="contract-input" />
              </td>
            </tr>
            <tr>
              <th className="label-cell">계산서용이메일</th>
              <td className="cell-yellow">
                <input className="contract-input" />
              </td>
              <th className="label-cell">연 락 처</th>
              <td className="cell-yellow">
                <input className="contract-input" />
              </td>
            </tr>
            <tr>
              <th className="label-cell">업 태 / 종 목</th>
              <td className="cell-yellow" colSpan={3}>
                <input className="contract-input" />
              </td>
            </tr>
            <tr>
              <th className="label-cell">사 업 장 주 소</th>
              <td className="cell-yellow" colSpan={3}>
                <input className="contract-input" />
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ContractNewPage;
