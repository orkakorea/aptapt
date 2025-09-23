import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

type InquiryKind = "SEAT" | "PACKAGE";
type CampaignType = "기업" | "공공" | "병원" | "소상공인" | "광고대행사";

type Prefill = {
  apt_id?: string | null;
  apt_name?: string | null;
  product_code?: string | null;
  product_name?: string | null;
  // 1탭 총액 및 다중선택을 담는 스냅샷 (필드명은 유연하게 수용)
  cart_snapshot?: any | null;
};

type Props = {
  open: boolean;
  mode: InquiryKind;          // "SEAT" | "PACKAGE"
  onClose: () => void;
  prefill?: Prefill;
  sourcePage?: string;
  onSubmitted?: (rowId: string) => void;
};

const INPUT_BASE =
  "w-full rounded-xl border border-gray-200 px-4 py-3 outline-none focus:ring-2 focus:ring-violet-400 text-sm";
const LABEL = "text-[13px] font-semibold text-gray-700 mb-1";
const READ  = "text-[13px] text-gray-500";

function getUTM() {
  if (typeof window === "undefined") return null;
  const p = new URLSearchParams(window.location.search);
  const keys = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"];
  const o: Record<string, string> = {};
  let has = false;
  keys.forEach((k) => {
    const v = p.get(k);
    if (v) { o[k] = v; has = true; }
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

/** cart_snapshot에서 1탭 '총 비용' 값을 최대한 정확히 꺼내오기 (여러 필드명 호환) */
function pickCartTotal(snap: any): number | null {
  if (!snap) return null;
  const candidates = [
    snap.cartTotal, snap.cart_total, snap.cartTotalWon, snap.cart_total_won,
    snap.grandTotal, snap.grand_total,
    snap.totalWon, snap.total_won, snap.total,
  ];
  for (const c of candidates) {
    const n = Number(c);
    if (isFinite(n) && n > 0) return n;
  }
  // items 합계(각 item의 총액 필드명도 다양하게 대응)
  if (Array.isArray(snap.items) && snap.items.length > 0) {
    const sum = snap.items.reduce((acc: number, it: any) => {
      const n = Number(it?.itemTotalWon ?? it?.item_total_won ?? it?.totalWon ?? it?.total_won ?? 0);
      return acc + (isFinite(n) ? n : 0);
    }, 0);
    return sum > 0 ? sum : null;
  }
  return null;
}

export default function InquiryModal({
  open,
  mode,
  prefill,
  onClose,
  sourcePage,
  onSubmitted,
}: Props) {
  // ===== 공통 입력(패키지/구좌 동일 레이아웃로 통일) =====
  const [brand, setBrand] = useState("");                         // 브랜드명(필수)
  const [campaignType, setCampaignType] = useState<CampaignType | "">(""); // 캠페인유형(필수)
  const [managerName, setManagerName] = useState("");             // 담당자명(필수)
  const [phone, setPhone] = useState("");                         // 연락처(숫자만)
  const [email, setEmail] = useState("");                         // 이메일(선택)
  const [hopeDate, setHopeDate] = useState<string>("");           // 광고 송출 예정(희망)일
  const [requestText, setRequestText] = useState("");             // 요청사항(선택)
  const [promoCode, setPromoCode] = useState("");                 // 프로모션 코드(선택)

  // 체크박스(필수 1개만 유지: 개인정보 수집·이용 동의)
  const [agreePrivacy, setAgreePrivacy] = useState(false);

  // 정책/완료 모달
  const [policyOpen, setPolicyOpen] = useState(false);
  const [successOpen, setSuccessOpen] = useState(false);

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

      setSubmitting(false);
      setErrorMsg(null);
      setOkMsg(null);
      setPolicyOpen(false);
      setSuccessOpen(false);
    }
  }, [open]);

  if (!open) return null;
  const isSeat = mode === "SEAT";

  // 연락처: 숫자만 허용
  function handlePhoneChange(v: string) {
    const digitsOnly = v.replace(/\D/g, "");
    setPhone(digitsOnly);
  }

  // ====== SEAT "문의 내용" 박스 파생값 ======
  function deriveSeatSummary() {
    const snap: any = prefill?.cart_snapshot || null;
    const items: any[] = Array.isArray(snap?.items) ? snap.items : [];

    // 최상위 단지명
    const topAptName: string =
      items[0]?.apt_name ?? prefill?.apt_name ?? "-";

    // 단지 수
    const aptCount: number =
      items.length > 0 ? items.length : (prefill?.apt_name ? 1 : 0);

    const aptLabel =
      aptCount > 1 ? `${topAptName} 외 ${aptCount - 1}개 단지` : topAptName;

    // 1) 상품명 요약: 첫 상품명(또는 코드) + (유니크 2개 이상이면 " 외")
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
    const productLabel =
      uniqueProducts.size >= 2 ? `${firstProduct} 외` : firstProduct;

    // 2) 광고기간 요약:
    // - 아이템마다 기간이 다를 수 있으므로, 유니크 개수 파악
    // - 최댓값 months + (서로 다르면 " 등")
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
    const monthsLabel =
      months ? `${months}개월${monthSet.size >= 2 ? " 등" : ""}` : "-";

    // 예상 총광고료: 1탭 총액과 100% 일치하도록 pickCartTotal 사용
    const totalWon: number | null = pickCartTotal(snap);

    return { aptLabel, productLabel, months, monthsLabel, totalWon };
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    setOkMsg(null);

    // 패키지/구좌 모두 동일 검증 규칙 적용(요청사항)
    if (!required(brand)) return setErrorMsg("브랜드명을 입력해 주세요.");
    if (!required(campaignType)) return setErrorMsg("캠페인유형을 선택해 주세요.");
    if (!required(managerName)) return setErrorMsg("담당자명을 입력해 주세요.");
    if (!required(phone)) return setErrorMsg("연락처를 입력해 주세요.");

    // 체크박스 강제 조건
    if (!agreePrivacy) {
      return setErrorMsg("개인정보 수집·이용 동의를 체크해 주세요.");
    }

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
        // 기존 테이블 호환 필드 매핑 (company/memo는 내부적으로 brand/request 사용)
        customer_name: managerName || null,
        phone: phone || null,
        company: brand || null,
        email: email || null,
        memo: requestText || null,
        source_page: page,
        utm,
        // SEAT 전용 필드
        apt_id: isSeat ? (prefill?.apt_id ?? null) : null,
        apt_name: isSeat ? (prefill?.apt_name ?? null) : null,
        product_code: isSeat ? (prefill?.product_code ?? null) : null,
        product_name: isSeat ? (prefill?.product_name ?? null) : null,
        cart_snapshot: isSeat ? (prefill?.cart_snapshot ?? null) : null,
        // 신규 필드
        extra,
      };

      const { error } = await (supabase as any).from("inquiries").insert(payload);
      if (error) throw error;

      setOkMsg("접수가 완료되었습니다. 담당자가 곧 연락드리겠습니다.");
      onSubmitted?.("ok");
      setSuccessOpen(true); // 완료 모달
    } catch (err: any) {
      setErrorMsg(err?.message || "제출 중 오류가 발생했습니다.");
    } finally {
      setSubmitting(false);
    }
  }

  const submitDisabled = submitting || !agreePrivacy;

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
          {mode === "SEAT" && (() => {
            const s = deriveSeatSummary();
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

          {/* ===== 입력 폼 (패키지/구좌 동일) ===== */}
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
                <option value="" disabled>선택하세요</option>
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
              {/* 안내 사각박스 (흰색 배경 + 검은 테두리) */}
              <button
                type="button"
                className="px-3 py-2 text-[12px] rounded-md border border-black bg-white hover:bg-gray-50 whitespace-nowrap"
                onClick={() => setPolicyOpen(true)}
              >
                개인정보 수집·이용 정책 자세히보기
              </button>

              {/* 체크박스 1개 */}
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
              {/* 👉 실제 약관 전문으로 교체하세요 */}
              <p className="mb-3">
                오르카 코리아는 문의 접수 및 상담을 위해 최소한의 개인정보를 수집·이용하며, 목적 달성 후 지체 없이 파기합니다.
                수집 항목: 성명, 연락처, 이메일, 문의 내용 등. 보유·이용 기간: 문의 처리 완료 후 1년.
              </p>
              <p className="mb-3">
                필요한 경우 매체 운영사 등 협력사와의 상담/집행을 위해 최소한의 정보가 공유될 수 있습니다. 법령에 따른 고지·동의 절차를 준수합니다.
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

      {/* == 완료 모달 == */}
      {successOpen && (
        <div className="fixed inset-0 z-[1200] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" />
          <div className="relative z-[1201] w-[520px] max-w-[92vw] rounded-2xl bg-white shadow-2xl">
            <div className="flex justify-end p-4">
              <button
                className="rounded-full p-2 hover:bg-gray-50"
                onClick={() => {
                  setSuccessOpen(false);
                  onClose();
                }}
                aria-label="close-success"
              >
                <svg width="22" height="22" viewBox="0 0 24 24">
                  <path d="M6 6l12 12M18 6L6 18" stroke="#111" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            <div className="px-8 pb-8 -mt-6 flex flex-col items-center text-center">
              {/* 아이콘 */}
              <div className="w-16 h-16 rounded-full bg-violet-100 flex items-center justify-center mb-6">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                  <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10Z" fill="#7C3AED" opacity="0.15"/>
                  <path d="M8 12h8M8 15h5M9 8h6" stroke="#7C3AED" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </div>

              <div className="text-lg font-bold mb-2">
                {mode === "SEAT" ? "구좌문의가 완료되었습니다." : "광고문의가 완료되었습니다."}
              </div>
              <div className="text-[15px] text-gray-700 leading-7">
                영업일 기준 1~2일 이내로 담당자가 배정되어<br />답변드릴 예정입니다.
              </div>

              <button
                className="mt-10 w-full rounded-xl px-5 py-3 text-white font-semibold bg-violet-600 hover:bg-violet-700"
                onClick={() => {
                  setSuccessOpen(false);
                  onClose();
                }}
              >
                확인
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
