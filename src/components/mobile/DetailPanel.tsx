// src/components/mobile/DetailPanel.tsx
import React, { useMemo, useState } from "react";
import type { SelectedApt } from "@/core/types";
import { fmtNum, fmtWon } from "@/core/utils";

const COLOR_PRIMARY = "#6F4BF2";
const COLOR_PRIMARY_LIGHT = "#EEE8FF";
const COLOR_GRAY_CARD = "#F4F6FA";

/** 상품 이미지 폴백(영문/한글 키워드 모두 지원) */
function fallbackProductImage(productName?: string) {
  const raw = productName || "";
  const lower = raw.toLowerCase();
  const compactLower = lower.replace(/\s+/g, "");
  const compact = raw.replace(/\s+/g, ""); // 한글 판별용

  // ====== 엘리베이터 TV ======
  if (
    compactLower.includes("elevat") || // elevator, elevator-tv 등
    compact.includes("엘리베이터") ||
    compact.includes("엘티비") ||
    compact.includes("엘리베이터tv")
  ) {
    return "/products/elevator-tv.png";
  }

  // ====== 타운보드 (A/B 변형) ======
  if (compactLower.includes("townbord") || compactLower.includes("townboard") || compact.includes("타운보드")) {
    if (compactLower.includes("_l") || compactLower.endsWith("l") || compact.endsWith("L")) {
      return "/products/townbord-b.png";
    }
    return "/products/townbord-a.png";
  }

  // ====== 미디어밋(미디어미트 표기 포함) ======
  if (
    compactLower.includes("mediameet") ||
    (compactLower.includes("media") && compactLower.includes("meet")) ||
    compact.includes("미디어밋") ||
    compact.includes("미디어미트")
  ) {
    return "/products/media-meet-a.png";
  }

  // ====== 스페이스 리빙 ======
  if (compactLower.includes("spaceliving") || compactLower.includes("space") || compact.includes("스페이스리빙")) {
    return "/products/space-living.png";
  }

  // ====== 하이포스트 ======
  if (
    compactLower.includes("hipost") ||
    (compactLower.includes("hi") && compactLower.includes("post")) ||
    compact.includes("하이포스트")
  ) {
    return "/products/hi-post.png";
  }

  // 그 외
  return "/placeholder.svg";
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

  // ---- 방어적 매핑 (키 이름 다양성 대응) ---------------------------------
  const displayedName: string =
    (getField(selected as any, ["name", "aptName", "name_kr", "단지명", "apt_name", "title"]) as string) || "미상";

  const displayedProduct: string =
    (getField(selected as any, ["productName", "product_name", "product", "상품명"]) as string) || "ELEVATOR TV";

  const displayedInstallLoc: string = (getField(selected as any, ["installLocation", "설치위치"]) as string) || "-";

  const displayedAddress: string = (getField(selected as any, ["address", "주소"]) as string) || "-";

  const initialImg: string =
    (getField(selected as any, ["imageUrl", "image_url", "이미지", "썸네일", "thumbnail"]) as string) ||
    fallbackProductImage(displayedProduct);

  const [imgSrc, setImgSrc] = useState<string>(initialImg);
  const onImgError: React.ReactEventHandler<HTMLImageElement> = () => {
    const fb = fallbackProductImage(displayedProduct);
    if (imgSrc !== fb) setImgSrc(fb);
  };

  const y1Monthly =
    typeof selected.monthlyFeeY1 === "number" && selected.monthlyFeeY1 > 0
      ? selected.monthlyFeeY1
      : Math.round((selected.monthlyFee ?? 0) * 0.7);

  // 세대/거주 인원 보조 텍스트 (기존 UI 유지)
  const subline = useMemo(() => {
    return `${fmtNum(selected.households)} 세대 · ${fmtNum(selected.residents)} 명`;
  }, [selected.households, selected.residents]);

  return (
    <div className="space-y-3">
      {/* 상단 이미지 (UI 동일) */}
      <div className="rounded-2xl overflow-hidden bg-gray-100 aspect-[4/3]">
        {imgSrc ? (
          <img src={imgSrc} alt={displayedName} className="w-full h-full object-cover" onError={onImgError} />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-400">이미지</div>
        )}
      </div>

      {/* 타이틀 + 닫기(X) (UI 동일) */}
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

      {/* 가격 카드들 (UI 동일) */}
      <div className="space-y-2">
        <div className="rounded-2xl px-4 py-3" style={{ backgroundColor: COLOR_GRAY_CARD }}>
          <div className="text-sm text-gray-600">월 광고료</div>
          <div className="text-[20px] font-extrabold">
            {fmtWon(selected.monthlyFee)} <span className="text-xs text-gray-500">(VAT별도)</span>
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

      {/* 담기 버튼 (UI 동일) */}
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

      {/* 상세정보 테이블 (UI 동일, 데이터 매핑만 반영) */}
      <section className="mt-1">
        <div className="mb-2 text-[15px] font-extrabold">상세정보</div>
        <div className="rounded-2xl border overflow-hidden">
          <table className="w-full text-sm">
            <tbody className="[&_td]:px-4 [&_td]:py-3">
              <InfoRow label="상품명">
                <span style={{ color: COLOR_PRIMARY }} className="font-semibold">
                  {displayedProduct}
                </span>
              </InfoRow>
              <InfoRow label="설치 위치" value={displayedInstallLoc} />
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
