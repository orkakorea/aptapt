import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../integrations/supabase/client";

type InquiryKind = "SEAT" | "PACKAGE";
type CampaignType = "기업" | "공공" | "병원" | "소상공인" | "광고대행사";

type Prefill = {
  apt_id?: string | null;
  apt_name?: string | null;
  product_code?: string | null; // 예: ELEVATOR_TV / TOWNBORD_S ...
  product_name?: string | null;
  // 선택한 장바구니/견적 요약을 그대로 저장(관리자가 보기 편함)
  cart_snapshot?: any | null;
};

type Props = {
  open: boolean;
  mode: InquiryKind; // "SEAT" = 구좌, "PACKAGE" = 패키지
  onClose: () => void;
  prefill?: Prefill; // SEAT에서만 주로 사용
  sourcePage?: string; // 기본: window.location.pathname
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

export default function InquiryModal({
  open,
  mode,
  prefill,
  onClose,
  sourcePage,
  onSubmitted,
}: Props) {
  // 공통/패키지 필드
  const [brand, setBrand] = useState(""); // 브랜드명(필수)
  const [campaignType, setCampaignType] = useState<CampaignType | "">(""); // 캠페인유형(필수)
  const [managerName, setManagerName] = useState(""); // 담당자명(필수)
  const [phone, setPhone] = useState(""); // 연락처(숫자만)
  const [email, setEmail] = useState(""); // 이메일(선택)
  const [hopeDate, setHopeDate] = useState<string>(""); // 광고 송출 예정(희망)일
  const [requestText, setRequestText] = useState(""); // 요청사항(선택)
  const [promoCode, setPromoCode] = useState(""); // 프로모션 코드(선택)

  // 체크박스(둘 다 선택형, 제출 필수 아님)
  const [agreePrivacy, setAgreePrivacy] = useState(false); // 개인정보 수집·이용 동의
  const [agreeMarketing, setAgreeMarketing] = useState(false); // 광고안내 수신 동의

  // (SEAT 모드와 호환 위해 구필드 유지)
  const [company, setCompany] = useState(""); // 좌석 문의 레이아웃 호환
  const [memo, setMemo] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  const page = useMemo(() => {
    if (sourcePage) return sourcePage;
    if (typeof window !== "undefined") return window.location.pathname;
    return "/";
  }, [sourcePage]);

  useEffect(() => {
    if (!open) {
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
      setAgreeMarketing(false);
      setCompany("");
      setMemo("");

      setSubmitting(false);
      setErrorMsg(null);
      setOkMsg(null);
    }
  }, [open]);

  if (!open) return null;

  const isSeat = mode === "SEAT";

  // 연락처: 숫자만 허용
  function handlePhoneChange(v: string) {
    const digitsOnly = v.replace(/\D/g, "");
    setPhone(digitsOnly);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    setOkMsg(null);

    // --- 기본 검증 (모드별)
    if (isSeat) {
      // 기존 SEAT 필드 검증 (최소 요건)
      if (!required(managerName)) return setErrorMsg("이름(담당자명)을 입력해 주세요.");
      if (!required(phone)) return setErrorMsg("연락처를 입력해 주세요.");
    } else {
      // PACKAGE 요구사항 반영
      if (!required(brand)) return setErrorMsg("브랜드명을 입력해 주세요.");
      if (!required(campaignType)) return setErrorMsg("캠페인유형을 선택해 주세요.");
      if (!required(managerName)) return setErrorMsg("담당자명을 입력해 주세요.");
      if (!required(phone)) return setErrorMsg("연락처를 입력해 주세요.");
    }

    try {
      setSubmitting(true);
      const utm = getUTM();

      // extra 필드로 신규 스키마 안전하게 적재
      const extra: Record<string, any> = {
        brand: brand || null,
        campaign_type: campaignType || null,
        manager_name: managerName || null,
        hope_date: hopeDate || null,
        request_text: requestText || null,
        promo_code: promoCode || null,
        agree_privacy: agreePrivacy,
        agree_marketing: agreeMarketing,
      };

      const payload: any = {
        inquiry_kind: mode, // 'SEAT' | 'PACKAGE'
        // 기존 테이블 호환 필드
        customer_name: managerName || null,
        phone: phone || null,
        company: brand || company || null,
        email: email || null,
        memo: requestText || memo || null,
        source_page: page,
        utm, // jsonb
        // 아래는 SEAT(구좌)일 때만 전달
        apt_id: isSeat ? (prefill?.apt_id ?? null) : null,
        apt_name: isSeat ? (prefill?.apt_name ?? null) : null,
        product_code: isSeat ? (prefill?.product_code ?? null) : null,
        product_name: isSeat ? (prefill?.product_name ?? null) : null,
        cart_snapshot: isSeat ? (prefill?.cart_snapshot ?? null) : null,
        // 신규 요구사항을 안전하게 담는 컨테이너
        extra,
      };

      const { error } = await (supabase as any).from("inquiries").insert(payload);
      if (error) throw error;

      setOkMsg("접수가 완료되었습니다. 담당자가 곧 연락드리겠습니다.");
      onSubmitted?.("ok"); // id가 꼭 필요 없으면 이렇게 처리
    } catch (err: any) {
      setErrorMsg(err?.message || "제출 중 오류가 발생했습니다.");
    } finally {
      setSubmitting(false);
    }
  }

  // —————————— UI ——————————
  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40"
        onClick={() => !submitting && onClose()}
      />
      {/* Panel */}
      <div className="relative z-[1001] w-[720px] max-w-[92vw] rounded-2xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
          <div>
            <div className="text-lg font-bold">
              {isSeat ? "구좌(T.O) 문의" : "시,군,구 동 단위 / 패키지문의"}
            </div>
            <div className="text-xs text-gray-500 mt-1">
              {isSeat
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
          {isSeat && (
            <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
              <div className="text-sm font-semibold mb-2">선택 요약</div>
              <div className="grid grid-cols-2 gap-3 text-[13px]">
                <div className="flex flex-col">
                  <span className={READ}>단지명</span>
                  <span className="font-medium">{prefill?.apt_name ?? "-"}</span>
                </div>
                <div className="flex flex-col">
                  <span className={READ}>상품명</span>
                  <span className="font-medium">
                    {prefill?.product_name ?? prefill?.product_code ?? "-"}
                  </span>
                </div>
                {prefill?.cart_snapshot?.months && (
                  <div className="flex flex-col">
                    <span className={READ}>광고기간</span>
                    <span className="font-medium">{prefill?.cart_snapshot?.months}개월</span>
                  </div>
                )}
                {prefill?.cart_snapshot?.totalWon && (
                  <div className="flex flex-col">
                    <span className={READ}>예상 총광고료</span>
                    <span className="font-medium">
                      {Number(prefill?.cart_snapshot?.totalWon).toLocaleString()}원 (VAT별도)
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ===== 패키지 문의 레이아웃 ===== */}
          {!isSeat && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className={LABEL}>브랜드명 *</div>
                  <input
                    className={INPUT_BASE}
                    placeholder="오르카 코리아"
                    value={brand}
                    onChange={(e) => setBrand(e.target.value)}
                  />
                </div>

                <div>
                  <div className={LABEL}>캠페인유형 *</div>
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
                  <div className={LABEL}>담당자명 *</div>
                  <input
                    className={INPUT_BASE}
                    placeholder="홍길동"
                    value={managerName}
                    onChange={(e) => setManagerName(e.target.value)}
                  />
                </div>

                <div>
                  <div className={LABEL}>연락처 *</div>
                  <input
                    className={INPUT_BASE}
                    inputMode="numeric"
                    placeholder="01012345678"
                    value={phone}
                    onChange={(e) => handlePhoneChange(e.target.value)}
                  />
                </div>

                <div>
                  <div className={LABEL}>이메일 (선택)</div>
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
                <div className={LABEL}>요청사항 (선택)</div>
                <textarea
                  className={`${INPUT_BASE} h-28 resize-none`}
                  placeholder="관심 상품/예산/지역/기간 등을 적어주세요."
                  value={requestText}
                  onChange={(e) => setRequestText(e.target.value)}
                />
              </div>

              <div>
                <div className={LABEL}>프로모션 코드 (선택)</div>
                <input
                  className={INPUT_BASE}
                  placeholder="예: ORCA2024"
                  value={promoCode}
                  onChange={(e) => setPromoCode(e.target.value)}
                />
              </div>
            </>
          )}

          {/* ===== 기존 SEAT 레이아웃(호환 유지) ===== */}
          {isSeat && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className={LABEL}>이름 *</div>
                  <input
                    className={INPUT_BASE}
                    placeholder="홍길동"
                    value={managerName}
                    onChange={(e) => setManagerName(e.target.value)}
                  />
                </div>
                <div>
                  <div className={LABEL}>연락처 *</div>
                  <input
                    className={INPUT_BASE}
                    inputMode="numeric"
                    placeholder="01012345678"
                    value={phone}
                    onChange={(e) => handlePhoneChange(e.target.value)}
                  />
                </div>
                <div>
                  <div className={LABEL}>회사/브랜드</div>
                  <input
                    className={INPUT_BASE}
                    placeholder="오르카 코리아"
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                  />
                </div>
                <div>
                  <div className={LABEL}>이메일</div>
                  <input
                    className={INPUT_BASE}
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <div className={LABEL}>요청사항</div>
                <textarea
                  className={`${INPUT_BASE} h-28 resize-none`}
                  placeholder="요청사항을 적어주세요. (예: 집행 희망일, 예산 범위, 크리에이티브 유무 등)"
                  value={memo}
                  onChange={(e) => setMemo(e.target.value)}
                />
              </div>
            </>
          )}

          {errorMsg && <div className="text-[13px] text-red-600">{errorMsg}</div>}
          {okMsg && <div className="text-[13px] text-emerald-600">{okMsg}</div>}

          {/* 하단 정보 + 체크박스 2개 (한 줄 배치) */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4 flex-wrap">
              <div className="text-[11px] text-gray-500 mr-2 whitespace-nowrap">
                개인정보는 문의 상담 목적 외에는 사용하지 않습니다.
              </div>
              <label className="flex items-center gap-2 text-[12px] text-gray-700 whitespace-nowrap">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-gray-300"
                  checked={agreePrivacy}
                  onChange={(e) => setAgreePrivacy(e.target.checked)}
                />
                개인정보 수집·이용 동의
              </label>
              <label className="flex items-center gap-2 text-[12px] text-gray-700 whitespace-nowrap">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-gray-300"
                  checked={agreeMarketing}
                  onChange={(e) => setAgreeMarketing(e.target.checked)}
                />
                광고안내 수신 동의(선택)
              </label>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className={`rounded-xl px-5 py-3 text-white font-semibold ${
                submitting ? "bg-violet-300" : "bg-violet-600 hover:bg-violet-700"
              }`}
            >
              {submitting ? "전송 중..." : "문의 접수"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
