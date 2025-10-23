import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import BottomSheet from "./BottomSheet";

type InquiryKind = "SEAT" | "PACKAGE";
type CampaignType = "기업" | "공공" | "병원" | "소상공인" | "광고대행사";

type Prefill = {
  apt_id?: string | null;
  apt_name?: string | null;
  product_code?: string | null;
  product_name?: string | null;
  cart_snapshot?: any | null;
};

type Props = {
  open: boolean;
  mode: InquiryKind;
  onClose: () => void;
  prefill?: Prefill;
  sourcePage?: string;
  onSubmitted?: (rowId: string) => void;
};

const INPUT_BASE =
  "w-full rounded-xl border border-gray-200 px-4 py-3 outline-none focus:ring-2 focus:ring-violet-400 text-base";
const LABEL = "text-sm font-semibold text-gray-700 mb-1.5";
const READ = "text-sm text-gray-500";

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
      const n = Number(
        it?.itemTotalWon ?? it?.item_total_won ?? it?.totalWon ?? it?.total_won ?? 0
      );
      return acc + (isFinite(n) ? n : 0);
    }, 0);
    return sum > 0 ? sum : null;
  }
  return null;
}

export default function MobileInquirySheet({
  open,
  mode,
  prefill,
  onClose,
  sourcePage,
  onSubmitted,
}: Props) {
  const [brand, setBrand] = useState("");
  const [campaignType, setCampaignType] = useState<CampaignType | "">(""); 
  const [managerName, setManagerName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [hopeDate, setHopeDate] = useState<string>("");
  const [requestText, setRequestText] = useState("");
  const [promoCode, setPromoCode] = useState("");
  const [agreePrivacy, setAgreePrivacy] = useState(false);
  const [policyOpen, setPolicyOpen] = useState(false);
  const [successOpen, setSuccessOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const page = useMemo(() => {
    if (sourcePage) return sourcePage;
    if (typeof window !== "undefined") return window.location.pathname;
    return "/";
  }, [sourcePage]);

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

  const isSeat = mode === "SEAT";

  function handlePhoneChange(v: string) {
    const digitsOnly = v.replace(/\D/g, "");
    setPhone(digitsOnly);
  }

  function deriveSeatSummary() {
    const snap: any = prefill?.cart_snapshot || null;
    const items: any[] = Array.isArray(snap?.items) ? snap.items : [];

    const topAptName: string = items[0]?.apt_name ?? prefill?.apt_name ?? "-";
    const aptCount: number = items.length > 0 ? items.length : prefill?.apt_name ? 1 : 0;
    const aptLabel = aptCount > 1 ? `${topAptName} 외 ${aptCount - 1}개 단지` : topAptName;

    const firstItem = items[0] ?? null;
    const firstProduct =
      firstItem?.product_name ??
      firstItem?.product_code ??
      prefill?.product_name ??
      prefill?.product_code ??
      "-";

    const uniqueProducts = new Set<string>();
    if (items.length > 0) {
      items.forEach((i) => {
        const key = i?.product_name ?? i?.product_code ?? "";
        if (key) uniqueProducts.add(String(key));
      });
    } else {
      const key = prefill?.product_name ?? prefill?.product_code ?? "";
      if (key) uniqueProducts.add(String(key));
    }
    const productLabel = uniqueProducts.size >= 2 ? `${firstProduct} 외` : firstProduct;

    const monthSet = new Set<number>();
    let monthsMaxFromItems = 0;
    if (items.length > 0) {
      items.forEach((i) => {
        const n = Number(i?.months ?? 0);
        if (isFinite(n) && n > 0) {
          monthSet.add(n);
          if (n > monthsMaxFromItems) monthsMaxFromItems = n;
        }
      });
    }
    const fallbackMonths = Number(snap?.months ?? 0);
    if (monthSet.size === 0 && isFinite(fallbackMonths) && fallbackMonths > 0) {
      monthSet.add(fallbackMonths);
      monthsMaxFromItems = fallbackMonths;
    }

    const months: number | null = monthsMaxFromItems > 0 ? monthsMaxFromItems : null;
    const monthsLabel = months ? `${months}개월${monthSet.size >= 2 ? " 등" : ""}` : "-";

    const totalFromCart = pickCartTotal(snap);
    const totalLabel = fmtWon(totalFromCart);

    return { aptLabel, productLabel, monthsLabel, totalLabel };
  }

  const summary = isSeat ? deriveSeatSummary() : null;

  async function handleSubmit() {
    setErrorMsg(null);

    if (!required(brand)) {
      setErrorMsg("브랜드명을 입력해주세요.");
      return;
    }
    if (!campaignType) {
      setErrorMsg("캠페인 유형을 선택해주세요.");
      return;
    }
    if (!required(managerName)) {
      setErrorMsg("담당자명을 입력해주세요.");
      return;
    }
    if (!required(phone)) {
      setErrorMsg("연락처를 입력해주세요.");
      return;
    }
    if (!agreePrivacy) {
      setErrorMsg("개인정보 수집 및 이용에 동의해주세요.");
      return;
    }

    setSubmitting(true);
    try {
      const row: any = {
        brand_name: brand.trim(),
        campaign_type: campaignType,
        manager_name: managerName.trim(),
        phone: phone.trim(),
        email: email.trim() || null,
        hope_date: hopeDate || null,
        request_text: requestText.trim() || null,
        promo_code: promoCode.trim() || null,
        apt_id: prefill?.apt_id || null,
        apt_name: prefill?.apt_name || null,
        product_code: prefill?.product_code || null,
        product_name: prefill?.product_name || null,
        cart_snapshot: prefill?.cart_snapshot || null,
        inquiry_kind: mode,
        source_page: page,
        utm_params: getUTM(),
      };

      const { data, error } = await supabase
        .from("inquiries" as any)
        .insert(row)
        .select("id")
        .single();

      if (error) throw error;
      setSuccessOpen(true);
      const resultData = data as any;
      if (resultData?.id && onSubmitted) {
        onSubmitted(String(resultData.id));
      }
    } catch (err: any) {
      console.error("❌ 문의 등록 실패:", err);
      setErrorMsg(err?.message || "문의 등록에 실패했습니다.");
    } finally {
      setSubmitting(false);
    }
  }

  const handleSuccessClose = () => {
    setSuccessOpen(false);
    onClose();
  };

  return (
    <>
      {/* Main Inquiry Sheet */}
      <BottomSheet open={open && !policyOpen && !successOpen} onClose={onClose} maxHeightPx={Math.floor(window.innerHeight * 0.9)}>
        <div className="px-5 pb-6">
          {/* Header */}
          <div className="mb-6">
            <h2 className="text-xl font-bold text-gray-900 mb-2">
              {isSeat ? "구좌 광고 문의" : "패키지 광고 문의"}
            </h2>
            <p className="text-sm text-gray-600">
              {isSeat
                ? "선택하신 구좌에 대한 견적을 확인하고 문의를 남겨주세요."
                : "아파트 광고 패키지에 대한 문의를 남겨주세요."}
            </p>
          </div>

          {/* SEAT Summary Box */}
          {isSeat && summary && (
            <div className="mb-6 p-4 bg-violet-50 rounded-xl border border-violet-100">
              <div className="text-sm font-semibold text-gray-700 mb-3">문의 내용</div>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">단지명</span>
                  <span className="text-sm font-medium text-gray-900">{summary.aptLabel}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">상품</span>
                  <span className="text-sm font-medium text-gray-900">{summary.productLabel}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">광고기간</span>
                  <span className="text-sm font-medium text-gray-900">{summary.monthsLabel}</span>
                </div>
                <div className="flex justify-between pt-2 border-t border-violet-200">
                  <span className="text-sm font-semibold text-gray-700">총 비용</span>
                  <span className="text-base font-bold text-violet-600">{summary.totalLabel}</span>
                </div>
              </div>
            </div>
          )}

          {/* Form */}
          <div className="space-y-4">
            {/* Brand Name */}
            <div>
              <label className={LABEL}>
                브랜드명 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                className={INPUT_BASE}
                placeholder="브랜드명을 입력하세요"
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
              />
            </div>

            {/* Campaign Type */}
            <div>
              <label className={LABEL}>
                캠페인 유형 <span className="text-red-500">*</span>
              </label>
              <select
                className={INPUT_BASE}
                value={campaignType}
                onChange={(e) => setCampaignType(e.target.value as CampaignType)}
              >
                <option value="">선택하세요</option>
                <option value="기업">기업</option>
                <option value="공공">공공</option>
                <option value="병원">병원</option>
                <option value="소상공인">소상공인</option>
                <option value="광고대행사">광고대행사</option>
              </select>
            </div>

            {/* Manager Name */}
            <div>
              <label className={LABEL}>
                담당자명 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                className={INPUT_BASE}
                placeholder="담당자명을 입력하세요"
                value={managerName}
                onChange={(e) => setManagerName(e.target.value)}
              />
            </div>

            {/* Phone */}
            <div>
              <label className={LABEL}>
                연락처 <span className="text-red-500">*</span>
              </label>
              <input
                type="tel"
                inputMode="numeric"
                className={INPUT_BASE}
                placeholder="숫자만 입력 (예: 01012345678)"
                value={phone}
                onChange={(e) => handlePhoneChange(e.target.value)}
              />
            </div>

            {/* Email */}
            <div>
              <label className={LABEL}>이메일 (선택)</label>
              <input
                type="email"
                inputMode="email"
                className={INPUT_BASE}
                placeholder="이메일 주소"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            {/* Hope Date */}
            <div>
              <label className={LABEL}>광고 송출 예정(희망)일 (선택)</label>
              <input
                type="date"
                className={INPUT_BASE}
                value={hopeDate}
                onChange={(e) => setHopeDate(e.target.value)}
              />
            </div>

            {/* Request Text */}
            <div>
              <label className={LABEL}>요청사항 (선택)</label>
              <textarea
                className={INPUT_BASE}
                rows={4}
                placeholder="요청사항을 입력하세요"
                value={requestText}
                onChange={(e) => setRequestText(e.target.value)}
              />
            </div>

            {/* Promo Code */}
            <div>
              <label className={LABEL}>프로모션 코드 (선택)</label>
              <input
                type="text"
                className={INPUT_BASE}
                placeholder="프로모션 코드를 입력하세요"
                value={promoCode}
                onChange={(e) => setPromoCode(e.target.value)}
              />
            </div>

            {/* Privacy Agreement */}
            <div className="pt-4">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  className="mt-1 h-5 w-5 rounded border-gray-300 text-violet-600 focus:ring-violet-500"
                  checked={agreePrivacy}
                  onChange={(e) => setAgreePrivacy(e.target.checked)}
                />
                <span className="text-sm text-gray-700">
                  <span className="text-red-500">* </span>
                  개인정보 수집 및 이용에 동의합니다.{" "}
                  <button
                    type="button"
                    className="text-violet-600 underline"
                    onClick={() => setPolicyOpen(true)}
                  >
                    상세보기
                  </button>
                </span>
              </label>
            </div>

            {/* Error Message */}
            {errorMsg && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
                {errorMsg}
              </div>
            )}

            {/* Submit Button */}
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
              className="w-full py-4 bg-violet-600 text-white font-semibold rounded-xl hover:bg-violet-700 active:bg-violet-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-base"
            >
              {submitting ? "전송 중..." : "문의하기"}
            </button>
          </div>
        </div>
      </BottomSheet>

      {/* Policy Sheet */}
      <BottomSheet open={policyOpen} onClose={() => setPolicyOpen(false)}>
        <div className="px-5 pb-6">
          <h3 className="text-lg font-bold mb-4">개인정보 수집 및 이용 동의</h3>
          <div className="text-sm text-gray-700 space-y-3 leading-relaxed">
            <p>
              <strong>1. 수집 항목:</strong> 브랜드명, 캠페인 유형, 담당자명, 연락처, 이메일,
              광고 송출 예정일, 요청사항, 프로모션 코드
            </p>
            <p>
              <strong>2. 수집 목적:</strong> 광고 문의 접수 및 상담 진행
            </p>
            <p>
              <strong>3. 보유 기간:</strong> 문의 처리 완료 후 1년
            </p>
            <p className="text-xs text-gray-500">
              위 개인정보 수집에 동의하지 않을 수 있으며, 동의하지 않을 경우 문의 서비스 이용이
              제한될 수 있습니다.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setPolicyOpen(false)}
            className="w-full mt-6 py-3 bg-gray-200 text-gray-800 font-medium rounded-xl hover:bg-gray-300 transition-colors"
          >
            닫기
          </button>
        </div>
      </BottomSheet>

      {/* Success Sheet */}
      <BottomSheet open={successOpen} onClose={handleSuccessClose}>
        <div className="px-5 pb-6 text-center">
          <div className="mb-4 text-5xl">✅</div>
          <h3 className="text-xl font-bold mb-2">문의가 접수되었습니다</h3>
          <p className="text-sm text-gray-600 mb-6">
            빠른 시일 내에 담당자가 연락드리겠습니다.
          </p>
          <button
            type="button"
            onClick={handleSuccessClose}
            className="w-full py-4 bg-violet-600 text-white font-semibold rounded-xl hover:bg-violet-700 active:bg-violet-800 transition-colors"
          >
            확인
          </button>
        </div>
      </BottomSheet>
    </>
  );
}
