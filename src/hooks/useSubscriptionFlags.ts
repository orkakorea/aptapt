// src/hooks/useSubscriptionFlags.ts
import { useEffect, useState } from "react";

/**
 * 구독 여부 플래그를 전역에서 읽기 위한 훅
 *
 * - LoginModal이 관리하는 localStorage("orca.subscriber") + window 이벤트("orca:subscriber")를 기반으로 동작
 * - DB에는 직접 접근하지 않고, 이미 반영된 결과만 읽는다.
 * - 어디서든 이 훅만 호출하면 "현재 브라우저에서 로그인한 사용자가 구독회원인지"를 알 수 있다.
 */

const LS_KEY_SUBSCRIBER = "orca.subscriber";
const EVENT_KEY_SUBSCRIBER = "orca:subscriber";

export type SubscriptionFlags = {
  /** 현재 사용자가 구독회원인지 여부 */
  isSubscriber: boolean;
};

/**
 * 사용 예)
 * const { isSubscriber } = useSubscriptionFlags();
 */
export function useSubscriptionFlags(): SubscriptionFlags {
  const [isSubscriber, setIsSubscriber] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    try {
      const raw = window.localStorage.getItem(LS_KEY_SUBSCRIBER);
      return raw === "true";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    if (typeof window === "undefined") return;

    // 마운트 시 한 번 더 동기화 (혹시 초기값이 비어 있을 수 있으므로)
    try {
      const raw = window.localStorage.getItem(LS_KEY_SUBSCRIBER);
      const next = raw === "true";
      setIsSubscriber(next);
    } catch {
      // localStorage 접근 실패는 조용히 무시
    }

    const handler = (evt: Event) => {
      // LoginModal에서 보내는 CustomEvent("orca:subscriber", { detail: { isSubscriber } })
      if ("detail" in evt) {
        const anyEvt = evt as CustomEvent<{ isSubscriber?: boolean }>;
        if (typeof anyEvt.detail?.isSubscriber === "boolean") {
          setIsSubscriber(anyEvt.detail.isSubscriber);
          return;
        }
      }

      // 혹시 detail이 없거나 포맷이 달라도, localStorage를 다시 읽어서 보정
      try {
        const raw = window.localStorage.getItem(LS_KEY_SUBSCRIBER);
        const next = raw === "true";
        setIsSubscriber(next);
      } catch {
        // 무시
      }
    };

    window.addEventListener(EVENT_KEY_SUBSCRIBER, handler as EventListener);

    return () => {
      window.removeEventListener(EVENT_KEY_SUBSCRIBER, handler as EventListener);
    };
  }, []);

  return { isSubscriber };
}

export default useSubscriptionFlags;
