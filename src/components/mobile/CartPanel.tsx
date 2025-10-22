import React from "react";
import { fmtWon } from "@/core/utils";

const COLOR_PRIMARY = "#6F4BF2";
const COLOR_PRIMARY_LIGHT = "#EEE8FF";
const monthOptions: number[] = Array.from({ length: 12 }, (_, i) => i + 1);

type ItemComputed = {
  rowKey: string;
  aptName: string;
  productName?: string;
  months: number;
  baseMonthly?: number;
  _monthly: number; // 할인 적용 월요금
  _discountRate: number; // 0~1
  _total: number; // 총광고료
};

export default function CartPanel({
  cart,
  totalCost,
  applyAll,
  onToggleApplyAll,
  onUpdateMonths,
  onRemove,
  onGoTo,
}: {
  cart: ItemComputed[];
  totalCost: number;
  applyAll: boolean;
  onToggleApplyAll: (checked: boolean) => void;
  onUpdateMonths: (rowKey: string, months: number) => void;
  onRemove: (rowKey: string) => void;
  onGoTo: (rowKey: string) => void;
}) {
  return (
    <div className="space-y-3">
      {/* 총 비용 카드 */}
      <div className="rounded-2xl px-4 py-3" style={{ backgroundColor: COLOR_PRIMARY_LIGHT }}>
        <div className="text-sm text-gray-600">총 비용</div>
        <div className="text-[20px] font-extrabold" style={{ color: COLOR_PRIMARY }}>
          {fmtWon(totalCost)}
        </div>
        <div className="text-[11px] text-gray-500">(VAT별도)</div>
      </div>

      {/* 상단 컨트롤 (총 n건 / 일괄적용) */}
      <div className="rounded-2xl border">
        <div className="px-4 py-2 flex items-center justify-between border-b">
          <div className="text-sm text-gray-700">총 {cart.length}건</div>
          <label className="flex items-center gap-2 text-sm select-none">
            <input
              type="checkbox"
              className="accent-[#6F4BF2]"
              checked={applyAll}
              onChange={(e) => onToggleApplyAll(e.target.checked)}
            />
            광고기간 일괄적용
          </label>
        </div>

        {/* 아이템 리스트 */}
        <div className="p-3 space-y-3">
          {cart.map((item) => {
            const percent = Math.round((item._discountRate ?? 0) * 100);
            return (
              <div key={item.rowKey} className="rounded-2xl border p-3">
                {/* 헤더: 단지명 / 상품명 / 삭제 */}
                <div className="flex items-start gap-2">
                  <button onClick={() => onGoTo(item.rowKey)} className="flex-1 text-left" title="지도로 이동">
                    <div className="font-extrabold text-[16px]">{item.aptName}</div>
                    <div className="text-xs text-gray-500">{item.productName ?? "ELEVATOR TV"}</div>
                  </button>
                  <button
                    onClick={() => onRemove(item.rowKey)}
                    aria-label="삭제"
                    title="삭제"
                    className="w-8 h-8 rounded-full bg-gray-100 text-gray-600 flex items-center justify-center"
                  >
                    ×
                  </button>
                </div>

                {/* 광고기간 드롭다운 */}
                <div className="mt-3 grid grid-cols-[auto,1fr] items-center gap-x-3 gap-y-2">
                  <div className="text-sm text-gray-600">광고기간</div>
                  <div>
                    <select
                      className="w-32 rounded-xl border px-3 py-2 bg-white"
                      value={item.months}
                      onChange={(e) => onUpdateMonths(item.rowKey, Number(e.target.value))}
                    >
                      {monthOptions.map((m) => (
                        <option key={m} value={m}>
                          {m}개월
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* 월광고료 */}
                  <div className="text-sm text-gray-600">월광고료</div>
                  <div className="text-right font-semibold tabular-nums">{fmtWon(item._monthly)}</div>

                  {/* 총광고료 + 할인뱃지 */}
                  <div className="text-sm text-gray-600">총광고료</div>
                  <div className="text-right">
                    <span className="inline-flex items-center gap-2">
                      {percent > 0 && (
                        <span
                          className="rounded-full px-2 py-0.5 text-[11px] font-bold"
                          style={{ backgroundColor: COLOR_PRIMARY_LIGHT, color: COLOR_PRIMARY }}
                        >
                          {percent}%할인
                        </span>
                      )}
                      <span className="font-extrabold tabular-nums" style={{ color: COLOR_PRIMARY }}>
                        {fmtWon(item._total)}
                      </span>
                    </span>
                  </div>
                </div>
              </div>
            );
          })}

          {!cart.length && <div className="text-center text-sm text-gray-500 py-6">카트가 비어 있어요.</div>}
        </div>
      </div>
    </div>
  );
}
