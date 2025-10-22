import React from "react";
import type { SelectedApt } from "@/core/types";
import { fmtNum, fmtWon } from "@/core/utils";

const COLOR_PRIMARY = "#6F4BF2";
const COLOR_PRIMARY_LIGHT = "#EEE8FF";
const COLOR_GRAY_CARD = "#F4F6FA";

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

  const y1Monthly =
    typeof selected.monthlyFeeY1 === "number" && selected.monthlyFeeY1 > 0
      ? selected.monthlyFeeY1
      : Math.round((selected.monthlyFee ?? 0) * 0.7);

  return (
    <div className="space-y-3">
      {/* 상단 이미지 */}
      <div className="rounded-2xl overflow-hidden bg-gray-100 aspect-[4/3]">
        {selected.imageUrl ? (
          <img src={selected.imageUrl} alt={selected.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-400">이미지</div>
        )}
      </div>

      {/* 타이틀 + 닫기(X) */}
      <div className="flex items-start gap-3">
        <div className="flex-1">
          <div className="text-[20px] font-extrabold">{selected.name}</div>
          <div className="text-sm text-gray-500">
            {fmtNum(selected.households)} 세대 · {fmtNum(selected.residents)} 명
          </div>
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
                  {selected.productName ?? "ELEVATOR TV"}
                </span>
              </InfoRow>
              <InfoRow label="설치 위치" value={selected.installLocation ?? "-"} />
              <InfoRow label="모니터 수량" value={`${fmtNum(selected.monitors)} 대`} />
              <InfoRow label="월 송출횟수" value={`${fmtNum(selected.monthlyImpressions)} 회`} />
              <InfoRow label="송출 1회당 비용" value={`${fmtNum(selected.costPerPlay)} 원`} />
              <InfoRow label="운영 시간" value={selected.hours || "-"} />
              <InfoRow label="주소">
                <span className="whitespace-pre-line">{selected.address || "-"}</span>
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
      <td className="text-gray-500 w-36">{label}</td>
      <td className="font-semibold">{children ?? value ?? "-"}</td>
    </tr>
  );
}
