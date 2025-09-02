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
                <svg width="92" height="102" viewBox="0 0 92 102" fill="none" xmlns="http://www.w3.org/2000/svg">
<path fill-rule="evenodd" clip-rule="evenodd" d="M10.2 0C7.38335 0 5.09998 2.28337 5.09998 5.09998V96.8997H2.54999C1.14168 96.8997 0 98.0416 0 99.4497C0 100.858 1.14168 102 2.54999 102H22.9499V86.6997C22.9499 83.883 25.2333 81.5998 28.0499 81.5998H38.2499C41.0666 81.5998 43.3499 83.883 43.3499 86.6997V102H89.2497C90.6578 102 91.7997 100.858 91.7997 99.4497C91.7997 98.0416 90.6578 96.8997 89.2497 96.8997H86.6997V20.3999C86.6997 17.5833 84.4165 15.3 81.5998 15.3H61.1998V5.09998C61.1998 2.28337 58.9166 0 56.0998 0H10.2ZM22.9499 15.3C21.5416 15.3 20.3999 16.4416 20.3999 17.8499V22.9499C20.3999 24.3582 21.5416 25.4999 22.9499 25.4999H28.0499C29.4582 25.4999 30.5999 24.3582 30.5999 22.9499V17.8499C30.5999 16.4416 29.4582 15.3 28.0499 15.3H22.9499ZM20.3999 33.1499C20.3999 31.7416 21.5416 30.5999 22.9499 30.5999H28.0499C29.4582 30.5999 30.5999 31.7416 30.5999 33.1499V38.2499C30.5999 39.6582 29.4582 40.7999 28.0499 40.7999H22.9499C21.5416 40.7999 20.3999 39.6582 20.3999 38.2499V33.1499ZM22.9499 45.8999C21.5416 45.8999 20.3999 47.0417 20.3999 48.4499V53.5498C20.3999 54.9579 21.5416 56.0998 22.9499 56.0998H28.0499C29.4582 56.0998 30.5999 54.9579 30.5999 53.5498V48.4499C30.5999 47.0417 29.4582 45.8999 28.0499 45.8999H22.9499ZM20.3999 63.7498C20.3999 62.3417 21.5416 61.1998 22.9499 61.1998H28.0499C29.4582 61.1998 30.5999 62.3417 30.5999 63.7498V68.8498C30.5999 70.2579 29.4582 71.3998 28.0499 71.3998H22.9499C21.5416 71.3998 20.3999 70.2579 20.3999 68.8498V63.7498ZM38.2499 15.3C36.8418 15.3 35.6999 16.4416 35.6999 17.8499V22.9499C35.6999 24.3582 36.8418 25.4999 38.2499 25.4999H43.3499C44.758 25.4999 45.8999 24.3582 45.8999 22.9499V17.8499C45.8999 16.4416 44.758 15.3 43.3499 15.3H38.2499ZM66.2998 33.1499C66.2998 31.7416 67.4417 30.5999 68.8498 30.5999H73.9498C75.3579 30.5999 76.4998 31.7416 76.4998 33.1499V38.2499C76.4998 39.6582 75.3579 40.7999 73.9498 40.7999H68.8498C67.4417 40.7999 66.2998 39.6582 66.2998 38.2499V33.1499ZM68.8498 45.8999C67.4417 45.8999 66.2998 47.0417 66.2998 48.4499V53.5498C66.2998 54.9579 67.4417 56.0998 68.8498 56.0998H73.9498C75.3579 56.0998 76.4998 54.9579 76.4998 53.5498V48.4499C76.4998 47.0417 75.3579 45.8999 73.9498 45.8999H68.8498ZM66.2998 63.7498C66.2998 62.3417 67.4417 61.1998 68.8498 61.1998H73.9498C75.3579 61.1998 76.4998 62.3417 76.4998 63.7498V68.8498C76.4998 70.2579 75.3579 71.3998 73.9498 71.3998H68.8498C67.4417 71.3998 66.2998 70.2579 66.2998 68.8498V63.7498ZM68.8498 76.4998C67.4417 76.4998 66.2998 77.6417 66.2998 79.0498V84.1497C66.2998 85.5579 67.4417 86.6997 68.8498 86.6997H73.9498C75.3579 86.6997 76.4998 85.5579 76.4998 84.1497V79.0498C76.4998 77.6417 75.3579 76.4998 73.9498 76.4998H68.8498ZM35.6999 33.1499C35.6999 31.7416 36.8418 30.5999 38.2499 30.5999H43.3499C44.758 30.5999 45.8999 31.7416 45.8999 33.1499V38.2499C45.8999 39.6582 44.758 40.7999 43.3499 40.7999H38.2499C36.8418 40.7999 35.6999 39.6582 35.6999 38.2499V33.1499ZM38.2499 45.8999C36.8418 45.8999 35.6999 47.0417 35.6999 48.4499V53.5498C35.6999 54.9579 36.8418 56.0998 38.2499 56.0998H43.3499C44.758 56.0998 45.8999 54.9579 45.8999 53.5498V48.4499C45.8999 47.0417 44.758 45.8999 43.3499 45.8999H38.2499ZM35.6999 63.7498C35.6999 62.3417 36.8418 61.1998 38.2499 61.1998H43.3499C44.758 61.1998 45.8999 62.3417 45.8999 63.7498V68.8498C45.8999 70.2579 44.758 71.3998 43.3499 71.3998H38.2499C36.8418 71.3998 35.6999 70.2579 35.6999 68.8498V63.7498Z" fill="#E8DAFF"/>
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
