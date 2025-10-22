import React from "react";
import type { CartItem } from "@/core/types";
import { fmtWon } from "@/core/utils";

const COLOR_PRIMARY = "#6F4BF2";
const COLOR_GRAY_CARD = "#F4F6FA";

export default function CartPanel({
  items,
  onRemove,
  onUpdateMonths,
  onInquiry,
}: {
  items: CartItem[];
  onRemove: (rowKey: string) => void;
  onUpdateMonths: (rowKey: string, months: number) => void;
  onInquiry?: () => void;
}) {
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
        <div className="text-4xl mb-3">🛒</div>
        <div className="text-base font-semibold text-gray-700 mb-1">담은 아파트가 없습니다</div>
        <div className="text-sm text-gray-500">지도에서 아파트를 선택하여 담아보세요</div>
      </div>
    );
  }

  // Calculate total
  const total = items.reduce((sum, item) => {
    const monthly =
      item.months >= 12 && item.monthlyFeeY1 ? item.monthlyFeeY1 : item.baseMonthly ?? 0;
    return sum + monthly * item.months;
  }, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-[18px] font-extrabold">견적 리스트</div>
        <div className="text-sm text-gray-500">{items.length}개 선택</div>
      </div>

      {/* Cart Items */}
      <div className="space-y-3">
        {items.map((item) => {
          const monthly =
            item.months >= 12 && item.monthlyFeeY1 ? item.monthlyFeeY1 : item.baseMonthly ?? 0;
          const itemTotal = monthly * item.months;

          return (
            <div
              key={item.rowKey}
              className="rounded-2xl p-4 space-y-3"
              style={{ backgroundColor: COLOR_GRAY_CARD }}
            >
              {/* Header: Name + Remove */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="font-bold text-[15px]">{item.aptName}</div>
                  {item.productName && <div className="text-xs text-gray-500 mt-0.5">{item.productName}</div>}
                </div>
                <button
                  onClick={() => onRemove(item.rowKey)}
                  className="w-7 h-7 rounded-full bg-white hover:bg-gray-100 flex items-center justify-center shrink-0"
                  aria-label="삭제"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" className="text-gray-600">
                    <path d="M18.3 5.71a1 1 0 00-1.41 0L12 10.59 7.11 5.7A1 1 0 105.7 7.11L10.59 12l-4.9 4.89a1 1 0 101.41 1.42L12 13.41l4.89 4.9a1 1 0 001.42-1.42L13.41 12l4.9-4.89a1 1 0 000-1.4z" />
                  </svg>
                </button>
              </div>

              {/* Months Selector */}
              <div>
                <div className="text-xs text-gray-600 mb-2">계약 기간</div>
                <div className="grid grid-cols-4 gap-2">
                  {[1, 3, 6, 12].map((m) => (
                    <button
                      key={m}
                      onClick={() => onUpdateMonths(item.rowKey, m)}
                      className={`h-9 rounded-lg font-semibold text-sm transition-colors ${
                        item.months === m
                          ? "text-white"
                          : "bg-white text-gray-700 hover:bg-gray-50"
                      }`}
                      style={item.months === m ? { backgroundColor: COLOR_PRIMARY } : {}}
                    >
                      {m}개월
                    </button>
                  ))}
                </div>
              </div>

              {/* Price */}
              <div className="pt-2 border-t border-gray-300">
                <div className="flex items-baseline justify-between">
                  <span className="text-sm text-gray-600">
                    {fmtWon(monthly)} × {item.months}개월
                  </span>
                  <span className="text-[17px] font-extrabold">{fmtWon(itemTotal)}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Total Summary */}
      <div className="rounded-2xl p-4 border-2" style={{ borderColor: COLOR_PRIMARY, backgroundColor: "#F9F7FF" }}>
        <div className="flex items-center justify-between mb-1">
          <span className="text-sm text-gray-700">총 광고료</span>
          <span className="text-[22px] font-extrabold" style={{ color: COLOR_PRIMARY }}>
            {fmtWon(total)}
          </span>
        </div>
        <div className="text-xs text-gray-500 text-right">(VAT별도)</div>
      </div>

      {/* Inquiry Button */}
      {onInquiry && (
        <button
          onClick={onInquiry}
          className="w-full h-12 rounded-2xl font-extrabold text-white"
          style={{ backgroundColor: COLOR_PRIMARY }}
        >
          견적 문의하기
        </button>
      )}
    </div>
  );
}
