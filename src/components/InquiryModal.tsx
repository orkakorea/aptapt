// src/components/InquiryModal.tsx
import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

import { CompleteModal } from "@/components/complete-modal";
import type { ReceiptData, ReceiptSeat, ReceiptPackage } from "@/components/complete-modal";
import {
  buildSeatHeaderLabels,
  buildSeatItemsFromSnapshot,
  makeSeatSummary,
  maskPhone,
  emailToDomain,
} from "@/core/utils/receipt";
import { saveNodeAsPNG, saveNodeAsPDF } from "@/core/utils/capture";

type InquiryKind = "SEAT" | "PACKAGE";
type CampaignType = "기업" | "공공" | "병원" | "소상공인" | "광고대행사" | "기타";

type Prefill = {
  apt_id?: string | null;
  apt_name?: string | null;
  product_code?: string | null;
  product_name?: string | null;
  cart_snapshot?: any | null; // 1탭 카트 스냅샷
};

type Props = {
  open: boolean;
  mode: InquiryKind; // "SEAT" | "PACKAGE"
  onClose: () => void;
  prefill?: Prefill;
  sourcePage?: string;
  onSubmitted?: (rowId: string) => void;
};

const INPUT_BASE =
  "w-full rounded-xl border border-gray-200 px-4 py-3 outline-none focus:ring-2 focus:ring-violet-400 text-sm";
const LABEL = "text-[13px] font-semibold text-gray-700 mb-1";
const READ = "text-[13px] text-gray-500";

function getUTM() {
  if (typeof window === "undefined") return null;
  const p = new URLSearchParams(window.location.search);
  const keys = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"];
  const o: Record<string, string> = {};
  let has = false;
  keys.forEach((k) => {
    const v = p.get(k);
    if (v) {
      o[k] = v;
      has = true;
    }
  });
  return has ? o : null;
}
function required(v?: string) {
  return v && v.trim().length > 0;
}
function fmtWon(n: number | null | undefined) {
  if (n == null || isNaN(Number(n))) return "-";
  return `${Number(n).toLocaleString()}원`;
}

/** 접수번호 생성(프론트 임시 규칙) */
function genTicketCode() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const code = `ORKA-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(
    d.getDate(),
  )}-${Math.floor(1000 + Math.random() * 9000)}`;
  return code;
}

/** 접수증 링크 토큰(임시) */
function makeToken(len = 22) {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let out = "";
  for (let i = 0; i < len; i++) out += chars[(Math.random() * chars.length) | 0];
  return out;
}
/** 로컬 스냅샷 저장(서버 마이그레이션 전 임시) */
function persistReceiptLocal(token: string, data: any) {
  try {
    localStorage.setItem(`receipt:${token}`, JSON.stringify(data));
  } catch {}
}

export default function InquiryModal({ open, mode, prefill, onClose, sourcePage, onSubmitted }: Props) {
  // ===== 공통 입력 =====
  const [brand, setBrand] = useState("");
  const [campaignType, setCampaignType] = useState<CampaignType | "">("");
  const [managerName, setManagerName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [hopeDate, setHopeDate] = useState<string>("");
  const [requestText, setRequestText] = useState("");
  const [promoCode, setPromoCode] = useState("");

  const [agreePrivacy, setAgreePrivacy] = useState(false);

  // 정책/완료 모달
  const [policyOpen, setPolicyOpen] = useState(false);

  // ✅ 새 완료 모달 상태 (InquiryModal 닫혀도 독립 표시)
  const [completeOpen, setCompleteOpen] = useState(false);
  const [receiptData, setReceiptData] = useState<ReceiptData | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  const page = useMemo(() => {
    if (sourcePage) return sourcePage;
    if (typeof window !== "undefined") return window.location.pathname;
    return "/";
  }, [sourcePage]);

  useEffect(() => {
    // open=false로 닫혀도 completeOpen=true면 완료 모달만 보이도록 유지
    if (!open && !completeOpen) {
      // reset on close
      setBrand("");
      setCampaignType("");
      setManagerName("");
      setPhone("");
      setEmail("");
      setHopeDate("");
      setRequestText("");
      setPromoCode("");
      setAgreePrivacy(false);

      setSubmitting(false);
      setErrorMsg(null);
      setOkMsg(null);
      setPolicyOpen(false);

      setReceiptData(null);
    }
  }, [open, completeOpen]);

  // InquiryModal UI는 숨기되, 완료 모달만 띄우기 위한 렌더 가드
  if (!open && !completeOpen) return null;

  const isSeat = mode === "SEAT";

  // 연락처: 숫자만 허용
  function handlePhoneChange(v: string) {
    const digitsOnly = v.replace(/\D/g, "");
    setPhone(digitsOnly);
  }

  // ====== SEAT "문의 내용" 박스 파생값 (헤더 요약) ======
  function deriveSeatHeaderBox() {
    const labels = buildSeatHeaderLabels({
      apt_name: prefill?.apt_name,
      product_name: prefill?.product_name,
      product_code: prefill?.product_code,
      cart_snapshot: prefill?.cart_snapshot,
    });
    return {
      aptLabel: labels.aptLabel,
      productLabel: labels.productLabel,
      monthsLabel: labels.monthsLabel,
      totalWon: labels.totalWon,
    };
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    setOkMsg(null);

    if (!required(brand)) return setErrorMsg("브랜드명을 입력해 주세요.");
    if (!required(campaignType)) return setErrorMsg("캠페인유형을 선택해 주세요.");
    if (!required(managerName)) return setErrorMsg("담당자명을 입력해 주세요.");
    if (!required(phone)) return setErrorMsg("연락처를 입력해 주세요.");
    if (!agreePrivacy) return setErrorMsg("개인정보 수집·이용 동의를 체크해 주세요.");

    try {
      setSubmitting(true);
      const utm = getUTM();

      const extra: Record<string, any> = {
        brand: brand || null,
        campaign_type: campaignType || null,
        manager_name: managerName || null,
        hope_date: hopeDate || null,
        request_text: requestText || null,
        promo_code: promoCode || null,
        agree_privacy: agreePrivacy,
      };

      // ✅ DB 제약: 대문자만 허용 → 그대로 사용
      const inquiryKindDB = mode; // "SEAT" | "PACKAGE"

      const payload: any = {
        inquiry_kind: inquiryKindDB, // ← 여기!
        status: "new",
        customer_name: managerName || null,
        phone: phone || null,
        company: brand || null,
        email: email || null,
        memo: requestText || null,
        source_page: page,
        utm,
        apt_id: isSeat ? (prefill?.apt_id ?? null) : null,
        apt_name: isSeat ? (prefill?.apt_name ?? null) : null,
        product_code: isSeat ? (prefill?.product_code ?? null) : null,
        product_name: isSeat ? (prefill?.product_name ?? null) : null,
        cart_snapshot: isSeat ? (prefill?.cart_snapshot ?? null) : null,
        extra,
      };

      const { data, error } = await (supabase as any).from("inquiries").insert(payload).select("id").single();
      if (error) throw error;

      // 접수증 데이터 구성
      const ticketCode = genTicketCode();
      const createdAtISO = new Date().toISOString();
      const token = makeToken();
      const receiptUrl =
        typeof window !== "undefined"
          ? `${window.location.origin}${window.location.pathname}?receipt=${token}`
          : undefined;

      const customer = {
        company: brand,
        name: managerName,
        phoneMasked: maskPhone(phone),
        emailDomain: emailToDomain(email),
        campaignType: campaignType,
        inquiryKind: mode === "SEAT" ? "구좌문의" : "패키지문의",
        note: requestText || undefined,
      };

      let rd: ReceiptData;
      if (mode === "SEAT") {
        const summary = makeSeatSummary({
          apt_name: prefill?.apt_name,
          product_name: prefill?.product_name,
          product_code: prefill?.product_code,
          cart_snapshot: prefill?.cart_snapshot,
        });
        const items = buildSeatItemsFromSnapshot(prefill?.cart_snapshot || null);

        rd = {
          ticketCode,
          createdAtISO,
          mode: "SEAT",
          customer,
          summary,
          details: {
            items,
            monthlyTotalKRW: summary.monthlyTotalKRW ?? null,
            periodTotalKRW: summary.periodTotalKRW ?? null,
          },
          links: { receiptUrl },
          actions: {
            onSaveImage: () => {
              const node = document.getElementById("receipt-capture");
              if (node) saveNodeAsPNG(node as HTMLElement, `${ticketCode}_receipt`);
            },
            onSavePDF: () => {
              const node = document.getElementById("receipt-capture");
              if (node) saveNodeAsPDF(node as HTMLElement, `${ticketCode}_receipt`);
            },
            onCopyLink: () => {
              console.log("receipt link copied");
            },
          },
          meta: { currency: "KRW", vatNote: "표시된 금액은 부가세 별도입니다.", timeZone: "Asia/Seoul" },
        } as ReceiptSeat;
      } else {
        rd = {
          ticketCode,
          createdAtISO,
          mode: "PACKAGE",
          customer,
          summary: {
            scopeLabel: "시·군·구/동 단위 패키지 문의",
            areaCount: 0,
            months: null,
            budgetRangeText: undefined,
          },
          details: { areas: [] },
          links: { receiptUrl },
          actions: {
            onSaveImage: () => {
              const node = document.getElementById("receipt-capture");
              if (node) saveNodeAsPNG(node as HTMLElement, `${ticketCode}_receipt`);
            },
            onSavePDF: () => {
              const node = document.getElementById("receipt-capture");
              if (node) saveNodeAsPDF(node as HTMLElement, `${ticketCode}_receipt`);
            },
            onCopyLink: () => console.log("receipt link copied"),
          },
          meta: { currency: "KRW", vatNote: "표시된 금액은 부가세 별도입니다.", timeZone: "Asia/Seoul" },
        } as ReceiptPackage;
      }

      // 임시: 로컬 저장(링크 열람용)
      persistReceiptLocal(token, rd);

      // 문의 폼은 숨기고(렌더 안 함), 완료 모달만 중앙 표시
      setReceiptData(rd);
      setCompleteOpen(true);

      setOkMsg("접수가 완료되었습니다. 담당자가 곧 연락드리겠습니다.");
      onSubmitted?.(data?.id ?? "ok");
    } catch (err: any) {
      setErrorMsg(err?.message || "제출 중 오류가 발생했습니다.");
    } finally {
      setSubmitting(false);
    }
  }

  const submitDisabled = submitting || !agreePrivacy;

  /* ========================= 렌더 =========================
   * completeOpen === true 면 '문의 모달 UI'는 아예 렌더하지 않고
   * 완료 모달(CompleteModal)만 중앙 오버레이로 표시된다.
   * ====================================================== */
  return (
    <>
      {/* ✅ 완료 모달 (PC/모바일 자동 분기) — InquiryModal과 독립 표시 */}
      {receiptData && (
        <CompleteModal
          open={completeOpen}
          onClose={() => {
            setCompleteOpen(false);
            onClose(); // 부모에 알림(폼 완전 종료)
          }}
          data={receiptData}
          confirmLabel="확인"
        />
      )}

      {/* ❌ completeOpen 상태에서는 문의 모달 UI 렌더 자체를 막음 */}
      {open && !completeOpen && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/40" onClick={() => !submitting && onClose()} />

          {/* Panel */}
          <div className="relative z-[1001] w-[720px] max-w-[92vw] rounded-2xl bg-white shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
              <div>
                <div className="text-lg font-bold">
                  {mode === "SEAT" ? "구좌(T.O) 문의" : "시,군,구 동 단위 / 패키지문의"}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {mode === "SEAT"
                    ? "선택하신 단지/상품 정보를 포함해 접수됩니다."
                    : "브랜드·캠페인유형·희망일 등을 알려주시면 빠르게 제안드립니다."}
                </div>
              </div>
              <button
                className="rounded-full p-2 hover:bg-gray-50"
                onClick={() => !submitting && onClose()}
                aria-label="close"
              >
                <svg width="22" height="22" viewBox="0 0 24 24">
                  <path d="M6 6l12 12M18 6L6 18" stroke="#111" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            {/* Body */}
            <form onSubmit={handleSubmit} className="px-6 py-5 space-y-5">
              {/* ===== SEAT: 문의 내용 박스 ===== */}
              {mode === "SEAT" &&
                (() => {
                  const s = deriveSeatHeaderBox();
                  return (
                    <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                      <div className="text-sm font-semibold mb-2">문의 내용</div>
                      <div className="grid grid-cols-2 gap-3 text-[13px]">
                        <div className="flex flex-col">
                          <span className={READ}>단지명</span>
                          <span className="font-medium">{s.aptLabel}</span>
                        </div>
                        <div className="flex flex-col">
                          <span className={READ}>상품명</span>
                          <span className="font-medium">{s.productLabel}</span>
                        </div>
                        <div className="flex flex-col">
                          <span className={READ}>광고기간</span>
                          <span className="font-medium">{s.monthsLabel}</span>
                        </div>
                        <div className="flex flex-col">
                          <span className={READ}>예상 총광고료</span>
                          <span className="font-medium">
                            {fmtWon(s.totalWon)} <span className="text-gray-500">(VAT별도)</span>
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })()}

              {/* ===== 입력 폼 ===== */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className={LABEL}>
                    브랜드명 <span className="text-red-500">*</span>
                  </div>
                  <input
                    className={INPUT_BASE}
                    placeholder="오르카 코리아"
                    value={brand}
                    onChange={(e) => setBrand(e.target.value)}
                  />
                </div>

                <div>
                  <div className={LABEL}>
                    캠페인유형 <span className="text-red-500">*</span>
                  </div>
                  <select
                    className={`${INPUT_BASE} bg-white`}
                    value={campaignType}
                    onChange={(e) => setCampaignType(e.target.value as CampaignType)}
                  >
                    <option value="" disabled>
                      선택하세요
                    </option>
                    <option value="기업">기업</option>
                    <option value="공공">공공</option>
                    <option value="병원">병원</option>
                    <option value="소상공인">소상공인</option>
                    <option value="광고대행사">광고대행사</option>
                  </select>
                </div>

                <div>
                  <div className={LABEL}>
                    담당자명 <span className="text-red-500">*</span>
                  </div>
                  <input
                    className={INPUT_BASE}
                    placeholder="박우주"
                    value={managerName}
                    onChange={(e) => setManagerName(e.target.value)}
                  />
                </div>

                <div>
                  <div className={LABEL}>
                    연락처 <span className="text-red-500">*</span>
                  </div>
                  <input
                    className={INPUT_BASE}
                    inputMode="numeric"
                    placeholder="01012345678"
                    value={phone}
                    onChange={(e) => handlePhoneChange(e.target.value)}
                  />
                </div>

                <div>
                  <div className={LABEL}>이메일 </div>
                  <input
                    className={INPUT_BASE}
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>

                <div>
                  <div className={LABEL}>광고 송출 예정(희망)일</div>
                  <input
                    type="date"
                    className={INPUT_BASE}
                    value={hopeDate}
                    onChange={(e) => setHopeDate(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <div className={LABEL}>요청사항 </div>
                <textarea
                  className={`${INPUT_BASE} h-28 resize-none`}
                  placeholder="관심 상품/예산/지역/기간 등을 적어주세요."
                  value={requestText}
                  onChange={(e) => setRequestText(e.target.value)}
                />
              </div>

              <div>
                <div className={LABEL}>프로모션 코드 </div>
                <input
                  className={INPUT_BASE}
                  placeholder="예: ORCA2024"
                  value={promoCode}
                  onChange={(e) => setPromoCode(e.target.value)}
                />
              </div>

              {errorMsg && <div className="text-[13px] text-red-600">{errorMsg}</div>}
              {okMsg && <div className="text-[13px] text-emerald-600">{okMsg}</div>}

              {/* 하단: 정책 버튼 + 체크 1개 + 제출 */}
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 flex-wrap">
                  <button
                    type="button"
                    className="px-3 py-2 text-[12px] rounded-md border border-black bg-white hover:bg-gray-50 whitespace-nowrap"
                    onClick={() => setPolicyOpen(true)}
                  >
                    개인정보 수집·이용 정책 자세히보기
                  </button>

                  <label className="flex items-center gap-2 text-[12px] text-gray-700 whitespace-nowrap">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-gray-300"
                      checked={agreePrivacy}
                      onChange={(e) => setAgreePrivacy(e.target.checked)}
                    />
                    개인정보 수집·이용 동의 <span className="text-red-500">*</span>
                  </label>
                </div>

                <button
                  type="submit"
                  disabled={submitDisabled}
                  className={`rounded-xl px-5 py-3 text-white font-semibold ${
                    submitDisabled ? "bg-violet-300 cursor-not-allowed" : "bg-violet-600 hover:bg-violet-700"
                  }`}
                >
                  {submitting ? "전송 중..." : "문의 접수"}
                </button>
              </div>
            </form>
          </div>

          {/* == 정책 안내 모달 == */}
          {policyOpen && (
            <div className="fixed inset-0 z-[1100] flex items-center justify-center">
              <div className="absolute inset-0 bg-black/40" onClick={() => setPolicyOpen(false)} />
              <div className="relative z-[1101] w-[680px] max-w-[92vw] rounded-2xl bg-white shadow-2xl">
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                  <div className="text-base font-bold">개인정보 수집·이용 정책</div>
                  <button
                    className="rounded-full p-2 hover:bg-gray-50"
                    onClick={() => setPolicyOpen(false)}
                    aria-label="close-policy"
                  >
                    <svg width="22" height="22" viewBox="0 0 24 24">
                      <path d="M6 6l12 12M18 6L6 18" stroke="#111" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                  </button>
                </div>
                <div className="px-6 py-5 max-h-[60vh] overflow-auto text-[13px] leading-6 text-gray-700">
                  <p className="mb-3">
                    오르카 코리아는 문의 접수 및 상담을 위해 최소한의 개인정보를 수집·이용하며, 목적 달성 후 지체 없이
                    파기합니다. 수집 항목: 성명, 연락처, 이메일, 문의 내용 등. 보유·이용 기간: 문의 처리 완료 후 1년.
                  </p>
                  <p className="mb-3">
                    필요한 경우 매체 운영사 등 협력사와의 상담/집행을 위해 최소한의 정보가 공유될 수 있습니다. 법령에
                    따른 고지·동의 절차를 준수합니다.
                  </p>
                  <p>귀하는 동의를 거부할 권리가 있으며, 동의 거부 시 상담 제공이 제한될 수 있습니다.</p>
                </div>
                <div className="px-6 py-4 border-t border-gray-100 flex justify-end">
                  <button
                    className="rounded-xl px-5 py-3 text-white font-semibold bg-violet-600 hover:bg-violet-700"
                    onClick={() => setPolicyOpen(false)}
                  >
                    확인
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}
