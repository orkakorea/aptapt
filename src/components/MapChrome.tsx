import React from "react";

/**
 * 상단바 + 좌측 패널(오버레이)
 * - 지도와 겹치지 않게 z-index로 위에 올림
 * - 패널 영역만 클릭 가능하도록 pointer-events 제어
 * - 컬러/모양은 스샷 기준 HEX 고정
 */
export default function MapChrome() {
  return (
    <>
      {/* 상단 바 */}
      <div className="fixed top-0 left-0 right-0 h-16 bg-white border-b border-black/5 z-[60]">
        <div className="h-full flex items-center px-6">
          <div className="text-xl font-bold text-black">응답하라-입주민이여</div>
        </div>
      </div>

      {/* 좌측 패널 */}
      <aside className="fixed top-16 bottom-0 left-0 w-[360px] z-[60] pointer-events-none">
        <div className="h-full px-6 py-4">
          <div className="pointer-events-auto space-y-4">

            {/* 칩들 */}
            <div className="flex gap-2">
              <span className="inline-flex items-center rounded-full border border-neutral-300 bg-white px-3 py-1 text-xs text-gray-700">
                시·군·구 단위
              </span>
              <span className="inline-flex items-center rounded-full border border-neutral-300 bg-white px-3 py-1 text-xs text-gray-700">
                패키지 문의
              </span>
              <span className="inline-flex items-center rounded-full bg-[#6C2DFF] px-3 py-1 text-xs text-white">
                1551 - 1810
              </span>
            </div>

            {/* 검색 입력 */}
            <div className="relative">
              <input
                className="w-full h-12 rounded-[10px] border border-neutral-300 bg-white pl-4 pr-12 text-sm placeholder:text-neutral-500 outline-none"
                placeholder="지역명, 아파트 이름, 단지명, 건물명을 입력해주세요"
              />
              <button
                type="button"
                className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex h-8 w-8 items-center justify-center rounded-md bg-[#6C2DFF]"
                aria-label="검색"
              >
                {/* 돋보기 아이콘 */}
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <circle cx="11" cy="11" r="7" stroke="white" strokeWidth="2" />
                  <path d="M20 20L17 17" stroke="white" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            {/* 날짜 선택 */}
            <div className="space-y-2">
              <div className="text-sm font-semibold text-black">송출 희망일</div>
              <button
                type="button"
                className="w-full h-12 rounded-[10px] border border-neutral-300 bg-white flex items-center justify-between px-3 text-sm text-gray-600"
              >
                <span>날짜를 선택하세요</span>
                {/* 캘린더 아이콘 */}
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <rect x="3" y="5" width="18" height="16" rx="2" stroke="#757575" strokeWidth="1.5" />
                  <path d="M8 3V7M16 3V7M3 10H21" stroke="#757575" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            {/* 총 비용 */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold text-black">
                  총 비용 <span className="text-xs text-gray-500">(VAT별도)</span>
                </div>
                <div className="text-xs text-gray-500">총 0건</div>
              </div>
              <div className="h-10 rounded-[10px] bg-[#F4F0FB] flex items-center px-3 text-sm font-semibold text-[#6C2DFF]">
                0원 (VAT별도)
              </div>
            </div>

            {/* 빈 장바구니 카드 */}
            <div className="rounded-2xl border border-neutral-200 bg-white p-6">
              <div className="h-40 rounded-xl border border-neutral-200 bg-neutral-50 flex flex-col items-center justify-center text-gray-600">
                {/* 빌딩 아이콘 */}
                <svg width="36" height="36" viewBox="0 0 24 24" fill="#6C2DFF" className="mb-2">
                  <path d="M3 21V8a1 1 0 0 1 1-1h6V4a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v17H3Z" opacity=".2" />
                  <path d="M3 21V8a1 1 0 0 1 1-1h6V4a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v17" fill="none" stroke="#6C2DFF" strokeWidth="1.5"/>
                  <path d="M6 10h2M6 13h2M6 16h2M13 7h2M13 10h2M13 13h2M13 16h2" stroke="#6C2DFF" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
                <div className="text-sm text-center">
                  광고를 원하는<br/>아파트단지를 담아주세요!
                </div>
              </div>
            </div>

          </div>
        </div>
      </aside>
    </>
  );
}
