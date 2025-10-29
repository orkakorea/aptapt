import React, { useMemo, useState } from "react";
import type { SelectedApt } from "@/core/types";

/** 숫자 포맷 */
const fmtNum = (v?: number | null) => (typeof v === "number" && Number.isFinite(v) ? v.toLocaleString() : "-");
const fmtWon = (v?: number | null) => (typeof v === "number" && Number.isFinite(v) ? `${v.toLocaleString()}원` : "-");

/** 상품 이미지 폴백 */
function fallbackProductImage(productName?: string) {
  const p = (productName || "").toLowerCase().replace(/\s+/g, "");
  if (p.includes("elevat")) return "/products/elevator-tv.png";
  if (p.includes("townbord") || p.includes("townboard")) {
    if (p.includes("_l") || p.endsWith("l")) return "/products/townbord-b.png";
    return "/products/townbord-a.png";
  }
  if (p.includes("media")) return "/products/media-meet-a.png";
  if (p.includes("space")) return "/products/space-living.png";
  if (p.includes("hipost") || (p.includes("hi") && p.includes("post"))) return "/products/hi-post.png";
  return "/placeholder.svg";
}

export default function DetailPanel({
  selected,
  inCart,
  onToggleCart,
}: {
  selected: SelectedApt | null;
  inCart: boolean;
  onToggleCart: () => void;
}) {
  // ---------- 방어적 매핑 (이전 키/새 키 모두 지원) ----------
  const aptName = (selected?.name as any) ?? (selected as any)?.aptName ?? (selected as any)?.name_kr ?? "미상";

  const productName =
    (selected?.productName as any) ?? (selected as any)?.product_name ?? (selected as any)?.product ?? "-";

  const imagePrimary = (selected as any)?.imageUrl || (selected as any)?.image_url || undefined;

  const [imgSrc, setImgSrc] = useState<string>(() => imagePrimary || fallbackProductImage(productName));
  // 원본 이미지 실패 시 상품 폴백으로 한 번 더
  const onImgError: React.ReactEventHandler<HTMLImageElement> = () => {
    const fb = fallbackProductImage(productName);
    if (imgSrc !== fb) setImgSrc(fb);
  };

  const subline = useMemo(() => {
    const hh = fmtNum(selected?.households);
    const rs = fmtNum(selected?.residents);
    // "세대 · 명" 형식
    const a = hh !== "-" ? `${hh}세대` : "- 세대";
    const b = rs !== "-" ? `${rs}명` : "- 명";
    return `${a} · ${b}`;
  }, [selected]);

  return (
    <div className="pb-4">
      {/* 이미지 */}
      <div className="w-full aspect-[16/9] rounded-xl overflow-hidden bg-gray-100">
        <img
          src={imgSrc}
          alt={productName || "media"}
          className="w-full h-full object-cover"
          onError={onImgError}
          loading="lazy"
        />
      </div>

      {/* 타이틀 */}
      <div className="mt-4">
        <div className="text-[18px] font-extrabold leading-tight">{aptName}</div>
        <div className="text-[12px] text-gray-500 mt-1">{subline}</div>
      </div>

      {/* 가격 */}
      <div className="mt-4 rounded-xl border bg-gray-50">
        <div className="px-4 py-3 text-sm text-gray-500 border-b">월 광고료</div>
        <div className="px-4 py-3 text-lg font-extrabold">
          {fmtWon(selected?.monthlyFee)} <span className="text-xs font-normal text-gray-500">(VAT별도)</span>
        </div>
      </div>

      {/* 1년 계약 월가 */}
      <div className="mt-3 rounded-xl border">
        <div className="px-4 py-3 rounded-xl bg-[#EEE8FF]">
          <div className="text-xs text-gray-600">1년 계약 시 월 광고료</div>
          <div className="text-[18px] font-extrabold">
            {fmtWon(selected?.monthlyFeeY1)} <span className="text-xs font-normal text-gray-500">(VAT별도)</span>
          </div>
        </div>
      </div>

      {/* 담기 버튼 */}
      <div className="mt-4">
        <button
          onClick={onToggleCart}
          className={`w-full h-12 rounded-xl text-white font-semibold ${inCart ? "bg-gray-400" : ""}`}
          style={{ backgroundColor: inCart ? undefined : "#6F4BF2" }}
        >
          {inCart ? "담기 취소" : "아파트 담기"}
        </button>
      </div>

      {/* 상세정보 */}
      <div className="mt-6 rounded-xl border overflow-hidden">
        <div className="px-4 py-3 text-sm font-semibold border-b flex items-center justify-between">
          <span>상세정보</span>
          <span className="text-xs text-gray-500">{productName || "-"}</span>
        </div>
        <DlRow label="설치 위치" value={(selected?.installLocation as any) ?? "-"} />
        <DlRow label="모니터 수량" value={fmtNum(selected?.monitors)} />
        <DlRow label="월 송출횟수" value={fmtNum(selected?.monthlyImpressions)} />
        <DlRow label="송출 1회당 비용" value={fmtWon(selected?.costPerPlay ?? null)} />
        <DlRow label="운영 시간" value={(selected?.hours as any) ?? "-"} />
        <DlRow label="주소" value={(selected?.address as any) ?? "-"} />
      </div>
    </div>
  );
}

function DlRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="px-4 py-3 border-b last:border-b-0 flex items-center">
      <div className="w-28 shrink-0 text-[13px] text-gray-500">{label}</div>
      <div className="flex-1 text-[13px]">{value ?? "-"}</div>
    </div>
  );
}
