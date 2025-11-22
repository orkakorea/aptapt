// src/pages/ContractNewPage.tsx
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";

type RemarkItem = {
  id: number;
  productName: string;
  startDate: string;
  months: string;
  endDate: string;
  aptNames: string;
};

/** YYYY-MM-DD 형식의 오늘 날짜 */
const todayString = (() => {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
})();

/** 개시일 + 개월 수 → 종료일(개월 수 개월 후 - 1일) 계산 */
function calcEndDate(startDate: string, monthsStr: string): string {
  if (!startDate || !monthsStr) return "";
  const months = parseInt(monthsStr, 10);
  if (!Number.isFinite(months) || months <= 0) return "";

  const [y, m, d] = startDate.split("-").map((v) => parseInt(v, 10));
  if (!y || !m || !d) return "";

  const dt = new Date(y, m - 1, d);
  dt.setMonth(dt.getMonth() + months);
  dt.setDate(dt.getDate() - 1);

  const yyyy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

const ContractNewPage: React.FC = () => {
  const navigate = useNavigate();

  const [remarkItems, setRemarkItems] = useState<RemarkItem[]>([
    { id: 1, productName: "", startDate: "", months: "", endDate: "", aptNames: "" },
    { id: 2, productName: "", startDate: "", months: "", endDate: "", aptNames: "" },
    { id: 3, productName: "", startDate: "", months: "", endDate: "", aptNames: "" },
  ]);

  const handleRemarkChange = (
    id: number,
    field: keyof RemarkItem,
    value: string
  ) => {
    setRemarkItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const updated: RemarkItem = { ...item, [field]: value };
        if (field === "startDate" || field === "months") {
          updated.endDate = calcEndDate(updated.startDate, updated.months);
        }
        return updated;
      })
    );
  };

  const handleAddRemarkRow = () => {
    setRemarkItems((prev) => {
      const last = prev[prev.length - 1];
      const nextId = (last?.id ?? 0) + 1;
      return [
        ...prev,
        {
          id: nextId,
          productName: last?.productName ?? "",
          startDate: last?.startDate ?? "",
          months: last?.months ?? "",
          endDate: last?.endDate ?? "",
          aptNames: "",
        },
      ];
    });
  };

  const handleRemoveRemarkRow = (id: number) => {
    setRemarkItems((prev) => {
      if (prev.length <= 1) return prev;
      return prev.filter((item) => item.id !== id);
    });
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="contract-page-wrapper">
      {/* 인쇄용/레이아웃용 스타일 */}
      <style>{`
        .contract-page-wrapper {
          padding: 16px;
          background: #f3f4f6;
        }

        .contract-toolbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          max-width: 900px;
          margin: 0 auto 12px;
          gap: 8px;
        }

        .contract-toolbar-left {
          display: flex;
          align-items: center;
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

        .contract-page {
          max-width: 900px;
          margin: 0 auto 32px;
          background: #ffffff;
          padding: 16px 24px 24px;
          box-shadow: 0 8px 16px rgba(15, 23, 42, 0.12);
          box-sizing: border-box;
          font-family: "Malgun Gothic", "Apple SD Gothic Neo", system-ui, -apple-system,
            BlinkMacSystemFont, "Segoe UI", sans-serif;
          color: #000000;
        }

        .contract-title-row {
          display: flex;
          align-items: center;
          margin-bottom: 8px;
        }

        .contract-title {
          flex: 1;
          font-size: 22px;
          font-weight: 700;
          text-align: center;
          letter-spacing: 4px;
        }

        .contract-site {
          font-size: 11px;
          font-weight: 500;
          text-align: right;
          min-width: 110px;
        }

        .contract-table {
          width: 100%;
          border-collapse: collapse;
          table-layout: fixed;
          font-size: 11px;
        }

        .contract-table th,
        .contract-table td {
          border: 1px solid #000;
          padding: 3px 6px;
          vertical-align: middle;
          word-break: break-all;
        }

        .contract-section-label {
          width: 40px;
          background: #000000;
          color: #ffffff;
          font-weight: 700;
          text-align: center;
        }

        .contract-label-cell {
          width: 80px;
          background: #f3f4f6;
          font-weight: 600;
        }

        .contract-cell-yellow {
          background: #fff9c4;
        }

        .contract-cell-red {
          background: #ffcdd2;
        }

        .contract-input,
        .contract-select,
        .contract-textarea {
          width: 100%;
          border: none;
          outline: none;
          background: transparent;
          font: inherit;
          padding: 0;
          box-sizing: border-box;
        }

        .contract-textarea {
          resize: vertical;
          min-height: 40px;
        }

        .contract-checkbox-group {
          display: inline-flex;
          align-items: center;
          margin-right: 8px;
          white-space: nowrap;
          font-size: 10px;
        }

        .contract-checkbox-group input[type="checkbox"] {
          margin-right: 2px;
        }

        .contract-remark-controls {
          margin-top: 4px;
          text-align: right;
          font-size: 11px;
        }

        .contract-remark-controls button {
          padding: 3px 8px;
          font-size: 11px;
          border-radius: 4px;
          border: 1px solid #d1d5db;
          background: #ffffff;
          cursor: pointer;
          margin-left: 4px;
        }

        .contract-summary-row {
          font-weight: 600;
        }

        .contract-terms-title-cell {
          width: 40px;
          background: #000000;
          color: #ffffff;
          font-weight: 700;
          text-align: center;
        }

        .contract-terms-body {
          font-size: 10px;
          line-height: 1.5;
        }

        .contract-terms-columns {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
        }

        .contract-terms-section-title {
          font-weight: 700;
          margin-bottom: 2px;
        }

        .contract-privacy-row {
          font-size: 10px;
        }

        .contract-signature-row {
          font-size: 11px;
          margin-top: 8px;
        }

        .contract-signature-row-inner {
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          gap: 16px;
          margin-top: 8px;
        }

        .contract-signature-block {
          flex: 1;
        }

        .contract-signature-label {
          font-weight: 600;
          margin-bottom: 4px;
        }

        .contract-signature-line {
          border-bottom: 1px solid #000;
          padding-bottom: 2px;
          min-height: 20px;
        }

        .contract-signature-small {
          font-size: 10px;
          margin-top: 4px;
        }

        .contract-inline-date {
          display: inline-block;
          min-width: 120px;
        }

        @media print {
          body {
            margin: 0;
          }

          .contract-page-wrapper {
            padding: 0;
            background: #ffffff;
          }

          .contract-page {
            box-shadow: none;
            margin: 0 auto;
            padding: 8mm 10mm 10mm;
          }

          .no-print {
            display: none !important;
          }
        }
      `}</style>

      {/* 상단 툴바 (인쇄 시 숨김) */}
      <div className="contract-toolbar no-print">
        <div className="contract-toolbar-left">
          <button type="button" onClick={() => navigate(-1)}>
            ← 이전 화면으로
          </button>
        </div>
        <div>
          <button type="button" className="primary" onClick={handlePrint}>
            계약서 PDF로 저장
          </button>
        </div>
      </div>

      {/* 계약서 본문 (인쇄 영역) */}
      <div className="contract-page">
        {/* 헤더 */}
        <div className="contract-title-row">
          <div style={{ width: 110, fontSize: 11 }} />
          <div className="contract-title">광 고 계 약 서</div>
          <div className="contract-site">WWW.ORKA.CO.KR</div>
        </div>

        {/* 광고주 정보 + 계약 내용 + 결제 정보 */}
        <table className="contract-table">
          <tbody>
            {/* 광고주 정보 */}
            <tr>
              <td className="contract-section-label" rowSpan={4}>
                광고주
                <br />
                정보
              </td>
              <th className="contract-label-cell">상 호 명</th>
              <td className="contract-cell-yellow">
                <input className="contract-input" />
              </td>
              <th className="contract-label-cell">대표 자</th>
              <td className="contract-cell-yellow">
                <input className="contract-input" />
              </td>
            </tr>
            <tr>
              <th className="contract-label-cell">사업자등록번호</th>
              <td className="contract-cell-yellow">
                <input className="contract-input" />
              </td>
              <th className="contract-label-cell">담 당 자</th>
              <td className="contract-cell-yellow">
                <input className="contract-input" />
              </td>
            </tr>
            <tr>
              <th className="contract-label-cell">계산사용이메일</th>
              <td className="contract-cell-yellow">
                <input className="contract-input" />
              </td>
              <th className="contract-label-cell">연 락 처</th>
              <td className="contract-cell-yellow">
                <input className="contract-input" />
              </td>
            </tr>
            <tr>
              <th className="contract-label-cell">업 태 / 종 목</th>
              <td className="contract-cell-yellow">
                <input className="contract-input" />
              </td>
              <th className="contract-label-cell">사 업 장 주 소</th>
              <td className="contract-cell-yellow">
                <input className="contract-input" />
              </td>
            </tr>

            {/* 계약 내용 */}
            <tr>
              <td className="contract-section-label" rowSpan={5}>
                계약
                <br />
                내용
              </td>
              <th className="contract-label-cell">브 랜 드 명</th>
              <td className="contract-cell-yellow">
                <input className="contract-input" />
              </td>
              <th className="contract-label-cell">매 체 명</th>
              <td>
                아파트 엘리베이터 내/외부 모니터광고
              </td>
            </tr>
            <tr>
              <th className="contract-label-cell">상 품 내 역</th>
              <td className="contract-cell-red">
                <select className="contract-select">
                  <option value="">초 선택</option>
                  <option value="10">10초</option>
                  <option value="15">15초</option>
                  <option value="20">20초</option>
                  <option value="30">30초</option>
                </select>
              </td>
              <th className="contract-label-cell">구좌 / 기준금액</th>
              <td className="contract-cell-red">
                <input className="contract-input" />
              </td>
            </tr>
            <tr>
              <th className="contract-label-cell">수 량</th>
              <td>
                <input
                  className="contract-input"
                  placeholder="예) 10대"
                />
              </td>
              <th className="contract-label-cell">계 약 금 액</th>
              <td>
                <input className="contract-input" placeholder="원" />
              </td>
            </tr>
            <tr>
              <th className="contract-label-cell">송 출 기 간</th>
              <td className="contract-cell-yellow">
                <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                  <input
                    className="contract-input"
                    placeholder="개시일 (예: 2025-01-01)"
                  />
                  <span>부터</span>
                </div>
              </td>
              <th className="contract-label-cell">개월 / 제작비</th>
              <td className="contract-cell-yellow">
                <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                  <input
                    className="contract-input"
                    placeholder="개월 수"
                    style={{ maxWidth: 60 }}
                  />
                  <span>개월 /</span>
                  <input
                    className="contract-input"
                    placeholder="제작비 (원)"
                  />
                </div>
              </td>
            </tr>
            <tr>
              <th className="contract-label-cell">총 계약금액</th>
              <td>
                <input
                  className="contract-input"
                  placeholder="(VAT별도)"
                />
              </td>
              <th className="contract-label-cell">비 고</th>
              <td>
                <input
                  className="contract-input"
                  placeholder="(VAT포함)"
                />
              </td>
            </tr>

            {/* 결제 정보 */}
            <tr>
              <td className="contract-section-label" rowSpan={2}>
                결제
                <br />
                정보
              </td>
              <td colSpan={4}>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
                  <span className="contract-checkbox-group">
                    <input type="checkbox" /> 무통장입금
                  </span>
                  <span className="contract-checkbox-group">
                    (□ 일시납 □ 분납 :{" "}
                    <input
                      className="contract-input"
                      style={{ width: 40, borderBottom: "1px solid #000" }}
                    />{" "}
                    회차)
                  </span>
                  <span className="contract-checkbox-group">
                    계산서발행일자:{" "}
                    <input
                      className="contract-input"
                      style={{ width: 90, borderBottom: "1px solid #000" }}
                    />
                  </span>
                </div>
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 12,
                    marginTop: 4,
                  }}
                >
                  <span className="contract-checkbox-group">
                    <input type="checkbox" /> 카드
                  </span>
                  <span className="contract-checkbox-group">
                    (□ 일시납 □ 분납 :{" "}
                    <input
                      className="contract-input"
                      style={{ width: 40, borderBottom: "1px solid #000" }}
                    />{" "}
                    회차)
                  </span>
                  <span className="contract-checkbox-group">
                    입금 일자:{" "}
                    <input
                      className="contract-input"
                      style={{ width: 90, borderBottom: "1px solid #000" }}
                    />
                  </span>
                </div>
              </td>
            </tr>
            <tr>
              <td colSpan={4}>
                계좌번호 : 기업은행 185 – 168695 – 04 – 018 &nbsp;&nbsp;
                예금주 : 주식회사 오르카 코리아
              </td>
            </tr>
          </tbody>
        </table>

        {/* 비고 영역 */}
        <table className="contract-table" style={{ marginTop: 12 }}>
          <thead>
            <tr>
              <td rowSpan={remarkItems.length + 2} className="contract-section-label">
                비
                <br />
                고
              </td>
              <th style={{ width: "22%" }}>상 품 명</th>
              <th style={{ width: "15%" }}>송출 개시</th>
              <th style={{ width: "15%" }}>송출 종료</th>
              <th>계 약 단 지 명</th>
              <th style={{ width: "8%" }} className="no-print">
                관리
              </th>
            </tr>
          </thead>
          <tbody>
            {remarkItems.map((item) => (
              <tr key={item.id}>
                <td className="contract-cell-yellow">
                  <input
                    className="contract-input"
                    value={item.productName}
                    onChange={(e) =>
                      handleRemarkChange(item.id, "productName", e.target.value)
                    }
                  />
                </td>
                <td className="contract-cell-yellow">
                  <input
                    type="date"
                    className="contract-input"
                    value={item.startDate}
                    onChange={(e) =>
                      handleRemarkChange(item.id, "startDate", e.target.value)
                    }
                  />
                </td>
                <td className="contract-cell-yellow">
                  <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                    <input
                      className="contract-input"
                      type="text"
                      value={item.endDate}
                      readOnly
                      placeholder="자동 계산"
                    />
                  </div>
                </td>
                <td className="contract-cell-yellow">
                  <textarea
                    className="contract-textarea"
                    value={item.aptNames}
                    onChange={(e) =>
                      handleRemarkChange(item.id, "aptNames", e.target.value)
                    }
                    placeholder="계약 단지명을 모두 입력하거나, 견적에서 자동 채움할 수 있습니다."
                  />
                </td>
                <td className="contract-cell-yellow no-print">
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <input
                      className="contract-input"
                      type="number"
                      min={1}
                      placeholder="개월"
                      value={item.months}
                      onChange={(e) =>
                        handleRemarkChange(item.id, "months", e.target.value)
                      }
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveRemarkRow(item.id)}
                      style={{ fontSize: 10 }}
                    >
                      행 삭제
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            <tr className="no-print">
              <td colSpan={5} className="contract-remark-controls">
                <button type="button" onClick={handleAddRemarkRow}>
                  행 추가
                </button>
                <span style={{ marginLeft: 8, fontSize: 10, color: "#6b7280" }}>
                  개시일과 개월 수를 입력하면 종료일이 자동 계산됩니다.
                </span>
              </td>
            </tr>
            <tr className="contract-summary-row">
              <td colSpan={2}>아파트 단지 합계</td>
              <td>0 단지</td>
              <td>세대수 합계</td>
              <td>0 세대 / 모니터 수량 0 대</td>
            </tr>
          </tbody>
        </table>

        {/* 이용약관 + 개인정보 및 서명 */}
        <table className="contract-table" style={{ marginTop: 12 }}>
          <tbody>
            <tr>
              <td className="contract-terms-title-cell">이용약관</td>
              <td>
                <div className="contract-terms-body">
                  <div className="contract-terms-columns">
                    <div>
                      <div className="contract-terms-section-title">
                        제1조 (목적)
                      </div>
                      <div>
                        본 계약서는 주식회사 오르카 코리아(이하 &quot;회사&quot;)와
                        광고주 간의 광고 집행에 관한 권리와 의무를 정함을
                        목적으로 합니다.
                      </div>

                      <div className="contract-terms-section-title" style={{ marginTop: 6 }}>
                        제2조 (광고 매체)
                      </div>
                      <div>
                        광고 매체는 계약서 상에 명시된 아파트 엘리베이터
                        내/외부 모니터로 하며, 세부 위치 및 노출 방식은 회사의
                        운영 정책을 따릅니다.
                      </div>

                      <div className="contract-terms-section-title" style={{ marginTop: 6 }}>
                        제3조 (계약 기간 및 변경)
                      </div>
                      <div>
                        계약 기간은 본 계약서에 기재된 송출 개시일 및 종료일을
                        기준으로 하며, 기간 변경 시에는 상호 서면(전자문서 포함)
                        합의에 따릅니다.
                      </div>
                    </div>

                    <div>
                      <div className="contract-terms-section-title">
                        제4조 (요금 및 납부)
                      </div>
                      <div>
                        광고료 및 제작비는 본 계약서에 기재된 금액으로 하며,
                        납부 기한 및 방법은 결제 정보 항목에 따릅니다.
                      </div>

                      <div className="contract-terms-section-title" style={{ marginTop: 6 }}>
                        제5조 (계약 해지)
                      </div>
                      <div>
                        광고주는 정당한 사유 없이 일방적으로 계약을 해지할 수
                        없으며, 부득이한 해지 시에는 회사와 협의하여 위약금 등
                        정산 조건을 별도로 정합니다.
                      </div>

                      <div className="contract-terms-section-title" style={{ marginTop: 6 }}>
                        제6조 (면책)
                      </div>
                      <div>
                        천재지변, 통신장애, 엘리베이터 관리 규정 등 회사가
                        통제할 수 없는 사유로 인한 광고 송출 불가에 대하여
                        회사는 책임을 지지 않습니다.
                      </div>
                    </div>
                  </div>
                </div>
              </td>
            </tr>

            {/* 개인정보 동의 및 서명 영역 */}
            <tr>
              <td colSpan={2} className="contract-privacy-row">
                <div style={{ marginTop: 8 }}>
                  <div style={{ fontWeight: 600, marginBottom: 4 }}>
                    계약 접수를 위한 개인정보 수집·이용 및 제3자 제공 동의
                  </div>
                  <div style={{ fontSize: 10, marginBottom: 4 }}>
                    광고주는 계약 이행 및 정산, 고객 응대 등을 위하여 회사가
                    개인정보를 수집·이용하고, 필요한 범위 내에서 제3자(매체사,
                    세무대리인 등)에게 제공하는 것에 동의합니다.
                  </div>
                  <div>
                    <span className="contract-checkbox-group">
                      <input type="checkbox" /> 동의함 (필수)
                    </span>
                  </div>

                  <div className="contract-signature-row">
                    <div className="contract-signature-row-inner">
                      <div className="contract-signature-block">
                        <div className="contract-signature-label">
                          계약담당자 / 연락처
                        </div>
                        <div className="contract-signature-line">
                          <input
                            className="contract-input"
                            style={{ width: "60%" }}
                            placeholder="담당자명"
                          />{" "}
                          /{" "}
                          <input
                            className="contract-input"
                            style={{ width: "35%" }}
                            placeholder="연락처"
                          />
                        </div>
                      </div>

                      <div className="contract-signature-block">
                        <div className="contract-signature-label">
                          계약일자
                        </div>
                        <div className="contract-signature-line">
                          <input
                            className="contract-input"
                            type="date"
                            defaultValue={todayString}
                            style={{ width: 130 }}
                          />
                        </div>
                        <div className="contract-signature-small">
                          (계약서 작성 기준일)
                        </div>
                      </div>
                    </div>

                    <div className="contract-signature-row-inner" style={{ marginTop: 12 }}>
                      <div className="contract-signature-block">
                        <div className="contract-signature-label">
                          계약 고객
                        </div>
                        <div className="contract-signature-line">
                          <input
                            className="contract-input"
                            placeholder="상호명 또는 계약자 성명"
                          />{" "}
                          &nbsp;&nbsp; 서명 (인)
                        </div>
                      </div>

                      <div className="contract-signature-block">
                        <div className="contract-signature-label">
                          주식회사 오르카 코리아
                        </div>
                        <div className="contract-signature-line">
                          대표이사 서명 (인)
                        </div>
                        <div className="contract-signature-small">
                          (회사 직인은 인쇄 후 날인 또는 전자서명으로 대체)
                        </div>
                      </div>
                    </div>
                  </div>

                  <div style={{ fontSize: 10, marginTop: 8 }}>
                    본 계약의 내용 및 유의사항을 충분히 숙지하였으며, 위의
                    개인정보 수집·이용 및 제3자 제공에 동의합니다.
                  </div>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ContractNewPage;
