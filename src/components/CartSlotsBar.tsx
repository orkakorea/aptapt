// src/components/CartSlotsBar.tsx
import React, { useMemo, useState } from "react";
import type { CartSlot } from "@/hooks/useCartSlots";

const COLOR_PRIMARY = "#6F4BF2";

type Props = {
  /** useCartSlots에서 내려주는 슬롯 목록 */
  slots: CartSlot[];
  /** Supabase 통신 중일 때 true (옵션) */
  loading?: boolean;
  /**
   * 현재 카트를 지정 슬롯에 저장
   * - slotNo: 1~5
   */
  onSaveSlot: (slotNo: number) => void;
  /**
   * 슬롯 불러오기
   * - slotNo: 1~5
   * - 해당 슬롯에 저장된 items를 parent에서 getSlotItems로 꺼내서 cart로 세팅하는 용도
   */
  onLoadSlot: (slotNo: number) => void;
  /**
   * 슬롯 비우기 (선택)
   * - 구현 안 할 거면 안 넘겨도 됨
   */
  onClearSlot?: (slotNo: number) => void;
};

/**
 * 상단 "응답하라 입주민이여 01 02 03 04 05 [추가/삭제]" 슬롯 바 UI
 *
 * - 저장된 슬롯 번호: 보라색 버튼
 * - 저장 안 된 슬롯 번호: 회색 숫자 버튼(03 04 05처럼)
 *
 * 동작 규칙:
 * - 숫자 버튼 클릭:
 *   - 내부 선택 상태를 slotNo로 유지 → 컨트롤 버튼의 대상
 *   - 저장된 슬롯이면 onLoadSlot(slotNo) 호출
 * - 컨트롤 버튼:
 *   - 선택된 슬롯이 비어 있으면 "추가" 라벨 / onSaveSlot(activeSlotNo) 호출
 *   - 선택된 슬롯이 저장되어 있으면 "삭제" 라벨 / onClearSlot(activeSlotNo) 호출
 */
const CartSlotsBar: React.FC<Props> = ({ slots, loading, onSaveSlot, onLoadSlot, onClearSlot }) => {
  const [activeSlotNo, setActiveSlotNo] = useState<number>(1);

  // 1~5 고정 슬롯 번호 배열
  const slotNumbers = useMemo(() => [1, 2, 3, 4, 5], []);

  // 특정 번호에 슬롯이 있는지 여부
  const hasSlot = (n: number) => slots.some((s) => s.slotNo === n);

  // 현재 선택된 슬롯이 저장된 슬롯인지 여부
  const isActiveSaved = hasSlot(activeSlotNo);
  // 컨트롤 버튼 라벨: 비어 있으면 "추가", 저장되어 있으면 "삭제"
  const controlLabel = isActiveSaved ? "삭제" : "추가";

  const handleClickSlot = (n: number) => {
    setActiveSlotNo(n);
    if (hasSlot(n)) {
      onLoadSlot(n);
    }
  };

  // 하나의 버튼으로 추가/삭제 컨트롤
  const handleClickControl = () => {
    if (!activeSlotNo) return;
    if (loading) return;

    if (hasSlot(activeSlotNo)) {
      // 저장된 슬롯 → 삭제
      if (!onClearSlot) return;
      onClearSlot(activeSlotNo);
    } else {
      // 비어 있는 슬롯 → 추가(저장)
      onSaveSlot(activeSlotNo);
    }
  };

  return (
    <div className="flex items-center justify-between" style={{ padding: "8px 0", gap: "8px" }}>
      {/* 좌측: 타이틀 + 슬롯 번호들 + 컨트롤 버튼 */}
      <div className="flex items-center gap-2 min-w-0">
        <span className="font-semibold truncate" style={{ fontSize: 18 }} title="응답하라 입주민이여">
          응답하라 입주민이여
        </span>

        {/* 슬롯 번호 01~05 */}
        <div className="flex items-center gap-1">
          {slotNumbers.map((n) => {
            const saved = hasSlot(n);
            const isActive = activeSlotNo === n;

            // 저장된 슬롯: 보라색 배경
            const backgroundColor = saved ? COLOR_PRIMARY : "#F5F5F5";
            const textColor = saved ? "#FFFFFF" : "#666666";
            const borderColor = isActive ? COLOR_PRIMARY : "transparent";

            return (
              <button
                key={n}
                type="button"
                onClick={() => handleClickSlot(n)}
                style={{
                  minWidth: 40,
                  height: 32,
                  padding: "0 8px",
                  borderRadius: 8,
                  border: `1px solid ${borderColor}`,
                  backgroundColor,
                  color: textColor,
                  fontWeight: 700,
                  fontSize: 16,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {String(n).padStart(2, "0")}
              </button>
            );
          })}
        </div>

        {/* 컨트롤 버튼: 선택된 슬롯 기준 "추가" / "삭제" */}
        <button
          type="button"
          onClick={handleClickControl}
          disabled={loading || (isActiveSaved && !onClearSlot)}
          style={{
            minWidth: 52,
            height: 32,
            borderRadius: 8,
            border: "1px solid #E0E0E0",
            backgroundColor: "#FFFFFF",
            fontWeight: 600,
            fontSize: 14,
            lineHeight: 1,
            padding: "0 10px",
            whiteSpace: "nowrap",
          }}
        >
          {controlLabel}
        </button>
      </div>

      {/* 우측: 로딩 상태 표시(선택) */}
      {loading && (
        <span
          style={{
            fontSize: 12,
            color: "#999999",
            whiteSpace: "nowrap",
          }}
        >
          저장 슬롯 동기화 중…
        </span>
      )}
    </div>
  );
};

export default CartSlotsBar;
