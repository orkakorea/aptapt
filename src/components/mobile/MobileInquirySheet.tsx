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
  const PROGRESS_BG = "#E9E1FF";
  const PROGRESS_FG = "#7C3AED";

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

  // 🔧 시트가 화면 하단까지 "쭉" 흰 배경으로 차도록 내부 패널 높이를 화면 기준으로 고정
  //  - 패널 컨테이너에 min-h-[calc(100dvh-16px)] (mt-4 보정) + flex-col + overflow-hidden
  //  - 스크롤은 내부 body 영역에서만 발생
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

  function setPhoneDigits(v: string) {
    setPhone(v.replace(/\D/g, ""));
  }

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

  const seatSummary = useMemo(() => {
    if (mode !== "SEAT") return null;
    const snap: any = prefill?.cart_snapshot || null;
    const items: any[] = Array.isArray(snap?.items) ? snap.items : [];
    const first = items[0];

    const aptName = items.length
      ? `${first?.apt_name ?? "-"}${items.length > 1 ? ` 외 ${items.length - 1}개 단지` : ""}`
      : prefill?.apt_name || "-";

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

  const canNext = !!(brand.trim() && campaignType && managerName.trim() && phone.trim().length >= 9);
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
        inquiry_kind: mode, // "SEAT" | "PACKAGE"
        // status는 정책상 기본 'new'로 처리되므로 보낼 필요 없음
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
        // 부가
        extra,
      };

      // ✅ RLS 안전 경로: 함수로 INSERT(SELECT 없음) — returning: minimal
      const { error } = await (supabase as any).from("inquiries").insert(payload, { returning: "minimal" });
      if (error) throw error;

      onSubmitted?.("ok");
    } catch (err: any) {
      setErrorMsg(err?.message || "제출 중 오류가 발생했습니다.");
    } finally {
      setSubmitting(false);
    }
  }

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

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[1000]">
      {/* dimmed */}
      <div className="absolute inset-0 bg-black/40" onClick={() => !submitting && onClose()} />

      {/* panel wrapper (⬇️ 하단까지 흰 배경 유지) */}
      <div className="absolute inset-0 overflow-auto flex items-start justify-center">
        <div
          className="
            relative mt-4 mb-0 w-[720px] max-w-[92vw]
            rounded-2xl bg-white shadow-2xl border border-gray-100
            min-h-[calc(100dvh-16px)] flex flex-col overflow-hidden
          "
          onClick={(e) => e.stopPropagation()}
        >
          {/* header */}
          <div className="flex items-start justify-between px-5 sm:px-6 py-5 border-b border-gray-100 sticky top-0 bg-white">
            <div>
              <div className="text-[18px] font-extrabold text-gray-900">구좌(T.O) 문의</div>
              <div className="text-[12px] text-gray-500 mt-1">*선택하신 단지/상품 정보를 포함해 접수됩니다.</div>
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

          {/* progress */}
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

          {/* body (⬇️ 내부 스크롤) */}
          <div className="flex-1 overflow-auto px-5 sm:px-6 py-5">
            {step === 1 ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (canNext) setStep(2);
                }}
                className="space-y-5"
              >
                {mode === "SEAT" && (
                  <div className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
                    <div className="text-sm font-semibold mb-2">문의 내용</div>
                    <div className="grid grid-cols-2 gap-3 text-[13px]">
                      <div>
                        <div className="text-gray-500">단지명</div>
                        <div className="font-medium">{prefill?.apt_name || "-"}</div>
                      </div>
                      <div>
                        <div className="text-gray-500">상품명</div>
                        <div className="font-medium">{prefill?.product_name || prefill?.product_code || "-"}</div>
                      </div>
                      <div>
                        <div className="text-gray-500">광고기간</div>
                        <div className="font-medium">
                          {prefill?.cart_snapshot?.months ? `${prefill?.cart_snapshot?.months}개월` : "-"}
                        </div>
                      </div>
                      <div>
                        <div className="text-gray-500">예상 총광고료</div>
                        <div className="font-medium">
                          {typeof prefill?.cart_snapshot?.cartTotal === "number"
                            ? `${Number(prefill?.cart_snapshot?.cartTotal).toLocaleString()}원`
                            : "-"}{" "}
                          <span className="text-gray-500">(VAT별도)</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      <CampaignBtn value="기업" label="기업" />
                      <CampaignBtn value="공공" label="공공" />
                      <CampaignBtn value="병원" label="병원" />
                      <CampaignBtn value="소상공인" label="소상공인" />
                      <CampaignBtn value="광고대행사" label="광고대행사" />
                      <CampaignBtn value="기타" label="기타" />
                    </div>
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
                      onChange={(e) => setPhoneDigits(e.target.value)}
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
                    canNext ? "bg-violet-600 hover:bg-violet-700" : "bg-violet-300 cursor-not-allowed"
                  }`}
                >
                  다음
                </button>
              </form>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <div className={LABEL}>요청사항</div>
                  <textarea
                    className={`${INPUT} h-32 resize-none`}
                    placeholder="관심 상품/예산/지역/기간 등을 적어주세요."
                    value={requestText}
                    onChange={(e) => setRequestText(e.target.value)}
                  />
                </div>

                <div>
                  <div className={LABEL}>프로모션 코드</div>
                  <input
                    className={INPUT}
                    placeholder="예: ORCA2025"
                    value={promoCode}
                    onChange={(e) => setPromoCode(e.target.value)}
                  />
                </div>

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
                    disabled={submitting || !agreePrivacy}
                    className={`rounded-xl px-5 py-3 text-white font-semibold leading-tight ${
                      submitting || !agreePrivacy
                        ? "bg-violet-300 cursor-not-allowed"
                        : "bg-violet-600 hover:bg-violet-700"
                    }`}
                  >
                    문의
                    <br />
                    접수
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

                <div className={`${NOTE} mt-2 text-right`}>
                  ※ 계약 시점의 운영사 정책에 따라 단가가 변경 될 수 있습니다.
                </div>
              </form>
            )}
          </div>

          {/* bottom safe-area spacer so white background fills to the bottom */}
          <div className="h-4 pb-[env(safe-area-inset-bottom)] bg-white" />
        </div>
      </div>

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
