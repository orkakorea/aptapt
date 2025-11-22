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

        /* ===== 공통 테이블 ===== */
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

        .contract-input,
        .contract-select {
          width: 100%;
          border: none;
          outline: none;
          background: transparent;
          font: inherit;
          padding: 0;
          box-sizing: border-box;
        }

        .contract-input::placeholder {
          color: #9ca3af;
        }

        .checkbox-inline {
          display: inline-flex;
          align-items: center;
          gap: 2px;
          font-size: 10px;
          white-space: nowrap;
        }

        .checkbox-inline input[type="checkbox"] {
          margin: 0;
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
        {/* 섹션 1 : 상단 배너 */}
        <div className="contract-header-banner">
          <div style={{ width: 120, fontSize: 10 }} />
          <div className="contract-header-title">광 고 계 약 서</div>
          <div className="contract-header-site">WWW.ORKA.CO.KR</div>
        </div>

        {/* 섹션 1 + 2 : 광고주 정보 + 계약 내용 + 결제 정보 (한 테이블 안에) */}
        <table className="contract-table">
          <tbody>
            {/* 광고주 정보 */}
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

            {/* 계약 내용 */}
            <tr>
              <td className="section-label-vertical" rowSpan={5}>
                계 약
                <br />내 용
              </td>
              <th className="label-cell">브 랜 드 명</th>
              <td className="cell-yellow">
                <input className="contract-input" />
              </td>
              <th className="label-cell">매 체 명</th>
              <td>아파트 엘리베이터 내부/외부 모니터광고</td>
            </tr>
            <tr>
              <th className="label-cell">상 품 내 역</th>
              <td className="cell-yellow">
                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <select className="contract-select" defaultValue="">
                    <option value="">초 선택</option>
                    <option value="10">10초</option>
                    <option value="15">15초</option>
                    <option value="20">20초</option>
                    <option value="30">30초</option>
                  </select>
                  <span>초</span>
                </div>
              </td>
              <th className="label-cell">구좌 / 기준금액</th>
              <td className="cell-yellow">
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 4,
                  }}
                >
                  <span>구좌 기준금액</span>
                  <input className="contract-input" defaultValue="0" style={{ textAlign: "right", maxWidth: 80 }} />
                  <span>원</span>
                </div>
              </td>
            </tr>
            <tr>
              <th className="label-cell">수 량</th>
              <td className="cell-yellow">
                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <input className="contract-input" defaultValue="0" style={{ textAlign: "right", maxWidth: 60 }} />
                  <span>대</span>
                </div>
              </td>
              <th className="label-cell">계 약 금 액</th>
              <td className="cell-yellow">
                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <input className="contract-input" defaultValue="0" style={{ textAlign: "right", maxWidth: 100 }} />
                  <span>원</span>
                </div>
              </td>
            </tr>
            <tr>
              <th className="label-cell">광 고 기 간</th>
              <td>송출 개시일로부터</td>
              <th className="label-cell">개월 / 제 작 비</th>
              <td className="cell-yellow">
                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <input className="contract-input" placeholder="0" style={{ textAlign: "right", maxWidth: 40 }} />
                  <span>개월</span>
                  <span style={{ marginLeft: 8 }}>제작비</span>
                  <input className="contract-input" defaultValue="0" style={{ textAlign: "right", maxWidth: 80 }} />
                  <span>원</span>
                </div>
              </td>
            </tr>
            <tr>
              <th className="label-cell">총 계약금액</th>
              <td className="cell-yellow">
                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <input className="contract-input" defaultValue="0" style={{ textAlign: "right", maxWidth: 100 }} />
                  <span>(VAT별도)</span>
                </div>
              </td>
              <th className="label-cell">비 고</th>
              <td className="cell-yellow">
                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <input className="contract-input" defaultValue="0" style={{ textAlign: "right", maxWidth: 100 }} />
                  <span>(VAT포함)</span>
                </div>
              </td>
            </tr>

            {/* 결제 정보 */}
            <tr>
              <td className="section-label-vertical" rowSpan={3}>
                결제
                <br />
                정보
              </td>
              <td colSpan={4}>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
                  <span className="checkbox-inline">
                    <input type="checkbox" /> 무통장입금
                  </span>
                  <span style={{ fontSize: 10 }}>
                    ({" "}
                    <span className="checkbox-inline">
                      <input type="checkbox" /> 일시납
                    </span>{" "}
                    <span className="checkbox-inline">
                      <input type="checkbox" /> 분납:
                    </span>{" "}
                    <input
                      className="contract-input"
                      style={{
                        width: 40,
                        borderBottom: "1px solid #000",
                        display: "inline-block",
                      }}
                    />{" "}
                    회차 )
                  </span>
                  <span style={{ fontSize: 10 }}>
                    계산서발행일자{" "}
                    <input
                      className="contract-input"
                      style={{
                        width: 90,
                        borderBottom: "1px solid #000",
                        display: "inline-block",
                      }}
                    />
                  </span>
                </div>
              </td>
            </tr>
            <tr>
              <td colSpan={4}>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
                  <span className="checkbox-inline">
                    <input type="checkbox" /> 카드
                  </span>
                  <span style={{ fontSize: 10 }}>
                    ({" "}
                    <span className="checkbox-inline">
                      <input type="checkbox" /> 일시납
                    </span>{" "}
                    <span className="checkbox-inline">
                      <input type="checkbox" /> 분납:
                    </span>{" "}
                    <input
                      className="contract-input"
                      style={{
                        width: 40,
                        borderBottom: "1px solid #000",
                        display: "inline-block",
                      }}
                    />{" "}
                    회차 )
                  </span>
                  <span style={{ fontSize: 10 }}>
                    입 금 일 자{" "}
                    <input
                      className="contract-input"
                      style={{
                        width: 90,
                        borderBottom: "1px solid #000",
                        display: "inline-block",
                      }}
                    />
                  </span>
                </div>
              </td>
            </tr>
            <tr>
              <td colSpan={4}>
                계좌번호 : 기업은행 185 – 168695 – 04 – 018&nbsp;&nbsp; 예금주 : 주식회사 오르카 코리아
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ContractNewPage;
