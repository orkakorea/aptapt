// src/pages/HomePage.tsx
import React from "react";
import { Search } from "lucide-react";

export default function HomePage() {
  return (
    <div className="bg-[#F4ECFF]">
      <div className="max-w-[960px] mx-auto px-6 pt-[120px] pb-[80px]">
        <div className="text-center">
          <h1 
            className="font-pretendard text-[40px] leading-[56px] font-bold tracking-[-0.01em] text-[#0A0A0A] mb-4"
          >
            원하는 지역의 광고 가능 단지를 확인하세요
          </h1>
          
          <p className="text-base leading-6 text-[#9CA3AF] mb-6">
            지역명, 아파트 이름, 단지명, 건물명을 입력해주세요
          </p>

          {/* Search Bar */}
          <div className="w-[560px] mx-auto">
            <div className="relative flex items-center h-12 border border-[#E5E7EB] bg-white rounded-full">
              <input
                type="text"
                placeholder="지역명, 아파트 이름, 단지명, 건물명을 입력해주세요"
                className="flex-1 h-full pl-4 pr-16 text-base text-[#111827] placeholder-[#9CA3AF] bg-transparent border-none outline-none rounded-full focus-visible:ring-2 focus-visible:ring-[#C7B8FF]"
              />
              <button
                type="button"
                className="absolute right-0 w-12 h-12 bg-[#7B61FF] hover:bg-[#6A52FF] rounded-full flex items-center justify-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C7B8FF] focus-visible:ring-offset-2"
              >
                <Search className="w-5 h-5 text-white" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
