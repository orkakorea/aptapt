// src/components/mobile/DetailPanel.tsx
import React, { useEffect, useMemo, useState } from "react";
import type { SelectedApt } from "@/core/types";
import { fmtNum, fmtWon } from "@/core/utils";
import { DEFAULT_POLICY, rateFromRanges } from "@/core/pricing";
import type { DiscountPolicy } from "@/core/pricing";

const COLOR_PRIMARY = "#6F4BF2";
const COLOR_PRIMARY_LIGHT = "#EEE8FF";
const COLOR_GRAY_CARD = "#F4F6FA";

/* =========================================================================
 * 정적 에셋 베이스(PC와 동일 규칙) + 유틸
 * ========================================================================= */
const PRIMARY_ASSET_BASE = (import.meta as any).env?.VITE_ASSET_BASE || "/products/";
const FALLBACK_ASSET_BASE = (import.meta as any).env?.VITE_ASSET_BASE_FALLBACK || "";
const PLACEHOLDER = "/placeholder.svg";
const ELEVATOR_FILE = "elevator-tv.png";

const ensureSlash = (s: string) => (s.endsWith("/") ? s : s + "/");
const PRIMARY_BASE = ensureSlash(PRIMARY_ASSET_BASE);
const FALLBACK_BASE = FALLBACK_ASSET_BASE ? ensureSlash(FALLBACK_ASSET_BASE) : "";

/** 절대/루트 경로면 그대로 사용 */
const isAbsoluteLike = (s?: string) => !!s && /^(https?:|data:|\/)/i.test(s || "");
/** 파일명(or 부분경로)을 풀 URL로 변환(기본 primary 베이스) */
function toImageUrl(input?: string): string | undefined {
  if (!input) return undefined;
  if (isAbsoluteLike(input)) return input;
  return PRIMARY_BASE + input.replace(/^\/+/, "");
}

/** 파일명이 엘리베이터 기본인지 판별 */
const isElevatorFile = (p?: string) => !!p && /(^|\/)elevator-tv\.png$/i.test(p);

/** 문자열 정규화 */
const norm = (s?: string) => (s ? s.replace(/\s+/g, "").toLowerCase() : "");

type DiscountKey = keyof DiscountPolicy;

/** 상품/설치위치/자치구 → 할인정책 키 (PC MapChrome과 동일 로직) */
function classifyProductForPolicy(
  productName?: string,
  installLocation?: string | null,
  district?: string | null,
): DiscountKey | undefined {
  const pn = norm(productName);
  const loc = norm(installLocation ?? undefined);
  const d = (district ?? "").trim();

  if (!pn) return undefined;

  if (
    pn.includes("townbord_l") ||
    pn.includes("townboard_l") ||
    /\btownbord[-_\s]?l\b/.test(pn) ||
    /\btownboard[-_\s]?l\b/.test(pn)
  )
    return "TOWNBORD_L";

  if (
    pn.includes("townbord_s") ||
    pn.includes("townboard_s") ||
    /\btownbord[-_\s]?s\b/.test(pn) ||
    /\btownboard[-_\s]?s\b/.test(pn)
  )
    return "TOWNBORD_S";

  // ELEVATOR TV: 강남/서초/송파는 별도 정책(ELEVATOR TV_NOPD) 사용
  if (pn.includes("elevatortv") || pn.includes("엘리베이터tv") || pn.includes("elevator")) {
    if (d === "강남구" || d === "서초구" || d === "송파구") return "ELEVATOR TV_NOPD";
    return "ELEVATOR TV";
  }

  if (pn.includes("mediameet") || pn.includes("media-meet") || pn.includes("미디어")) return "MEDIA MEET";
  if (pn.includes("spaceliving") || pn.includes("스페이스") || pn.includes("living")) return "SPACE LIVING";
  if (pn.includes("hipost") || pn.includes("hi-post") || pn.includes("하이포스트")) return "HI-POST";

  if (pn.includes("townbord") || pn.includes("townboard") || pn.includes("타운보드")) {
    if (loc.includes("ev내부")) return "TOWNBORD_L";
    if (loc.includes("ev대기공간")) return "TOWNBORD_S";
    return "TOWNBORD_S";
  }

  return undefined;
}

/** 상품명 + 설치위치 → 파일명 (PC MapChrome.tsx와 동일 로직) */
function resolveProductFile(productName?: string, installLocation?: string): string | undefined {
  const pn = norm(productName);
  const loc = norm(installLocation);

  if (pn.includes("townbord") || pn.includes("townboard") || pn.includes("타운보드")) {
    if (loc.includes("ev내부")) return "townbord-a.png";
    if (loc.includes("ev대기공간")) return "townbord-b.png";
    return "townbord-a.png"; // 미지정 기본
  }

  if (pn.includes("mediameet") || pn.includes("media-meet") || pn.includes("미디어")) {
    if (loc.includes("ev내부")) return "media-meet-a.png";
    if (loc.includes("ev대기공간")) return "media-meet-b.png";
    return "media-meet-a.png"; // 미지정 기본
  }

  if (pn.includes("엘리베이터tv") || pn.includes("elevatortv") || pn.includes("elevator")) return "elevator-tv.png";
  if (pn.includes("hipost") || pn.includes("hi-post") || pn.includes("하이포스트")) return "hi-post.png";
  if (pn.includes("spaceliving") || pn.includes("스페이스") || pn.includes("living")) return "space-living.png";
  return undefined;
}

/** 안전하게 필드 꺼내기(여러 이름 대응) */
function getField(obj: any, keys: string[]) {
  for (const k of keys) {
    if (k in obj && obj[k] != null && obj[k] !== "") return obj[k];
  }
  return undefined;
}

export default function DetailPanel({
  selected,
  inCart,
  onToggleCart,
  onClose,
}: {
  selected: SelectedApt | null;
  inCart: boolean;
  onToggleCart: () => void;
  onClose?: () => void;
}) {
  if (!selected) {
    return <div className="text-center text-sm text-gray-500 py-6">지도의 단지를 선택하세요.</div>;
  }

  // 표시 텍스트(데이터 없을 때만 미상/하이픈)
  const displayedName: string =
    (getField(selected as any, ["name", "aptName", "name_kr", "단지명"]) as string) || "미상";

  const productForDisplay: string =
    (getField(selected as any, ["productName", "product_name", "product", "상품명"]) as string) || "-";

  const installLocRaw = getField(selected as any, ["installLocation", "설치위치"]) as string | undefined;
  const installLocForDisplay: string = installLocRaw || "-";
  const displayedAddress: string = (getField(selected as any, ["address", "주소"]) as string) || "-";

  // ✅ 할인정책 기준으로 월가/1년 월가 계산 (PC와 동일 컨셉)
  const district = getField(selected as any, ["district", "자치구"]) as string | undefined;
  const productKey = classifyProductForPolicy(productForDisplay, installLocRaw ?? null, district ?? null);

  const baseMonthly = selected.monthlyFee ?? 0;

  let monthlyDisplay = baseMonthly;
  let y1Monthly =
    typeof selected.monthlyFeeY1 === "number" && selected.monthlyFeeY1 > 0 ? selected.monthlyFeeY1 : baseMonthly;

  if (productKey) {
    const rules: any = (DEFAULT_POLICY as any)[productKey];

    // 월 광고료: 1개월 기준
    const pd1 = rateFromRanges(rules?.period, 1);
    const pc1 = rateFromRanges(rules?.precomp, 1);
    monthlyDisplay = Math.round(baseMonthly * (1 - pc1) * (1 - pd1));

    // 1년 계약 시 월 광고료: 12개월 기준
    const pdY1 = rateFromRanges(rules?.period, 12);
    const pcY1 = rateFromRanges(rules?.precomp, 12);
    y1Monthly = Math.round(baseMonthly * (1 - pcY1) * (1 - pdY1));
  }

  // 후보 1: selected.imageUrl (절대/루트면 그대로, 파일명이면 /products/)
  const candidateFromSelected =
    (getField(selected as any, ["imageUrl", "image_url", "이미지", "썸네일", "thumbnail"]) as string) || undefined;
  const candidateUrl = toImageUrl(candidateFromSelected);

  // 후보 2: 상품/설치위치로 계산한 파일명
  const mappedFile = resolveProductFile(
    getField(selected as any, ["productName", "product_name", "상품명"]) as string,
    installLocRaw as string,
  );
  const mappedUrl = toImageUrl(mappedFile);

  // ✅ 최종 선택 규칙
  const initialImg =
    (mappedUrl && (!candidateUrl || candidateUrl.endsWith(PLACEHOLDER) || isElevatorFile(candidateUrl))) ||
    (!candidateUrl && mappedUrl)
      ? mappedUrl
      : candidateUrl || mappedUrl || PLACEHOLDER;

  const [imgSrc, setImgSrc] = useState<string>(initialImg);
  const [fallbackTried, setFallbackTried] = useState<boolean>(false);

  // 선택 변경 시 이미지 초기화
  useEffect(() => {
    const cand =
      toImageUrl(
        (getField(selected as any, ["imageUrl", "image_url", "이미지", "썸네일", "thumbnail"]) as string) || undefined,
      ) || undefined;
    const mapd = toImageUrl(
      resolveProductFile(
        getField(selected as any, ["productName", "product_name", "상품명"]) as string,
        getField(selected as any, ["installLocation", "설치위치"]) as string,
      ),
    );
    const next =
      (mapd && (!cand || cand.endsWith(PLACEHOLDER) || isElevatorFile(cand))) || (!cand && mapd)
        ? mapd
        : cand || mapd || PLACEHOLDER;

    setImgSrc(next || PLACEHOLDER);
    setFallbackTried(false);
  }, [selected]);

  const onImgError: React.ReactEventHandler<HTMLImageElement> = () => {
    // 1) primary 베이스 사용 중이고 fallback 베이스가 있으면 fallback으로 재시도
    if (!fallbackTried && FALLBACK_BASE && imgSrc.startsWith(PRIMARY_BASE)) {
      const alt = imgSrc.replace(PRIMARY_BASE, FALLBACK_BASE);
      setFallbackTried(true);
      setImgSrc(alt);
      return;
    }
    // 2) 마지막으로 PLACEHOLDER
    if (imgSrc !== PLACEHOLDER) {
      setImgSrc(PLACEHOLDER);
    }
  };

  // 세대/거주 인원 보조 텍스트 (기존 UI 유지)
  const subline = useMemo(() => {
    return `${fmtNum(selected.households)} 세대 · ${fmtNum(selected.residents)} 명`;
  }, [selected.households, selected.residents]);

  return (
    <div className="space-y-3">
      {/* 상단 이미지 */}
      <div className="rounded-2xl overflow-hidden bg-gray-100 aspect-[4/3]">
        {imgSrc ? (
          <img src={imgSrc} alt={displayedName} className="w-full h-full object-cover" onError={onImgError} />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-400">이미지</div>
        )}
      </div>

      {/* 타이틀 + 닫기(X) */}
      <div className="flex items-start gap-3">
        <div className="flex-1">
          <div className="text-[20px] font-extrabold">{displayedName}</div>
          <div className="text-sm text-gray-500">{subline}</div>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            aria-label="닫기"
            title="닫기"
            className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center shrink-0"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <path d="M18.3 5.71a1 1 0 00-1.41 0L12 10.59 7.11 5.7A1 1 0 105.7 7.11L10.59 12l-4.9 4.89a1 1 0 101.41 1.42L12 13.41l4.89 4.9a1 1 0 001.42-1.42L13.41 12l4.9-4.89a1 1 0 000-1.4z" />
            </svg>
          </button>
        )}
      </div>

      {/* 가격 카드들 */}
      <div className="space-y-2">
        <div className="rounded-2xl px-4 py-3" style={{ backgroundColor: COLOR_GRAY_CARD }}>
          <div className="text-sm text-gray-600">월 광고료</div>
          <div className="text-[20px] font-extrabold">
            {fmtWon(monthlyDisplay)} <span className="text-xs text-gray-500">(VAT별도)</span>
          </div>
        </div>

        <div
          className="rounded-2xl px-4 py-3 border-2"
          style={{ borderColor: COLOR_PRIMARY, backgroundColor: COLOR_PRIMARY_LIGHT }}
        >
          <div className="text-sm text-gray-700">1년 계약 시 월 광고료</div>
          <div className="text-[20px] font-extrabold" style={{ color: COLOR_PRIMARY }}>
            {fmtWon(y1Monthly)} <span className="text-xs text-gray-500">(VAT별도)</span>
          </div>
        </div>
      </div>

      {/* 담기 버튼 */}
      <div className="pt-1">
        <button
          className={`w-full h-12 rounded-2xl font-extrabold ${inCart ? "text-gray-700" : "text-white"}`}
          style={{ backgroundColor: inCart ? "#E5E7EB" : COLOR_PRIMARY }}
          aria-pressed={inCart}
          onClick={onToggleCart}
        >
          {inCart ? "담기 취소" : "아파트 담기"}
        </button>
      </div>

      {/* 상세정보 테이블 */}
      <section className="mt-1">
        <div className="mb-2 text-[15px] font-extrabold">상세정보</div>
        <div className="rounded-2xl border overflow-hidden">
          <table className="w-full text-sm">
            <tbody className="[&_td]:px-4 [&_td]:py-3">
              <InfoRow label="상품명">
                <span style={{ color: COLOR_PRIMARY }} className="font-semibold">
                  {productForDisplay}
                </span>
              </InfoRow>
              <InfoRow label="설치 위치" value={installLocForDisplay} />
              <InfoRow label="모니터 수량" value={`${fmtNum(selected.monitors)} 대`} />
              <InfoRow label="월 송출횟수" value={`${fmtNum(selected.monthlyImpressions)} 회`} />
              <InfoRow label="송출 1회당 비용" value={`${fmtNum(selected.costPerPlay)} 원`} />
              <InfoRow label="운영 시간" value={selected.hours || "-"} />
              <InfoRow label="주소">
                <span className="whitespace-pre-line">{displayedAddress}</span>
              </InfoRow>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function InfoRow({ label, value, children }: { label: string; value?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <tr className="border-b last:border-b-0">
      <td className="text-gray-500 w-36 text-left">{label}</td>
      <td className="font-semibold text-right tabular-nums">{children ?? value ?? "-"}</td>
    </tr>
  );
}
