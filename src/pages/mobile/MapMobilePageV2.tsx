import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useKakaoLoader } from "../../hooks/useKakaoLoader";
import { useKakaoMap } from "../../hooks/useKakaoMap";
import usePlaceSearch from "../../hooks/usePlaceSearch";
import useMarkers from "../../hooks/useMarkers";

import type { SelectedApt, CartItem } from "../../core/types";

/* 색상 */
const COLOR_PRIMARY = "#6F4BF2";

/**
 * 기본화면(V2)
 * - 상단바 우측: "패키지 문의" 버튼(모달은 다음 단계에서)
 * - 검색창 왼쪽에 배치, 오른쪽엔 버튼 스택(검색/카트/전화)
 * - 검색 실행 시 input blur로 모바일 키보드 자동 내림
 * - 브라우저 뒤로가기 → 종료 확인 모달
 * - 바텀시트/상세/모달은 아직 없음(다음 단계)
 */
export default function MapMobilePageV2() {
  const mapRef = useRef<HTMLDivElement | null>(null);

  /* Kakao SDK & Map */
  const { kakao, error: kakaoError } = useKakaoLoader();
  const { map, clusterer } = useKakaoMap(mapRef, {
    kakao,
    center: { lat: 37.5665, lng: 126.978 }, // 서울시청
    level: 6,
    idleDebounceMs: 150,
  });

  /* 검색 */
  const [searchQ, setSearchQ] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);
  const search = usePlaceSearch({ kakao, map, defaultLevel: 4, smoothPan: true });

  /* 선택/카트 (배지용 카운트만 사용) */
  const [selected, setSelected] = useState<SelectedApt | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const selectedRowKeys = useMemo(() => cart.map((c) => c.rowKey), [cart]);

  /* 마커들 (클릭 시 선택만 저장) */
  const markers = useMarkers({
    kakao,
    map,
    clusterer,
    onSelect: (apt) => setSelected(apt),
    externalSelectedRowKeys: selectedRowKeys,
  });

  /* 맵 준비 시 첫 로딩 강제 */
  useEffect(() => {
    if (map && kakao) {
      setTimeout(() => {
        try {
          markers.refreshInBounds();
        } catch {}
      }, 0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, kakao]);

  /* 뒤로가기 가드 */
  const [exitAsk, setExitAsk] = useState(false);
  const popHandlerRef = useRef<(e: PopStateEvent) => void>();
  useEffect(() => {
    // 히스토리에 가드 스택 쌓기
    history.pushState({ guard: true }, "");
    const onPop = () => {
      history.pushState({ guard: true }, "");
      setExitAsk(true);
    };
    popHandlerRef.current = onPop;
    window.addEventListener("popstate", onPop);

    // 탭/창 닫기 방지
    const onBeforeUnload = (ev: BeforeUnloadEvent) => {
      ev.preventDefault();
      ev.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);

    return () => {
      const h = popHandlerRef.current;
      if (h) window.removeEventListener("popstate", h);
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, []);

  /* 검색 실행 + blur(모바일 키보드 내림) */
  const runSearchAndBlur = useCallback(async () => {
    try {
      searchInputRef.current?.blur();
      (document.activeElement as HTMLElement | null)?.blur?.();
      await search.run(searchQ);
    } catch {}
  }, [searchQ, search]);

  return (
    <div className="w-screen h-[100dvh] bg-white">
      {/* 상단바 */}
      <div className="fixed top-0 left-0 right-0 z-[40] bg-white border-b">
        <div className="h-14 px-3 flex items-center justify-between">
          <div className="font-extrabold text-[15px]">응답하라 입주민이여</div>
          {/* 우측: 패키지 문의 (모달은 다음 단계에서) */}
          <button
            className="px-3 py-1 rounded-full border text-sm font-semibold"
            onClick={() => {
              // TODO: 다음 단계에서 문의 모달 오픈
              // 임시로 토스트/콘솔
              console.log("패키지 문의 클릭");
            }}
          >
            패키지 문의
          </button>
        </div>
      </div>

      {/* 지도 */}
      <div ref={mapRef} className="fixed top-[56px] left-0 right-0 bottom-0 z-[10]" aria-label="map" />

      {/* 검색창 (좌측) */}
      <div className="fixed z-[35] left-3 right-[76px] top-[64px] pointer-events-none">
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            await runSearchAndBlur();
          }}
          className="pointer-events-auto"
        >
          <input
            ref={searchInputRef}
            value={searchQ}
            onChange={(e) => setSearchQ(e.target.value)}
            placeholder="지역명, 아파트 이름, 단지명, 건물명"
            className="w-full h-11 px-4 rounded-xl border outline-none bg-white/95"
            style={{ borderColor: "#E8E0FF" }}
          />
        </form>
      </div>

      {/* 오른쪽 상단 버튼 스택: 검색 → 카트 → 전화 */}
      <div className="fixed z-[35] right-3 top-[64px] pointer-events-none">
        <div className="flex flex-col gap-2 pointer-events-auto">
          {/* 검색 버튼 */}
          <button
            onClick={runSearchAndBlur}
            className="w-11 h-11 rounded-full flex items-center justify-center text-white shadow"
            style={{ backgroundColor: COLOR_PRIMARY }}
            aria-label="검색"
            title="검색"
          >
            <svg width="19" height="19" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0016 9.5 6.5 6.5 0 109.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79L20 21.49 21.49 20l-5.99-6zM9.5 14C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" />
            </svg>
          </button>

          {/* 카트 버튼(배지) - 바텀시트는 다음 단계 */}
          <button
            onClick={() => {
              // TODO: 다음 단계에서 카트 시트 열기
              console.log("카트 클릭");
            }}
            className="relative w-11 h-11 rounded-full flex items-center justify-center text-white shadow"
            style={{ backgroundColor: COLOR_PRIMARY }}
            aria-label="카트"
            title="카트"
          >
            <svg width="19" height="19" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <path d="M7 4h-2l-1 2h2l3.6 7.59-1.35 2.45c-.16.28-.25.61-.25.96 0 1.1.9 2 2 2h9v-2h-8.42c-.14 0-.25-.11-.25-.25l.03-.12.9-1.63h5.74c.75 0 1.41-.41 1.75-1.03L23 6H6.21l-.94-2zM7 20c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm10 0c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-2-2z" />
            </svg>
            {cart.length > 0 && (
              <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 rounded-full bg-[#FF3B30] text-[10px] font-bold flex items-center justify-center">
                {cart.length > 99 ? "99+" : cart.length}
              </span>
            )}
          </button>

          {/* 전화 버튼 */}
          <a
            href="tel:1551-0810"
            className="w-11 h-11 rounded-full flex items-center justify-center text-white shadow"
            style={{ backgroundColor: COLOR_PRIMARY }}
            aria-label="전화 연결"
            title="전화 연결"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <path d="M6.62 10.79a15.05 15.05 0 006.59 6.59l2.2-2.2a1 1 0 011.01-.24c1.12.37 2.33.57 3.58.57a1 1 0 011 1V21a1 1 0 01-1 1C10.3 22 2 13.7 2 3a1 1 0 011-1h3.5a1 1 0 011 1c0 1.25.2 2.46.57 3.58a1 1 0 01-.25 1.01l-2.2 2.2z" />
            </svg>
          </a>
        </div>
      </div>

      {/* SDK 에러 토스트 */}
      {kakaoError && (
        <div className="fixed bottom-4 right-4 z-[100] rounded-lg bg-red-600 text-white px-3 py-2 text-sm shadow">
          Kakao SDK 오류: {kakaoError}
        </div>
      )}

      {/* 종료 확인 모달 */}
      {exitAsk && (
        <ConfirmExitModal
          onCancel={() => setExitAsk(false)}
          onConfirm={() => {
            const h = popHandlerRef.current;
            if (h) window.removeEventListener("popstate", h);
            setExitAsk(false);
            setTimeout(() => history.back(), 0);
          }}
        />
      )}
    </div>
  );
}

/* -----------------------------
 * 종료 확인 모달 (심플)
 * ----------------------------- */
function ConfirmExitModal({ onConfirm, onCancel }: { onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="fixed inset-0 z-[90]">
      <div className="absolute inset-0 bg-black/40" />
      <div className="absolute inset-x-8 top-1/3 translate-y-[-50%] rounded-2xl bg-white p-4 shadow-xl">
        <div className="font-extrabold text-[15px] mb-3">정말로 해당 페이지를 종료하시겠습니까?</div>
        <div className="flex items-center justify-end gap-2">
          <button onClick={onCancel} className="px-4 py-2 rounded-xl bg-gray-100 text-gray-700 font-semibold">
            아니오
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 rounded-xl text-white font-semibold"
            style={{ backgroundColor: COLOR_PRIMARY }}
          >
            예
          </button>
        </div>
      </div>
    </div>
  );
}
