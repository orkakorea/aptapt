// src/components/mobile/MobileInquirySheet.tsx
import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/** 종류: 구좌(T.O) / 패키지 */
export type InquiryKind = "SEAT" | "PACKAGE";

/** PC 버전과 호환되는 prefill */
export type InquiryPrefill = {
  apt_id?: string | null;
  apt_name?: string | null;
  product_code?: string | null;
  product_name?: string | null;
  cart_snapshot?: any | null; // { months?, cartTotal?, items?: [{apt_name, product_name, months, item_total_won|total_won}] }
};
// ➕ 호환용 별칭(기존 코드가 { Prefill }를 import해도 동작)
export type Prefill = InquiryPrefill;

export default function MobileInquirySheet({
  open,
  mode,
  onClose,
  prefill,
  sourcePage,
  onSubmitted,
}: {
  open: boolean;
  mode: InquiryKind; // "SEAT" | "PACKAGE"
  onClose: () => void;
  prefill?: InquiryPrefill;
  sourcePage?: string;
  onSubmitted?: (id: string) => void;
}) {
  const PROGRESS_BG = "#E9E1FF"; // 옅은 보라(트랙)
  const PROGRESS_FG = "#C7B4FF"; // 진행색(스크린샷 느낌)

  /* -----------------------------
   * form state (2페이지로 분리)
   * ----------------------------- */
  type CampaignType = "기업" | "공공" | "병원" | "소상공인" | "광고대행사" | "기타";
  const [step, setStep] = useState<1 | 2>(1);

  // 1단계
  const [brand, setBrand] = useState("");
  const [campaignType, setCampaignType] = useState<CampaignType | "">("");
  const [managerName, setManagerName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [hopeDate, setHopeDate] = useState("");

  // 2단계
  const [requestText, setRequestText] = useState("");
  const [promoCode, setPromoCode] = useState("");
  const [agreePrivacy, setAgreePrivacy] = useState(false);

  const [policyOpen, setPolicyOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // 리셋: 모달 닫힐 때 초기화
  useEffect(() => {
    if (!open) {
      setStep(1);
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
    }
  }, [open]);

  /* -----------------------------
   * UX 유틸
   * ----------------------------- */
  const page = useMemo(() => {
    if (sourcePage) return sourcePage;
    if (typeof window !== "undefined") return window.location.pathname;
    return "/";
  }, [sourcePage]);

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

  // 연락처: 숫자만
  function setPhoneDigits(v: string) {
    setPhone(v.replace(/\D/g, ""));
  }

  /** cart_snapshot에서 총액 추출(좌석문의 요약용) */
  function pickCartTotal(snap: any): number | null {
    if (!snap) return null;
    const cand = [
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
    for (const c of cand) {
      const n = Number(c);
      if (Number.isFinite(n) && n > 0) return n;
    }
    if (Array.isArray(snap.items)) {
      const s = snap.items.reduce((acc: number, it: any) => {
        const n = Number(it?.itemTotalWon ?? it?.item_total_won ?? it?.totalWon ?? it?.total_won ?? 0);
        return acc + (Number.isFinite(n) ? n : 0);
      }, 0);
      return s > 0 ? s : null;
    }
    return null;
  }

  /** 구좌(Seat) 요약 (2페이지 상단에만 표기) */
  const seatSummary = useMemo(() => {
    if (mode !== "SEAT") return null;
    const snap: any = prefill?.cart_snapshot || null;
    const items: any[] = Array.isArray(snap?.items) ? snap.items : [];
    const first = items[0];

    const aptName = items.length
      ? `${first?.apt_name ?? "-"}${items.length > 1 ? ` 외 ${items.length - 1}개 단지` : ""}`
      : prefill?.apt_name || "-";

    // 상품명 라벨
    let productLabel = prefill?.product_name ?? prefill?.product_code ?? "-";
    if (items.length) {
      const names = new Set<string>();
      items.forEach((i) => {
        const key = i?.product_name ?? i?.product_code ?? "";
        if (key) names.add(String(key));
      });
      const firstName = first?.product_name ?? first?.product_code ?? "-";
      productLabel = names.size >= 2 ? `${firstName} 외` : firstName;
    }

    // 기간 라벨
    const monthsSet = new Set<number>();
    items.forEach((i) => {
      const n = Number(i?.months ?? 0);
      if (Number.isFinite(n) && n > 0) monthsSet.add(n);
    });
    if (monthsSet.size === 0 && Number.isFinite(Number(snap?.months))) {
      const m = Number(snap.months);
      if (m > 0) monthsSet.add(m);
    }
    const maxM = Array.from(monthsSet).reduce((mx, n) => (n > mx ? n : mx), 0);
    const monthsLabel = maxM > 0 ? `${maxM}개월${monthsSet.size >= 2 ? " 등" : ""}` : "-";

    const totalWon = pickCartTotal(snap);

    return { aptName, productLabel, monthsLabel, totalWon };
  }, [mode, prefill]);

  /* -----------------------------
   * 진행 조건/제출
   * ----------------------------- */
  const canNext = !!(brand.trim() && campaignType && managerName.trim() && phone.trim().length >= 8);
  const submitDisabled = submitting || !agreePrivacy;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitDisabled) return;
    setErrorMsg(null);

    try {
      setSubmitting(true);

      const utm = getUTM();
      const extra = {
        brand: brand || null,
        campaign_type: campaignType || null,
        manager_name: managerName || null,
        hope_date: hopeDate || null,
        request_text: requestText || null,
        promo_code: promoCode || null,
        agree_privacy: agreePrivacy,
        step_ui: "mobile-2step",
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
        // 구좌 전용 필드
        apt_id: mode === "SEAT" ? (prefill?.apt_id ?? null) : null,
        apt_name: mode === "SEAT" ? (prefill?.apt_name ?? null) : null,
        product_code: mode === "SEAT" ? (prefill?.product_code ?? null) : null,
        product_name: mode === "SEAT" ? (prefill?.product_name ?? null) : null,
        cart_snapshot: mode === "SEAT" ? (prefill?.cart_snapshot ?? null) : null,
        // 공통 부가
        extra,
      };

      // ✅ 성공 시 ID를 부모로 전달 (외부 확인 모달에서 사용)
      const { data, error } = await (supabase as any).from("inquiries").insert(payload).select("id").single();
      if (error) throw error;

      onSubmitted?.(String(data?.id ?? "ok"));
      // 완료 문구/자동 닫기 없음 — 외부에서 처리
    } catch (err: any) {
      setErrorMsg(err?.message || "제출 중 오류가 발생했습니다.");
    } finally {
      setSubmitting(false);
    }
  }

  /* -----------------------------
   * 스타일 프리셋
   * ----------------------------- */
  const INPUT =
    "w-full rounded-xl border border-gray-200 px-4 py-3 outline-none focus:ring-2 focus:ring-violet-300 text-sm bg-white";
  const LABEL = "text-[13px] font-semibold text-gray-700 mb-1";
  const NOTE = "text-[12px] text-gray-500";

  const CampaignBtn = ({ value, label }: { value: CampaignType; label: string }) => (
    <button
      type="button"
      onClick={() => setCampaignType(value)}
      className={`h-12 rounded-xl border px-4 text-[14px] font-medium ${
        campaignType === value
          ? "border-violet-500 bg-violet-50 text-violet-700"
          : "border-gray-200 bg-white text-gray-800"
      }`}
    >
      {label}
    </button>
  );

  /* -----------------------------
   * 렌더링
   * ----------------------------- */
  if (!open) return null; // ✅ 모든 훅 호출 이후에만 렌더를 막는다 (Hook 순서 보장)

  return (
    <div className="fixed inset-0 z-[1000]">
      {/* dimmed */}
      <div className="absolute inset-0 bg-black/40" onClick={() => !submitting && onClose()} />

      {/* panel */}
      <div className="absolute inset-0 overflow-auto flex items-start justify-center">
        <div
          className="relative mt-4 mb-10 w-[720px] max-w-[92vw] rounded-2xl bg-white shadow-2xl border border-gray-100"
          onClick={(e) => e.stopPropagation()}
        >
          {/* header */}
          <div className="flex items-start justify-between px-5 sm:px-6 py-5 border-b border-gray-100 sticky top-0 bg-white/95 rounded-t-2xl">
            <div>
              <div className="text-[18px] font-extrabold text-gray-900">
                {mode === "SEAT" ? "구좌(T.O) 문의" : "시·군·구 등 단위 / 패키지문의"}
              </div>
              <div className="text-[12px] text-gray-500 mt-1">필수입력*.</div>
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

          {/* progress (상단 얇은 보라 막대 + 가운데 캡) */}
          <div className="px-5 sm:px-6 pt-3">
            <div className="mx-auto h-1.5 w-full rounded-full" style={{ backgroundColor: PROGRESS_BG }}>
              <div
                className="h-1.5 rounded-full transition-all duration-300"
                style={{
                  width: step === 1 ? "50%" : "100%",
                  backgroundColor: PROGRESS_FG,
                }}
              />
            </div>
            <div className="mx-auto mt-2 h-1.5 w-16 rounded-full bg-gray-200" />
          </div>

          {/* body */}
          <div className="px-5 sm:px-6 py-5">
            {step === 1 ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (canNext) setStep(2);
                }}
                className="space-y-5"
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* 브랜드명 */}
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

                  {/* 캠페인유형 (네모 버튼 6개) */}
                  <div>
                    <div className={LABEL}>
                      캠페인유형 <span className="text-red-500">*</span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      <CampaignBtn value="기업" label="기업" />
                      <CampaignBtn value="공공" label="공공" />
                      <CampaignBtn value="병원" label="병원" />
                      <CampaignBtn value="소상공인" label="소상공인" />
                      <CampaignBtn value="광고대행사" label="광고대행사" />
                      <CampaignBtn value="기타" label="기타" />
                    </div>
                  </div>

                  {/* 담당자명 */}
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

                  {/* 연락처 */}
                  <div>
                    <div className={LABEL}>
                      연락처 <span className="text-red-500">*</span>
                    </div>
                    <input
                      className={INPUT}
                      inputMode="numeric"
                      placeholder="01012345678"
                      value={phone}
                      onChange={(e) => setPhoneDigits(e.target.value)}
                    />
                  </div>

                  {/* 이메일 */}
                  <div>
                    <div className={LABEL}>이메일</div>
                    <input
                      className={INPUT}
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>

                  {/* 희망일 */}
                  <div>
                    <div className={LABEL}>광고 송출 예정(희망)일</div>
                    <input
                      type="date"
                      className={INPUT}
                      value={hopeDate}
                      onChange={(e) => setHopeDate(e.target.value)}
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={!canNext}
                  className={`w-full h-12 rounded-xl text-white font-semibold ${
                    canNext ? "bg-[#C7B4FF] hover:opacity-95" : "bg-[#E3DBFF] cursor-not-allowed"
                  }`}
                >
                  다음
                </button>
              </form>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                {/* (구좌) 요약 박스 – 선택 사항 */}
                {seatSummary && (
                  <div className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
                    <div className="text-sm font-semibold mb-2">문의 내용</div>
                    <div className="grid grid-cols-2 gap-3 text-[13px]">
                      <div>
                        <div className="text-gray-500">단지명</div>
                        <div className="font-medium">{seatSummary.aptName}</div>
                      </div>
                      <div>
                        <div className="text-gray-500">상품명</div>
                        <div className="font-medium">{seatSummary.productLabel}</div>
                      </div>
                      <div>
                        <div className="text-gray-500">광고기간</div>
                        <div className="font-medium">{seatSummary.monthsLabel}</div>
                      </div>
                      <div>
                        <div className="text-gray-500">예상 총광고료</div>
                        <div className="font-medium">
                          {typeof seatSummary.totalWon === "number"
                            ? `${seatSummary.totalWon.toLocaleString()}원`
                            : "-"}{" "}
                          <span className="text-gray-500">(VAT별도)</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* 요청사항 */}
                <div>
                  <div className={LABEL}>요청사항</div>
                  <textarea
                    className={`${INPUT} h-32 resize-none`}
                    placeholder="관심 상품/예산/지역/기간 등을 적어주세요."
                    value={requestText}
                    onChange={(e) => setRequestText(e.target.value)}
                  />
                </div>

                {/* 프로모션 코드 */}
                <div>
                  <div className={LABEL}>프로모션 코드</div>
                  <input
                    className={INPUT}
                    placeholder="예: ORCA2025"
                    value={promoCode}
                    onChange={(e) => setPromoCode(e.target.value)}
                  />
                </div>

                {/* 정책/동의 + 버튼 */}
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 flex-wrap">
                    <button
                      type="button"
                      className="px-3 py-2 text-[12px] rounded-md border border-black bg-white hover:bg-gray-50"
                      onClick={() => setPolicyOpen(true)}
                    >
                      개인정보 수집·이용 정책 자세히보기
                    </button>

                    <label className="flex items-center gap-2 text-[12px] text-gray-700">
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

                {errorMsg && <div className="text-[13px] text-red-600">{errorMsg}</div>}

                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="w-full h-12 rounded-xl bg-gray-100 text-gray-800 font-medium"
                >
                  이전
                </button>

                {/* 하단 안내문구(스크린샷 문구) */}
                <div className={`${NOTE} mt-2`}>※ 계약 시점의 운영사 정책에 따라 단가가 변경 될 수 있습니다.</div>
              </form>
            )}
          </div>
        </div>
      </div>

      {/* 정책 모달(간단) */}
      {policyOpen && (
        <div className="fixed inset-0 z-[1100]">
          <div className="absolute inset-0 bg-black/40" onClick={() => setPolicyOpen(false)} />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-[680px] max-w-[92vw] rounded-2xl bg-white shadow-2xl border border-gray-100">
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                <div className="text-base font-bold">개인정보 수집·이용 정책</div>
                <button className="rounded-full p-2 hover:bg-gray-50" onClick={() => setPolicyOpen(false)}>
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
                  필요한 경우 매체 운영사 등 협력사와의 상담/집행을 위해 최소한의 정보가 공유될 수 있습니다. 법령에 따른
                  고지·동의 절차를 준수합니다.
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
        </div>
      )}
    </div>
  );
}
