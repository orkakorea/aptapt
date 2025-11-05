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
  /** ✅ (수정) 완료 콜백에 '표시용 영수증 스냅샷'을 함께 전달 */
  onSubmitted?: (id: string, receiptSnapshot?: any) => void;
}) {
  /* =========================================================================
   * 스타일 토큰
   * ========================================================================= */
  const BRAND = "#6F4BF2";
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

  /* 열고 닫힐 때 상태 리셋 */
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

  /* 현재 페이지(소스 경로) */
  const page = useMemo(() => {
    if (sourcePage) return sourcePage;
    if (typeof window !== "undefined") return window.location.pathname;
    return "/mobile";
  }, [sourcePage]);

  /* UTM 파라미터 수집 */
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

  /* 전화번호는 숫자만 보관 (테이블 CHECK: 9~12자리) */
  function setPhoneDigits(v: string) {
    setPhone(v.replace(/\D/g, ""));
  }
  const phoneOk = /^\d{9,12}$/.test(phone);

  /* 카트 스냅샷 합계 추출(표시용) */
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

  /* 상단 요약 카드(좌측 상단) */
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

  const canNext = !!(brand.trim() && campaignType && managerName.trim() && phoneOk);
  const submitDisabled = submitting || !agreePrivacy;

  /* 표시용: 전화 마스크 */
  function maskPhone(digits: string) {
    const s = (digits || "").replace(/\D/g, "");
    if (s.length <= 3) return s;
    if (s.length <= 7) return `${s.slice(0, 3)}-${s.slice(3)}`;
    return `${s.slice(0, 3)}-${s.slice(3, 7)}-${s.slice(7)}`;
  }

  /* =======================
   *  스냅샷 정규화 유틸
   * ======================= */
  function parseMaybeJSON(input: any): any | null {
    if (!input) return null;
    if (typeof input === "string") {
      try {
        const t = input.trim();
        if (t === "" || t === "null") return null;
        return JSON.parse(t);
      } catch {
        return null;
      }
    }
    if (typeof input === "object") return input;
    return null;
  }

  /** 각 아이템에 months / monthlyAfter / baseMonthly / lineTotal 보강하고 cartTotal 재계산 */
  function normalizeCartSnapshot(raw: any) {
    const snap = parseMaybeJSON(raw) ?? {};
    const rawItems: any[] =
      (Array.isArray(snap.items) && snap.items) ||
      (Array.isArray(snap.computedCart) && snap.computedCart) ||
      (Array.isArray(snap.cart?.items) && snap.cart.items) ||
      [];

    const toNum = (v: any): number | null => {
      const n = Number(v);
      return isFinite(n) && !isNaN(n) ? n : null;
    };

    const items = rawItems.map((it) => {
      const months = toNum(it.months ?? it.Months ?? it.period ?? it.duration) ?? toNum(snap.months) ?? 0;

      // 최종 월가(할인가)
      let monthlyAfter =
        toNum(
          it.monthlyAfter ??
            it.monthly_after ??
            it.priceMonthly ??
            it.computedMonthly ??
            it.finalMonthly ??
            it.monthly_after_discount,
        ) ?? null;

      // 라인 총액
      let lineTotal =
        toNum(
          it.lineTotal ??
            it.line_total ??
            it.total ??
            it.totalCost ??
            it.line_total_after_discount ??
            it.item_total_won ??
            it.total_won,
        ) ?? 0;

      // 월가가 없고 (총액, 개월) 있으면 역산
      if ((monthlyAfter == null || monthlyAfter === 0) && months > 0 && lineTotal > 0) {
        monthlyAfter = lineTotal / months;
      }

      // 총액이 없고 월×개월이 가능하면 계산
      if ((lineTotal == null || lineTotal === 0) && monthlyAfter != null && months > 0) {
        lineTotal = monthlyAfter * months;
      }

      // 기준 월가(정가)
      let baseMonthly =
        toNum(
          it.baseMonthly ??
            it.base_monthly ??
            it.monthlyBefore ??
            it.monthly_base ??
            it.basePriceMonthly ??
            it.base_price_monthly,
        ) ?? null;

      // 기준 월가가 없으면 월가로 대체(할인율 0%라도 표시 가능)
      if (baseMonthly == null && monthlyAfter != null) {
        baseMonthly = monthlyAfter;
      }

      return {
        apt_name: it.apt_name ?? it.name ?? it.aptName ?? it.apt?.name ?? "",
        product_name:
          it.product_name ??
          it.productName ??
          it.mediaName ??
          it.media_name ??
          it.media ??
          it.product ??
          it.product_code ??
          "",
        product_code: it.product_code ?? it.product ?? it.media ?? "",
        months,
        baseMonthly, // 기준 금액(정가, 월)
        monthlyAfter, // 최종 금액(월)
        lineTotal, // 라인 총액
      };
    });

    const cartTotal = items.reduce((acc, it) => acc + (Number(it.lineTotal) || 0), 0);
    const monthsFromItems = items.reduce((mx, it) => (Number(it.months) > mx ? Number(it.months) : mx), 0);

    return {
      ...(typeof snap === "object" ? snap : {}),
      items,
      months: toNum(snap.months) ?? (monthsFromItems > 0 ? monthsFromItems : undefined),
      cartTotal,
    };
  }

  /* ✅ 완료모달에 바로 쓸 "표시용 스냅샷" 생성 (정규화 버전으로 업데이트) */
  function buildReceiptSnapshot() {
    const normalized = mode === "SEAT" ? normalizeCartSnapshot(prefill?.cart_snapshot) : null;
    const snap = normalized || prefill?.cart_snapshot || null;
    const items: any[] = Array.isArray(snap?.items) ? snap.items : [];
    const first = items[0];

    const topAptLabel = items.length
      ? `${first?.apt_name ?? "-"}${items.length > 1 ? ` 외 ${items.length - 1}개 단지` : ""}`
      : prefill?.apt_name || "-";

    const months =
      (Array.isArray(items) && items.reduce((mx, i) => (Number(i?.months) > mx ? Number(i.months) : mx), 0)) ||
      (Number.isFinite(Number(snap?.months)) ? Number(snap.months) : null);

    return {
      summary: { topAptLabel },
      customer: {
        company: brand || null,
        name: managerName || null,
        phoneMasked: phone ? maskPhone(phone) : null,
        phone: phone || null,
        email: email || null,
      },
      form: {
        values: {
          campaign_type: campaignType || null,
          months: months || null,
          desiredDate: hopeDate || null,
          promoCode: promoCode || null,
          request_text: requestText || null,
        },
        cart_snapshot: snap || null,
      },
      meta: { step_ui: "mobile-2step" },
    };
  }

  /* =========================================================================
   * 제출: 반드시 RPC 사용 (RLS 우회)
   * ========================================================================= */
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

      // ✅ 핵심: 스냅샷 정규화 후 저장(기준금액/할인율/총액을 Admin에서 바로 표시 가능)
      const normalizedSnapshot =
        mode === "SEAT" && prefill?.cart_snapshot ? normalizeCartSnapshot(prefill.cart_snapshot) : null;

      const payload: any = {
        inquiry_kind: mode, // "SEAT" | "PACKAGE"
        // status는 기본 'new'
        customer_name: managerName || null,
        phone: phone || null, // 숫자만
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
        cart_snapshot: mode === "SEAT" ? (normalizedSnapshot ?? prefill?.cart_snapshot ?? null) : null,
        // 부가
        extra,
      };

      // ✅ 테이블 INSERT 금지. RPC만 사용!
      const { error } = await (supabase as any).rpc("submit_inquiry", {
        p_payload: payload,
      });

      if (error) throw error;

      // ✅ 상위로 '표시용 영수증 스냅샷' 함께 전달 (정규화 반영)
      const snapshot = buildReceiptSnapshot();
      onSubmitted?.("ok", snapshot);
    } catch (err: any) {
      setErrorMsg(err?.message || "제출 중 오류가 발생했습니다.");
    } finally {
      setSubmitting(false);
    }
  }

  /* =========================================================================
   * 소형 UI 컴포넌트
   * ========================================================================= */
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
      {/* DIM */}
      <div className="absolute inset-0 bg-black/40" onClick={() => !submitting && onClose()} />

      {/* Bottom Half Sheet Panel */}
      <div className="absolute inset-x-0 bottom-0 flex justify-center">
        <div
          className="relative w-[720px] max-w-[100vw] max-h-[86vh] rounded-t-2xl bg-white shadow-2xl border border-gray-100 overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="sticky top-0 z-10 flex items-start justify-between px-5 sm:px-6 py-4 bg-white border-b border-gray-100">
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
          <div className="px-5 sm:px-6 pt-3 bg-white">
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

          {/* Body */}
          <div className="px-5 sm:px-6 py-4 overflow-auto" style={{ maxHeight: "calc(86vh - 112px)" }}>
            {/* 상단 문의 요약 */}
            {seatSummary && (
              <div className="mb-4 rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
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
                      {typeof seatSummary.totalWon === "number" ? `${seatSummary.totalWon.toLocaleString()}원` : "-"}{" "}
                      <span className="text-gray-500">(VAT별도)</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* STEP 1 */}
            {step === 1 && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (canNext) setStep(2);
                }}
                className="space-y-5"
              >
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
                    {!phoneOk && phone.length > 0 && (
                      <div className="mt-1 text-[11px] text-red-600">숫자 9~12자리로 입력하세요.</div>
                    )}
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

                <div className="h-3" />

                {/* 하단 고정 CTA */}
                <div className="sticky bottom-0 left-0 right-0 bg-white pt-2">
                  <button
                    type="submit"
                    disabled={!canNext}
                    className={`w-full h-12 rounded-xl text-white font-semibold ${
                      canNext ? "bg-violet-600 hover:bg-violet-700" : "bg-violet-300 cursor-not-allowed"
                    }`}
                  >
                    다음
                  </button>
                </div>
              </form>
            )}

            {/* STEP 2 */}
            {step === 2 && (
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
                    className={`rounded-xl px-5 py-2.5 text-white font-semibold leading-tight ${
                      submitting || !agreePrivacy
                        ? "bg-violet-300 cursor-not-allowed"
                        : "bg-violet-600 hover:bg-violet-700"
                    }`}
                    style={{ minWidth: 92 }}
                  >
                    <span className="block">문의</span>
                    <span className="block">접수</span>
                  </button>
                </div>

                {errorMsg && <div className="text-[13px] text-red-600">{errorMsg}</div>}

                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="h-12 rounded-xl bg-gray-100 text-gray-800 font-medium"
                  >
                    이전
                  </button>
                  <button
                    type="button"
                    onClick={() => !submitting && onClose()}
                    className="h-12 rounded-xl bg-black text-white font-semibold"
                  >
                    취소
                  </button>
                </div>

                <div className={`${NOTE} mt-1`}>※ 계약 시점의 운영사 정책에 따라 단가가 변경 될 수 있습니다.</div>
              </form>
            )}
          </div>
        </div>
      </div>

      {/* 개인정보 처리방침 모달 */}
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
