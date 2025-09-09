import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../integrations/supabase/client";

type InquiryKind = "SEAT" | "PACKAGE";

type Prefill = {
  apt_id?: string | null;
  apt_name?: string | null;
  product_code?: string | null;   // 예: ELEVATOR_TV / TOWNBORD_S ...
  product_name?: string | null;
  // 선택한 장바구니/견적 요약을 그대로 저장(관리자가 보기 편함)
  cart_snapshot?: any | null;
};

type Props = {
  open: boolean;
  mode: InquiryKind;          // "SEAT" = 구좌, "PACKAGE" = 패키지
  onClose: () => void;
  prefill?: Prefill;          // SEAT에서만 주로 사용
  sourcePage?: string;        // 기본: window.location.pathname
  onSubmitted?: (rowId: string) => void;
};

const INPUT_BASE =
  "w-full rounded-xl border border-gray-200 px-4 py-3 outline-none focus:ring-2 focus:ring-violet-400 text-sm";

const LABEL =
  "text-[13px] font-semibold text-gray-700 mb-1";

const READ =
  "text-[13px] text-gray-500";

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

export default function InquiryModal({
  open,
  mode,
  prefill,
  onClose,
  sourcePage,
  onSubmitted,
}: Props) {
  const [customer_name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [company, setCompany] = useState("");
  const [email, setEmail] = useState("");
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
      setName("");
      setPhone("");
      setCompany("");
      setEmail("");
      setMemo("");
      setSubmitting(false);
      setErrorMsg(null);
      setOkMsg(null);
    }
  }, [open]);

  if (!open) return null;

  const isSeat = mode === "SEAT";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    setOkMsg(null);

    // --- 기본 검증
    if (!required(customer_name)) return setErrorMsg("이름을 입력해 주세요.");
    if (!required(phone)) return setErrorMsg("연락처를 입력해 주세요.");

    try {
      setSubmitting(true);
      const utm = getUTM();

      const payload: any = {
        inquiry_kind: mode,              // 'SEAT' | 'PACKAGE'
        customer_name,
        phone,
        company: company || null,
        email: email || null,
        memo: memo || null,
        source_page: page,
        utm,                             // jsonb
        // 아래는 SEAT(구좌)일 때만 전달
        apt_id: isSeat ? (prefill?.apt_id ?? null) : null,
        apt_name: isSeat ? (prefill?.apt_name ?? null) : null,
        product_code: isSeat ? (prefill?.product_code ?? null) : null,
        product_name: isSeat ? (prefill?.product_name ?? null) : null,
        cart_snapshot: isSeat ? (prefill?.cart_snapshot ?? null) : null,
      };

      const { data, error } = await (supabase as any)
        .from("inquiries")
        .insert(payload)
        .select("id")
        .single();

      if (error) throw error;

      setOkMsg("접수가 완료되었습니다. 담당자가 곧 연락드리겠습니다.");
      if (onSubmitted && data?.id) onSubmitted(data.id);
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
      <div className="relative z-[1001] w-[680px] max-w-[92vw] rounded-2xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
          <div>
            <div className="text-lg font-bold">
              {isSeat ? "구좌(T.O) 문의" : "패키지 문의"}
            </div>
            <div className="text-xs text-gray-500 mt-1">
              {isSeat
                ? "선택하신 단지/상품 정보를 포함해 접수됩니다."
                : "희망 상품/예산/지역 등을 메모로 알려주시면 빠르게 제안드립니다."}
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
                  <span className="font-medium">{prefill?.product_name ?? prefill?.product_code ?? "-"}</span>
                </div>
                {/* cart_snapshot에 총액/개월수 등이 있다면 보여주기 */}
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

          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className={LABEL}>이름 *</div>
              <input
                className={INPUT_BASE}
                placeholder="홍길동"
                value={customer_name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div>
              <div className={LABEL}>연락처 *</div>
              <input
                className={INPUT_BASE}
                placeholder="010-1234-5678"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
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
            <div className={LABEL}>메모</div>
            <textarea
              className={`${INPUT_BASE} h-28 resize-none`}
              placeholder={
                isSeat
                  ? "요청사항을 적어주세요. (예: 집행 희망일, 예산 범위, 크리에이티브 유무 등)"
                  : "관심 상품/예산/지역/기간 등을 적어주세요."
              }
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
            />
          </div>

          {errorMsg && (
            <div className="text-[13px] text-red-600">{errorMsg}</div>
          )}
          {okMsg && (
            <div className="text-[13px] text-emerald-600">{okMsg}</div>
          )}

          <div className="flex items-center justify-between">
            <div className="text-[11px] text-gray-500">
              개인정보는 문의 상담 목적 외에는 사용하지 않습니다.
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
