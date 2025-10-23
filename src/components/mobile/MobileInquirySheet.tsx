// src/components/mobile/MobileInquirySheet.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { supabase } from "@/integrations/supabase/client";

// ===== Types =====
export type InquiryKind = "SEAT" | "PACKAGE";
export type CampaignType = "기업" | "공공" | "병원" | "소상공인" | "광고대행사";

export type Prefill = {
  apt_id?: string | null;
  apt_name?: string | null;
  product_code?: string | null;
  product_name?: string | null;
  cart_snapshot?: any | null; // items[], months, cartTotal 등(유연 키 허용)
};

type Props = {
  open: boolean;
  mode: InquiryKind; // "SEAT" | "PACKAGE"
  prefill?: Prefill;
  sourcePage?: string;
  onClose: () => void;
  onSubmitted?: (rowId: string) => void; // 성공 모달에서 "확인" 클릭 시 호출
};

// ===== UI helpers =====
const COLOR_PRIMARY = "#6F4BF2";
const INPUT =
  "w-full rounded-xl border border-gray-200 px-4 py-3 outline-none focus:ring-2 focus:ring-violet-400 text-[13px]";
const LABEL = "text-[12px] font-semibold text-gray-700 mb-1";
const READ = "text-[12px] text-gray-500";
const SAFE_BOTTOM = "pb-[env(safe-area-inset-bottom)]";

// ===== utils =====
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
  return !!v && v.trim().length > 0;
}
function fmtWon(n: number | null | undefined) {
  if (n == null || isNaN(Number(n))) return "-";
  return `${Number(n).toLocaleString("ko-KR")}원`;
}
/** cart_snapshot에서 총액 유연 추출 */
function pickCartTotal(snap: any): number | null {
  if (!snap) return null;
  const candidates = [
    snap.cartTotal,
    snap.cart_total,
    snap.cartTotalWon,
    snap.cart_total_won,
    snap.grandTotal,
    snap.grand_total,
    snap.totalWon,
    snap.total_won,
    snap.total,
  ];
  for (const c of candidates) {
    const n = Number(c);
    if (isFinite(n) && n > 0) return n;
  }
  if (Array.isArray(snap.items) && snap.items.length > 0) {
    const sum = snap.items.reduce((acc: number, it: any) => {
      const n = Number(it?.itemTotalWon ?? it?.item_total_won ?? it?.totalWon ?? it?.total_won ?? 0);
      return acc + (isFinite(n) ? n : 0);
    }, 0);
    return sum > 0 ? sum : null;
  }
  return null;
}

// ===== 정책 모달 (모바일 경량) =====
function PolicyModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[1900]" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div
        className={`absolute inset-x-4 top-1/2 -translate-y-1/2 rounded-2xl bg-white shadow-2xl max-h-[70vh] overflow-auto ${SAFE_BOTTOM}`}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="text-[15px] font-extrabold">개인정보 수집·이용 정책</div>
          <button className="rounded-full p-2 hover:bg-gray-50" onClick={onClose} aria-label="close-policy">
            <svg width="20" height="20" viewBox="0 0 24 24">
              <path d="M6 6l12 12M18 6L6 18" stroke="#111" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        <div className="px-5 py-4 text-[12px] text-gray-700 leading-6">
          {/* 실제 약관 전문으로 교체하세요 */}
          <p className="mb-2">
            오르카 코리아는 문의 접수 및 상담을 위해 최소한의 개인정보를 수집·이용하며, 목적 달성 후 지체 없이
            파기합니다. 수집 항목: 성명, 연락처, 이메일, 문의 내용 등. 보유·이용 기간: 문의 처리 완료 후 1년.
          </p>
          <p className="mb-2">
            필요한 경우 매체 운영사 등 협력사와의 상담/집행을 위해 최소한의 정보가 공유될 수 있습니다. 법령에 따른
            고지·동의 절차를 준수합니다.
          </p>
          <p>귀하는 동의를 거부할 권리가 있으며, 동의 거부 시 상담 제공이 제한될 수 있습니다.</p>
        </div>
        <div className="px-5 py-4 border-t border-gray-100 flex justify-end">
          <button
            className="rounded-xl px-5 py-2 text-white font-semibold bg-violet-600 hover:bg-violet-700"
            onClick={onClose}
          >
            확인
          </button>
        </div>
      </div>
    </div>
  );
}

// ===== 성공 모달 (모바일 경량) =====
function SuccessModal({ open, mode, onClose }: { open: boolean; mode: InquiryKind; onClose: () => void }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[2000]" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/45" />
      <div
        className={`absolute inset-x-6 top-1/3 -translate-y-1/2 rounded-2xl bg-white shadow-2xl p-6 text-center ${SAFE_BOTTOM}`}
      >
        <div className="mx-auto mb-5 w-16 h-16 rounded-full bg-violet-100 flex items-center justify-center">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
            <path
              d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10Z"
              fill="#7C3AED"
              opacity="0.15"
            />
            <path d="M8 12h8M8 15h5M9 8h6" stroke="#7C3AED" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </div>
        <div className="text-[16px] font-extrabold mb-1">
          {mode === "SEAT" ? "구좌문의가 완료되었습니다." : "광고문의가 완료되었습니다."}
        </div>
        <div className="text-[13px] text-gray-700 leading-6">
          영업일 기준 1~2일 이내로 담당자가 배정되어
          <br />
          답변드릴 예정입니다.
        </div>
        <button
          onClick={onClose}
          className={`mt-6 w-full rounded-xl py-3 text-white font-semibold ${SAFE_BOTTOM}`}
          style={{ backgroundColor: COLOR_PRIMARY }}
        >
          확인
        </button>
      </div>
    </div>
  );
}

// ===== Main: MobileInquirySheet (Bottom Sheet 스타일) =====
export default function MobileInquirySheet({ open, mode, prefill, sourcePage, onClose, onSubmitted }: Props) {
  // 공통 입력값
  const [brand, setBrand] = useState("");
  const [campaignType, setCampaignType] = useState<CampaignType | "">("");
  const [managerName, setManagerName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [hopeDate, setHopeDate] = useState<string>("");
  const [requestText, setRequestText] = useState("");
  const [promoCode, setPromoCode] = useState("");

  const [agreePrivacy, setAgreePrivacy] = useState(false);

  // 상태
  const [submitting, setSubmitting] = useState(false);
  const [policyOpen, setPolicyOpen] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // 성공 모달
  const [successOpen, setSuccessOpen] = useState(false);

  const page = useMemo(() => {
    if (sourcePage) return sourcePage;
    if (typeof window !== "undefined") return window.location.pathname;
    return "/m";
  }, [sourcePage]);

  // 초기화 (open 변경 시)
  useEffect(() => {
    if (!open) {
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
      setPolicyOpen(false);
      setSuccessOpen(false);
    }
  }, [open]);

  // 본문 스크롤 잠금
  useEffect(() => {
    if (!open || typeof document === "undefined") return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // 연락처: 숫자만
  function handlePhoneChange(v: string) {
    const digits = v.replace(/\D/g, "");
    setPhone(digits);
  }

  // ——— SEAT 요약(문의 내용) ———
  const seatSummary = useMemo(() => {
    if (mode !== "SEAT") return null;
    const snap = prefill?.cart_snapshot || null;
    const items: any[] = Array.isArray(snap?.items) ? snap.items : [];
    const first = items[0];

    const topName = first?.apt_name ?? prefill?.apt_name ?? "-";
    const count = items.length > 0 ? items.length : prefill?.apt_name ? 1 : 0;
    const aptLabel = count > 1 ? `${topName} 외 ${count - 1}개 단지` : topName;

    const firstProd =
      first?.product_name ?? prefill?.product_name ?? first?.product_code ?? prefill?.product_code ?? "-";
    const uniqProd = new Set<string>();
    (items.length ? items : [first]).forEach((it) => {
      const key = it?.product_name ?? it?.product_code ?? "";
      if (key) uniqProd.add(String(key));
    });
    const productLabel = uniqProd.size >= 2 ? `${firstProd} 외` : firstProd;

    let monthsMax = 0;
    const mset = new Set<number>();
    items.forEach((it) => {
      const n = Number(it?.months ?? 0);
      if (isFinite(n) && n > 0) {
        mset.add(n);
        monthsMax = Math.max(monthsMax, n);
      }
    });
    if (mset.size === 0) {
      const fb = Number(snap?.months ?? 0);
      if (isFinite(fb) && fb > 0) {
        mset.add(fb);
        monthsMax = fb;
      }
    }
    const monthsLabel = monthsMax ? `${monthsMax}개월${mset.size >= 2 ? " 등" : ""}` : "-";

    const totalWon = pickCartTotal(snap);
    return { aptLabel, productLabel, monthsLabel, totalWon };
  }, [mode, prefill]);

  // 제출
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;

    setErrorMsg(null);

    // 검증
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

      const payload: any = {
        inquiry_kind: mode,
        status: "new",
        customer_name: managerName || null,
        phone: phone || null,
        company: brand || null,
        email: email || null,
        memo: requestText || null,
        source_page: page,
        utm,
        // SEAT 전용
        apt_id: mode === "SEAT" ? (prefill?.apt_id ?? null) : null,
        apt_name: mode === "SEAT" ? (prefill?.apt_name ?? null) : null,
        product_code: mode === "SEAT" ? (prefill?.product_code ?? null) : null,
        product_name: mode === "SEAT" ? (prefill?.product_name ?? null) : null,
        cart_snapshot: mode === "SEAT" ? (prefill?.cart_snapshot ?? null) : null,
        // 신규 필드
        extra,
      };

      const { error } = await (supabase as any).from("inquiries").insert(payload);
      if (error) throw error;

      // 성공 → 성공 모달
      setSuccessOpen(true);
    } catch (err: any) {
      setErrorMsg(err?.message || "제출 중 오류가 발생했습니다.");
    } finally {
      setSubmitting(false);
    }
  }

  const submitDisabled = submitting || !agreePrivacy;

  if (!open || typeof document === "undefined") return null;

  const sheet = (
    <div className="fixed inset-0 z-[1800]" role="dialog" aria-modal="true">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/45 backdrop-blur-[1px]" onClick={() => !submitting && onClose()} />

      {/* Bottom Sheet */}
      <div
        className={`absolute inset-x-0 bottom-0 rounded-t-3xl bg-white shadow-2xl ${SAFE_BOTTOM}`}
        style={{ maxHeight: "86vh" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag handle */}
        <div className="pt-2 pb-1 flex justify-center">
          <div className="w-10 h-1.5 rounded-full bg-gray-300" />
        </div>

        {/* Header */}
        <div className="px-4 pb-3 border-b border-gray-100 flex items-center justify-between">
          <div className="min-w-0">
            <div className="text-[15px] font-extrabold truncate">
              {mode === "SEAT" ? "구좌(T.O) 문의" : "시·군·구 / 패키지 문의"}
            </div>
            <div className="text-[11px] text-gray-500 mt-0.5 truncate">
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
            <svg width="20" height="20" viewBox="0 0 24 24">
              <path d="M6 6l12 12M18 6L6 18" stroke="#111" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Scrollable Body */}
        <form
          onSubmit={handleSubmit}
          className="px-4 pt-3 overflow-y-auto"
          style={{ maxHeight: "calc(86vh - 52px - 56px)" }} // (전체−헤더−푸터)
        >
          {/* SEAT: 문의 내용 요약 */}
          {mode === "SEAT" && seatSummary && (
            <div className="rounded-2xl border border-gray-100 bg-gray-50 p-3 mb-3">
              <div className="text-[12px] font-semibold mb-2">문의 내용</div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-[12px]">
                <div>
                  <div className={READ}>단지명</div>
                  <div className="font-medium">{seatSummary.aptLabel}</div>
                </div>
                <div>
                  <div className={READ}>상품명</div>
                  <div className="font-medium">{seatSummary.productLabel}</div>
                </div>
                <div>
                  <div className={READ}>광고기간</div>
                  <div className="font-medium">{seatSummary.monthsLabel}</div>
                </div>
                <div>
                  <div className={READ}>예상 총광고료</div>
                  <div className="font-medium">
                    {fmtWon(seatSummary.totalWon)} <span className="text-gray-500">(VAT별도)</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 입력 필드 */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className={LABEL}>
                브랜드명 <span className="text-red-500">*</span>
              </div>
              <input
                className={INPUT}
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
                className={`${INPUT} bg-white`}
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
                className={INPUT}
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
                className={INPUT}
                inputMode="numeric"
                placeholder="01012345678"
                value={phone}
                onChange={(e) => handlePhoneChange(e.target.value)}
              />
            </div>

            <div>
              <div className={LABEL}>이메일</div>
              <input
                className={INPUT}
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div>
              <div className={LABEL}>광고 송출 예정(희망)일</div>
              <input type="date" className={INPUT} value={hopeDate} onChange={(e) => setHopeDate(e.target.value)} />
            </div>
          </div>

          <div className="mt-3">
            <div className={LABEL}>요청사항</div>
            <textarea
              className={`${INPUT} h-24 resize-none`}
              placeholder="관심 상품/예산/지역/기간 등을 적어주세요."
              value={requestText}
              onChange={(e) => setRequestText(e.target.value)}
            />
          </div>

          <div className="mt-3 mb-[68px]">
            <div className={LABEL}>프로모션 코드</div>
            <input
              className={INPUT}
              placeholder="예: ORCA2025"
              value={promoCode}
              onChange={(e) => setPromoCode(e.target.value)}
            />
          </div>

          {errorMsg && <div className="mt-2 text-[12px] text-red-600">{errorMsg}</div>}
        </form>

        {/* Sticky Footer */}
        <div className={`px-4 py-3 border-t border-gray-100 bg-white sticky bottom-0 ${SAFE_BOTTOM}`}>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <button
                type="button"
                className="px-3 py-2 text-[12px] rounded-md border border-black bg-white hover:bg-gray-50 whitespace-nowrap"
                onClick={() => setPolicyOpen(true)}
              >
                개인정보 수집·이용 정책
              </button>
              <label className="flex items-center gap-2 text-[12px] text-gray-700 whitespace-nowrap">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-gray-300"
                  checked={agreePrivacy}
                  onChange={(e) => setAgreePrivacy(e.target.checked)}
                />
                동의 <span className="text-red-500">*</span>
              </label>
            </div>

            <button
              onClick={(e) => (document.querySelector('form[aria-modal!="true"]') ? null : null)}
              // 실제 제출 버튼
              className={`hidden`}
            />

            <button
              type="button"
              disabled={submitDisabled}
              onClick={(e) => {
                // 폼 submit 트리거
                const form = (e.currentTarget.closest('[role="dialog"]') as HTMLElement)?.querySelector("form");
                (form as HTMLFormElement | null)?.requestSubmit();
              }}
              className={`rounded-xl px-5 py-3 text-white font-semibold ${submitDisabled ? "bg-violet-300 cursor-not-allowed" : "bg-violet-600 hover:bg-violet-700"}`}
            >
              {submitting ? "전송 중..." : "문의 접수"}
            </button>
          </div>
        </div>
      </div>

      {/* 정책 모달 */}
      <PolicyModal open={policyOpen} onClose={() => setPolicyOpen(false)} />

      {/* 성공 모달 */}
      <SuccessModal
        open={successOpen}
        mode={mode}
        onClose={() => {
          setSuccessOpen(false);
          onSubmitted?.("ok");
          onClose();
        }}
      />
    </div>
  );

  return createPortal(sheet, document.body);
}
