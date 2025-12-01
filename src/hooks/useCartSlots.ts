// src/hooks/useCartSlots.ts
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const MAX_SLOT = 5;

export type CartSlot = {
  id: string;
  slotNo: number;
  title: string | null;
  /** CartItem[] 스냅샷이지만, 훅 레벨에서는 any[] 로 취급 */
  items: any[];
  updatedAt: string | null;
};

export type UseCartSlotsReturn = {
  /** 현재 로그인 사용자의 슬롯 목록 (1~5 중 존재하는 것만) */
  slots: CartSlot[];
  /** Supabase 통신 중일 때 true */
  loading: boolean;
  /** 마지막 에러 메시지 (없으면 null) */
  error: string | null;
  /** 서버에서 슬롯 목록 다시 불러오기 */
  refresh: () => Promise<void>;
  /**
   * 슬롯 저장/덮어쓰기
   * - slotNo: 1~5
   * - cartItems: 현재 카트 상태 전체 (CartItem[])
   * - options.title: 슬롯 이름(선택)
   */
  saveSlot: (slotNo: number, cartItems: any[], options?: { title?: string | null }) => Promise<void>;
  /**
   * 메모리에 올라와 있는 슬롯에서 items만 꺼내오기
   * - 해당 번호가 없으면 null
   */
  getSlotItems: (slotNo: number) => any[] | null;
};

/**
 * 구독 회원의 "저장된 카트 슬롯(단지 세트)"을 관리하는 훅
 *
 * 전제:
 * - Supabase에 아래 구조의 테이블이 있어야 함
 *   - 이름: saved_cart_slots (가칭)
 *   - 컬럼:
 *     - id         uuid  PK
 *     - user_id    uuid  NOT NULL
 *     - slot_no    int   NOT NULL  (1~5)
 *     - title      text  NULL
 *     - items      jsonb NOT NULL  (CartItem[] 스냅샷)
 *     - created_at timestamptz
 *     - updated_at timestamptz
 *   - (user_id, slot_no)에 UNIQUE 제약
 *   - RLS: user_id = auth.uid() 인 행만 접근 허용
 *
 * 사용처:
 * - MapChrome 같은 곳에서 아래 식으로 사용
 *   const { slots, saveSlot, getSlotItems } = useCartSlots();
 */
export function useCartSlots(): UseCartSlotsReturn {
  const [slots, setSlots] = useState<CartSlot[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  /** ---------- 1) 현재 로그인 사용자 ID 가져오기 ---------- */
  useEffect(() => {
    let cancelled = false;

    async function fetchUser() {
      try {
        const { data, error } = await supabase.auth.getUser();
        if (cancelled) return;

        if (error) {
          console.error("[useCartSlots] auth.getUser 에러:", error.message);
          setUserId(null);
          return;
        }

        const uid = data?.user?.id ?? null;
        setUserId(uid);
      } catch (err: any) {
        if (cancelled) return;
        console.error("[useCartSlots] auth.getUser 예외:", err);
        setUserId(null);
      }
    }

    fetchUser();

    return () => {
      cancelled = true;
    };
  }, []);

  /** ---------- 2) 슬롯 목록 불러오기 ---------- */
  const loadSlots = useCallback(async () => {
    if (!userId) {
      // 비로그인 상태라면 슬롯은 항상 빈 상태
      setSlots([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data, error } = await supabase
        .from("saved_cart_slots")
        .select("id, slot_no, title, items, updated_at")
        .eq("user_id", userId)
        .order("slot_no", { ascending: true });

      if (error) {
        console.error("[useCartSlots] 슬롯 조회 에러:", error.message);
        setError(error.message);
        setSlots([]);
        return;
      }

      const mapped: CartSlot[] =
        data?.map((row: any) => ({
          id: row.id as string,
          slotNo: row.slot_no as number,
          title: (row.title ?? null) as string | null,
          items: (row.items ?? []) as any[],
          updatedAt: (row.updated_at ?? null) as string | null,
        })) ?? [];

      setSlots(mapped);
    } catch (err: any) {
      console.error("[useCartSlots] 슬롯 조회 예외:", err);
      setError(err?.message ?? "슬롯 조회 중 알 수 없는 오류가 발생했습니다.");
      setSlots([]);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  /** userId가 준비되면 자동으로 한 번 로딩 */
  useEffect(() => {
    if (!userId) {
      setSlots([]);
      return;
    }
    loadSlots();
  }, [userId, loadSlots]);

  /** ---------- 3) 슬롯 저장/덮어쓰기 ---------- */
  const saveSlot = useCallback(
    async (slotNo: number, cartItems: any[], options?: { title?: string | null }) => {
      if (!userId) {
        setError("로그인한 사용자만 슬롯을 저장할 수 있습니다.");
        return;
      }

      if (!Number.isInteger(slotNo) || slotNo < 1 || slotNo > MAX_SLOT) {
        setError(`슬롯 번호는 1~${MAX_SLOT} 사이여야 합니다.`);
        return;
      }

      setLoading(true);
      setError(null);

      const title = options?.title ?? null;

      try {
        const payload = {
          user_id: userId,
          slot_no: slotNo,
          title,
          items: cartItems,
        };

        const { data, error } = await supabase
          .from("saved_cart_slots")
          .upsert(payload, {
            onConflict: "user_id,slot_no", // (user_id, slot_no) UNIQUE 제약 기준
          })
          .select("id, slot_no, title, items, updated_at")
          .single();

        if (error) {
          console.error("[useCartSlots] 슬롯 저장 에러:", error.message);
          setError(error.message);
          return;
        }

        const updatedSlot: CartSlot = {
          id: data.id as string,
          slotNo: data.slot_no as number,
          title: (data.title ?? null) as string | null,
          items: (data.items ?? []) as any[],
          updatedAt: (data.updated_at ?? null) as string | null,
        };

        setSlots((prev) => {
          const filtered = prev.filter((s) => s.slotNo !== slotNo);
          return [...filtered, updatedSlot].sort((a, b) => a.slotNo - b.slotNo);
        });
      } catch (err: any) {
        console.error("[useCartSlots] 슬롯 저장 예외:", err);
        setError(err?.message ?? "슬롯 저장 중 알 수 없는 오류가 발생했습니다.");
      } finally {
        setLoading(false);
      }
    },
    [userId]
  );

  /** ---------- 4) 메모리상의 슬롯에서 items만 꺼내기 ---------- */
  const getSlotItems = useCallback(
    (slotNo: number): any[] | null => {
      const slot = slots.find((s) => s.slotNo === slotNo);
      if (!slot) return null;
      return slot.items ?? [];
    },
    [slots]
  );

  /** ---------- 5) 반환 ---------- */
  return {
    slots,
    loading,
    error,
    refresh: loadSlots,
    saveSlot,
    getSlotItems,
  };
}

export default useCartSlots;
