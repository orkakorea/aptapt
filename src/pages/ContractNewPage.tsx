// src/pages/ContractNewPage.tsx
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";

/* =========================================================================
 * 비고 영역용 타입/유틸
 * ========================================================================= */
type RemarkItem = {
  id: number;
  productName: string;
  startDate: string;
  months: string;
  endDate: string;
  aptNames: string;
};

/** 오늘 날짜(YYYY-MM-DD) */
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
    { id: 1, productName: "넌·올·잎", startDate: "", months: "", endDate: "", aptNames: "" },
    { id: 2, productName: "넌·올·잎", startDate: "", months: "", endDate: "", aptNames: "" },
    { id: 3, productName: "넌·올·잎", startDate: "", months: "", endDate: "", aptNames: "" },
  ]);

  const handleRemarkChange = (id: number, field: keyof RemarkItem, value: string) => {
    setRemarkItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const updated: RemarkItem = { ...item, [field]: value };
        if (field === "startDate" || field === "months") {
          updated.endDate = calcEndDate(updated.startDate, updated.months);
        }
        return updated;
      }),
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
    <div className="contract-root">
      {/* 인쇄/레이아웃용 스타일 */}
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
          padding: 18px 22px 22px;
          box-shadow: 0 8px 18px rgba(15, 23, 42, 0.16);
          box-sizing: border-box;
          font-family: "Malgun Gothic", "Apple SD Gothic Neo", system-ui, -apple-system,
            BlinkMacSystemFont, "Segoe UI", sans-serif;
          color: #111827;
          font-size: 11px;
          line-height: 1.4;
        }

        .contract-header-row {
          display: flex;
          align-items: center;
          margin-bottom: 8px;
        }

        .contract-header-left {
          width: 120px;
          font-size: 10px;
        }

        .contract-title {
          flex: 1;
          font-size: 22px;
          font-weight: 700;
          text-align: center;
          letter-spacing: 4px;
        }

        .contract-site {
          width: 140px;
          font-size: 11px;
          text-align: right;
          font-weight: 500;
        }

        .contract-table {
          width: 100%;
          border-collapse: collapse;
          table-layout: fixed;
        }

        .contract-table th,
        .contract-table td {
          border: 1px solid #000000;
          padding: 2px 4px;
          word-break: break-all;
          vertical-align: middle;
        }

        .contract-section-label {
          width: 42px;
          background: #000000;
          color: #ffffff;
          font-weight: 700;
          text-align: center;
          font-size: 11px;
          line-height: 1.3;
        }

        .contract-label-cell {
          width: 90px;
          background: #f3f4f6;
          font-weight: 600;
        }

        .contract-label-narrow {
          width: 70px;
          background: #f3f4f6;
          font-weight: 600;
        }

        .cell-yellow {
          background: #fff8b3;
        }

        .cell-pink {
          background: #ffd5d5;
        }

        .cell-center {
          text-align: center;
        }

        .cell-right {
          text-align: right;
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

        .contract-input::placeholder {
          color: #9ca3af;
        }

        .contract-textarea {
          resize: vertical;
          min-height: 38px;
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

        .contract-remark-controls {
          font-size: 10px;
          text-align: right;
          padding-top: 4px;
        }

        .contract-remark-controls button {
          padding: 3px 8px;
          border-radius: 4px;
          border: 1px solid #d1d5db;
          background: #ffffff;
          font-size: 10px;
          cursor: pointer;
          margin-left: 4px;
        }

        .summary-row td {
          font-weight: 600;
        }

        .terms-title-cell {
          width: 42px;
          background: #000000;
          color: #ffffff;
          font-weight: 700;
          text-align: center;
          font-size: 11px;
          line-height: 1.3;
        }

        .terms-body {
          font-size: 10px;
          line-height: 1.5;
          white-space: pre-wrap;
        }

        .privacy-title {
          font-weight: 600;
          margin-bottom: 4px;
        }

        .privacy-text {
          font-size: 10px;
          white-space: pre-wrap;
        }

        .signature-block {
          margin-top: 8px;
          font-size: 11px;
        }

        .signature-row {
          display: flex;
          justify-content: space-between;
          gap: 16px;
          margin-top: 4px;
        }

        .signature-col {
          flex: 1;
        }

        .signature-label {
          font-weight: 600;
          margin-bottom: 3px;
        }

        .signature-line {
          border-bottom: 1px solid #000000;
          min-height: 18px;
          padding-bottom: 2px;
        }

        .signature-small {
          font-size: 9px;
          margin-top: 2px;
        }

        .privacy-footnote {
          font-size: 9px;
          margin-top: 4px;
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

      {/* 계약서 본문 */}
      <div className="contract-paper">
        {/* 제목 */}
        <div className="contract-header-row">
          <div className="contract-header-left" />
          <div className="contract-title">광 고 계 약 서</div>
          <div className="contract-site">WWW.ORKA.CO.KR</div>
        </div>

        {/* 광고주 정보 + 계약 내용 + 결제 정보 */}
        <table className="contract-table">
          <tbody>
            {/* 광고주 정보 */}
            <tr>
              <td className="contract-section-label" rowSpan={5}>
                광고주
                <br />
                정보
              </td>
              <th className="contract-label-cell">상 호 명</th>
              <td className="cell-yellow" colSpan={4}>
                <input className="contract-input" />
              </td>
              <th className="contract-label-cell">대표 자</th>
              <td className="cell-yellow" colSpan={3}>
                <input className="contract-input" />
              </td>
            </tr>
            <tr>
              <th className="contract-label-cell">사업자등록번호</th>
              <td className="cell-yellow" colSpan={4}>
                <input className="contract-input" />
              </td>
              <th className="contract-label-cell">담 당 자</th>
              <td className="cell-yellow" colSpan={3}>
                <input className="contract-input" />
              </td>
            </tr>
            <tr>
              <th className="contract-label-cell">계산서용이메일</th>
              <td className="cell-yellow" colSpan={4}>
                <input className="contract-input" />
              </td>
              <th className="contract-label-cell">연 락 처</th>
              <td className="cell-yellow" colSpan={3}>
                <input className="contract-input" />
              </td>
            </tr>
            <tr>
              <th className="contract-label-cell">업 태 / 종 목</th>
              <td className="cell-yellow" colSpan={8}>
                <input className="contract-input" />
              </td>
            </tr>
            <tr>
              <th className="contract-label-cell">사 업 장 주 소</th>
              <td className="cell-yellow" colSpan={8}>
                <input className="contract-input" />
              </td>
            </tr>

            {/* 계약 내용 */}
            <tr>
              <td className="contract-section-label" rowSpan={5}>
                계 약
                <br />내 용
              </td>
              <th className="contract-label-cell">브 랜 드 명</th>
              <td className="cell-yellow" colSpan={4}>
                <input className="contract-input" />
              </td>
              <th className="contract-label-cell">매 체 명</th>
              <td colSpan={3}>아파트 엘리베이터 내부/외부 모니터광고</td>
            </tr>
            <tr>
              <th className="contract-label-cell">상 품 내 역</th>
              <td className="cell-pink cell-center">
                <select className="contract-select" defaultValue="">
                  <option value="">초 선택</option>
                  <option value="10">10초</option>
                  <option value="15">15초</option>
                  <option value="20">20초</option>
                  <option value="30">30초</option>
                </select>
              </td>
              <td className="cell-pink cell-center" colSpan={2}>
                구좌
              </td>
              <th className="contract-label-cell">기준금액</th>
              <td className="cell-pink cell-right" colSpan={3}>
                <input className="contract-input" defaultValue="0" />
              </td>
            </tr>
            <tr>
              <th className="contract-label-cell">수 량</th>
              <td className="cell-yellow" colSpan={3}>
                <input className="contract-input" defaultValue="0" style={{ textAlign: "right" }} />
              </td>
              <td className="cell-center">대</td>
              <th className="contract-label-cell">계 약 금 액</th>
              <td className="cell-yellow cell-right" colSpan={3}>
                <input className="contract-input" defaultValue="0" />
              </td>
            </tr>
            <tr>
              <th className="contract-label-cell">광 고 기 간</th>
              <td colSpan={4}>송출 개시일로부터</td>
              <td className="cell-yellow cell-center">
                <input className="contract-input" placeholder="개월 수" style={{ textAlign: "right" }} />
              </td>
              <td className="cell-center">개월</td>
              <th className="contract-label-cell">제 작 비</th>
              <td className="cell-yellow cell-right">
                <input className="contract-input" defaultValue="0" />
              </td>
            </tr>
            <tr>
              <th className="contract-label-cell">총 계약금액</th>
              <td className="cell-yellow cell-right" colSpan={3}>
                <input className="contract-input" defaultValue="0" />
              </td>
              <td className="cell-center">(VAT별도)</td>
              <th className="contract-label-cell">비 고</th>
              <td className="cell-yellow cell-right" colSpan={3}>
                <input className="contract-input" defaultValue="0" />
              </td>
            </tr>

            {/* 결제 정보 */}
            <tr>
              <td className="contract-section-label" rowSpan={2}>
                결제
                <br />
                정보
              </td>
              <td colSpan={9}>
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
              <td colSpan={9}>
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
                <div style={{ marginTop: 4 }}>
                  계좌번호 : 기업은행 185 – 168695 – 04 – 018&nbsp;&nbsp; 예금주 : 주식회사 오르카 코리아
                </div>
              </td>
            </tr>
          </tbody>
        </table>

        {/* 비고 영역 */}
        <table className="contract-table" style={{ marginTop: 10 }}>
          <thead>
            <tr>
              <td className="contract-section-label" rowSpan={remarkItems.length + 2}>
                비
                <br />고
              </td>
              <th style={{ width: "22%" }}>상 품 명</th>
              <th style={{ width: "16%" }}>송출 개시</th>
              <th style={{ width: "16%" }}>송출 종료</th>
              <th>계 약 단 지 명</th>
              <th style={{ width: "9%" }} className="no-print">
                관리
              </th>
            </tr>
          </thead>
          <tbody>
            {remarkItems.map((item) => (
              <tr key={item.id}>
                <td className="cell-yellow">
                  <input
                    className="contract-input"
                    value={item.productName}
                    onChange={(e) => handleRemarkChange(item.id, "productName", e.target.value)}
                  />
                </td>
                <td className="cell-yellow">
                  <input
                    type="date"
                    className="contract-input"
                    value={item.startDate}
                    onChange={(e) => handleRemarkChange(item.id, "startDate", e.target.value)}
                  />
                </td>
                <td className="cell-yellow">
                  <input className="contract-input" type="text" value={item.endDate} readOnly placeholder="자동 계산" />
                </td>
                <td className="cell-yellow">
                  <textarea
                    className="contract-textarea"
                    value={item.aptNames}
                    onChange={(e) => handleRemarkChange(item.id, "aptNames", e.target.value)}
                    placeholder="계약 단지명을 모두 입력하거나, 견적에서 자동 채울 수 있습니다."
                  />
                </td>
                <td className="cell-yellow no-print">
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <input
                      className="contract-input"
                      type="number"
                      min={1}
                      placeholder="개월"
                      value={item.months}
                      onChange={(e) => handleRemarkChange(item.id, "months", e.target.value)}
                    />
                    <button type="button" onClick={() => handleRemoveRemarkRow(item.id)} style={{ fontSize: 10 }}>
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
                <span style={{ marginLeft: 8, color: "#6b7280" }}>
                  송출 개시일과 개월 수를 입력하면 종료일은 자동 계산됩니다.
                </span>
              </td>
            </tr>
            <tr className="summary-row">
              <td colSpan={2}>아파트 단지 합계</td>
              <td className="cell-center">0 단지</td>
              <td colSpan={2}>세대수 합계 0 세대 / 모니터 수량 0 대</td>
            </tr>
          </tbody>
        </table>

        {/* 이용약관 + 개인정보 동의 + 서명 */}
        <table className="contract-table" style={{ marginTop: 10 }}>
          <tbody>
            <tr>
              <td className="terms-title-cell">이용약관</td>
              <td>
                <div className="terms-body">
                  {`
제1조 (목적)
본 특약은 주식회사 오르카 코리아 (이하 “회사”라 합니다.)가 제공하는 광고 상품과 광고대행서비스의 이용조건 및 절차에 관한 제반 사항을 규정함을 목적으로 한다.
제2조 (서비스상품의 정의)
회사가 제공하는 광고상품과 대행서비스라 함은 영상광고, 부착광고 등 기타 광고 서비스를 총괄하여 지칭한다.
제3조 (서비스 요금 결제)
1. “고객”은 회사와 광고계약을 체결하고 광고 집행(송출) 전 총액을 완불한다.
2. “고객”의 요구에 의해 약정 상품 이외 별도의 상품을 요구하는 경우 추가비용이 발생 할 수 있다. (ex. 광고 콘텐츠(영상) 제작비, 광고물 제작비 등)
제4조 (서비스 이용요금)
1. 요금항목의 정의는 다음과 같다.
① 광 고 금 액 : “고객”의 요청으로 광고 콘텐츠를 송출(게첨)하는 요금(부가세 별도)
② 공 급 가 액 : 광고금액과 촬영/제작비를 합산한 요금(부가세 포함 이전)
③ 총        액 : 광고금액과 촬영/제작비를 합산한 요금(부가세 포함 금액)
2. 기타 사항은 다음과 같다.
① 광고계약기간은 영상광고의 경우 최초 송출 일을 기준으로 하며, 부착광고는 최초 부착일 기준, 기타 광고는 최초 노출일을 기준으로 한다. 
② 고객의 요청에 의해 특정일을 지정할 수 있다.
`}
                </div>
              </td>
            </tr>
          </tbody>
        </table>

        <table className="contract-table" style={{ marginTop: 8 }}>
          <tbody>
            <tr>
              <td colSpan={2}>
                <div className="privacy-title">계약 접수를 위한 개인정보 수집·이용 및 제3자 제공 동의</div>
                <div className="privacy-text">
                  {`[개인정보 수집 및 이용]
수집 목적: 포커스미디어코리아 등 광고 엘리베이터TV 계약의 접수
수집 항목: 이름, 휴대폰 전화번호, 이메일 주소
보유 및 이용 기간: 계약일로부터 상기 "계약 기간"의 종료일 이후 1년까지`}
                </div>
                <div style={{ marginTop: 4 }}>
                  <span className="checkbox-inline">
                    <input type="checkbox" /> 동의 (필수)
                  </span>
                </div>

                <div className="privacy-text" style={{ marginTop: 8 }}>
                  {`[개인정보 제3자 제공 정보]
제공받는 자: 포커스미디어코리아, 임팩트미디어플랫폼, 에프앤티홀딩스, 
제공 항목: 이름, 휴대폰 전화번호, 이메일 주소
제공 목적: 엘리베이터TV 계약의 접수
보유 및 이용 기간: 계약일로부터 상기 "계약 기간"의 종료일 이후 1년까지`}
                </div>
                <div style={{ marginTop: 4 }}>
                  <span className="checkbox-inline">
                    <input type="checkbox" /> 동의 (필수)
                  </span>
                </div>

                <div className="signature-block">
                  <div className="signature-row">
                    <div className="signature-col">
                      <div className="signature-label">계약담당자 / 연락처</div>
                      <div className="signature-line">
                        <input className="contract-input" style={{ width: "55%" }} placeholder="담당자명" /> /{" "}
                        <input className="contract-input" style={{ width: "35%" }} placeholder="연락처" />
                      </div>
                    </div>
                    <div className="signature-col">
                      <div className="signature-label">계약일자</div>
                      <div className="signature-line">
                        <input
                          className="contract-input"
                          type="date"
                          defaultValue={todayString}
                          style={{ width: 130 }}
                        />
                      </div>
                      <div className="signature-small">(계약서 작성 기준일)</div>
                    </div>
                  </div>

                  <div className="signature-row" style={{ marginTop: 10 }}>
                    <div className="signature-col">
                      <div className="signature-label">계약 고객</div>
                      <div className="signature-line">
                        <input className="contract-input" placeholder="상호명 또는 계약자 성명" /> 서명 (인)
                      </div>
                    </div>
                    <div className="signature-col">
                      <div className="signature-label">주식회사 오르카 코리아</div>
                      <div className="signature-line">대표이사 서명 (인)</div>
                      <div className="signature-small">(직인·서명은 인쇄 후 날인하거나 전자서명으로 대체)</div>
                    </div>
                  </div>
                </div>

                <div className="privacy-text" style={{ marginTop: 6 }}>
                  본 계약의 내용 및 &quot;확인 사항&quot;을 숙지하였으며, 위와 같이 개인정보를 주식회사 오르카 코리아 및
                  제3자에 제공하는 데 동의합니다.
                </div>
                <div className="privacy-footnote">
                  광고주에겐 동의를 거부할 권리가 있으나, 필수 항목 미동의 시 계약 접수가 불가합니다.
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
