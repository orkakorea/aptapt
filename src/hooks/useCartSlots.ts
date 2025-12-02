// src/hooks/useCartSlots.ts
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/** ============================================================
 *  타입 정의
 * ============================================================ */

/** UI에서 쓰는 슬롯 타입 */
export type CartSlot = {
  id: string;
  slotNo: number; // 1~5
  title: string | null;
  items: any[]; // 실제로는 CartItem[] (여기서는 any로 처리)
  updatedAt: string | null;
};

/** Supabase 테이블(cart_slots) 한 줄 타입 */
type SavedCartSlotRow = {
  id: string;
  user_id: string;
  slot_no: number;
  cart_snapshot: any;
  updated_at: string | null;
};

/** cart_snapshot에 저장할 기본 구조 */
type CartSnapshot = {
  items: any[];
  title?: string | null;
};

/** 이 훅 안에서는 Supabase 타입 제네릭을 모두 우회한다 */
const sb = supabase as any;

/**
 * cart_slots / cart_snapshot 기반 장바구니 슬롯 훅
 *
 * - 테이블: public.cart_slots
 *   - user_id uuid
 *   - slot_no int (1~5)
 *   - cart_snapshot jsonb ({ items, title } 형태 권장)
 *   - created_at, updated_at
 */
export default function useCartSlots() {
  const [userId, setUserId] = useState<string | null>(null);
  const [slots, setSlots] = useState<CartSlot[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  /* ============================================================
   *  로그인 상태 감지 → userId 세팅
   * ============================================================ */
  useEffect(() => {
    let mounted = true;

    // 초기 사용자 정보
    sb.auth
      .getUser()
      .then((res: any) => {
        if (!mounted) return;
        const u = res?.data?.user ?? null;
        setUserId(u ? String(u.id) : null);
      })
      .catch(() => {
        if (!mounted) return;
        setUserId(null);
      });

    // 로그인 / 로그아웃 이벤트
    const { data: listener } = sb.auth.onAuthStateChange((_event: any, session: any) => {
      if (!mounted) return;
      setUserId(session?.user ? String(session.user.id) : null);
    });

    return () => {
      mounted = false;
      listener?.subscription?.unsubscribe?.();
    };
  }, []);

  /* ============================================================
   *  cart_snapshot 파싱 유틸
   * ============================================================ */
  const parseSnapshot = (snapshot: any): { items: any[]; title: string | null } => {
    let items: any[] = [];
    let title: string | null = null;

    if (Array.isArray(snapshot)) {
      // 혹시나 과거에 "그냥 배열"로만 저장했을 경우 대응
      items = snapshot;
    } else if (snapshot && typeof snapshot === "object") {
      const snap = snapshot as CartSnapshot;
      if (Array.isArray(snap.items)) items = snap.items;
      if (typeof snap.title === "string") title = snap.title;
      else if (snap.title === null) title = null;
    }

    return { items, title };
  };

  /* ============================================================
   *  슬롯 목록 불러오기
   * ============================================================ */
  const loadSlots = useCallback(async () => {
    if (!userId) {
      setSlots([]);
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await sb
        .from("cart_slots")
        .select("*")
        .eq("user_id", userId)
        .order("slot_no", { ascending: true });

      if (error) {
        console.error("[useCartSlots] load error:", error);
        setSlots([]);
        return;
      }

      const rows = (data ?? []) as SavedCartSlotRow[];

      const mapped: CartSlot[] = rows.map((row) => {
        const { items, title } = parseSnapshot(row.cart_snapshot);
        return {
          id: row.id,
          slotNo: row.slot_no,
          title,
          items,
          updatedAt: row.updated_at ?? null,
        };
      });

      setSlots(mapped);
    } catch (e) {
      console.error("[useCartSlots] load exception:", e);
      setSlots([]);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  // userId가 생기면 자동으로 슬롯 불러오기
  useEffect(() => {
    loadSlots();
  }, [loadSlots]);

  /* 외부에서 수동으로 다시 불러올 때 사용할 함수 */
  const refresh = useCallback(async () => {
    await loadSlots();
  }, [loadSlots]);

  /* ============================================================
   *  슬롯 저장 (업서트)
   *  - slotNo: 1~5
   *  - items: CartItem[]
   *  - title: 선택(슬롯 이름 등, 지금은 UI에서 안 써도 됨)
   * ============================================================ */
  const saveSlot = useCallback(
    async (slotNo: number, items: any[], title?: string | null) => {
      if (!userId) {
        console.warn("[useCartSlots] saveSlot: user not logged in");
        return;
      }

      setSaving(true);
      try {
        const snapshot: CartSnapshot = {
          items: items ?? [],
          title: title ?? null,
        };

        const payload = [
          {
            user_id: userId,
            slot_no: slotNo,
            cart_snapshot: snapshot,
          },
        ];

        const { error } = await sb.from("cart_slots").upsert(payload, { onConflict: "user_id,slot_no" });

        if (error) {
          console.error("[useCartSlots] saveSlot error:", error);
          return;
        }

        // 저장 후 목록 새로고침
        await loadSlots();
      } catch (e) {
        console.error("[useCartSlots] saveSlot exception:", e);
      } finally {
        setSaving(false);
      }
    },
    [userId, loadSlots],
  );

  /* ============================================================
   *  특정 슬롯의 items 가져오기
   *  - 가능하면 이미 메모리에 있는 slots에서 찾아서 반환
   *  - 없으면 DB에서 한 번 더 조회
   * ============================================================ */
  const getSlotItems = useCallback(
    async (slotNo: number): Promise<any[] | null> => {
      if (!userId) return null;

      const inMemory = slots.find((s) => s.slotNo === slotNo);
      if (inMemory) return inMemory.items ?? [];

      try {
        const { data, error } = await sb
          .from("cart_slots")
          .select("cart_snapshot")
          .eq("user_id", userId)
          .eq("slot_no", slotNo)
          .maybeSingle();

        if (error) {
          console.error("[useCartSlots] getSlotItems error:", error);
          return null;
        }

        if (!data) return null;
        const snapshot = (data as { cart_snapshot: any }).cart_snapshot;
        const { items } = parseSnapshot(snapshot);
        return items ?? [];
      } catch (e) {
        console.error("[useCartSlots] getSlotItems exception:", e);
        return null;
      }
    },
    [userId, slots],
  );

  /* ============================================================
   *  슬롯 삭제
   * ============================================================ */
  const clearSlot = useCallback(
    async (slotNo: number) => {
      if (!userId) {
        console.warn("[useCartSlots] clearSlot: user not logged in");
        return;
      }

      try {
        const { error } = await sb.from("cart_slots").delete().eq("user_id", userId).eq("slot_no", slotNo);

        if (error) {
          console.error("[useCartSlots] clearSlot error:", error);
          return;
        }

        await loadSlots();
      } catch (e) {
        console.error("[useCartSlots] clearSlot exception:", e);
      }
    },
    [userId, loadSlots],
  );

  return {
    slots,
    loading,
    saving,
    saveSlot,
    getSlotItems,
    clearSlot,
    refresh,
  };
}
