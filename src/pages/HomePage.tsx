// src/pages/HomePage.tsx
import React from "react";

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
        </div>
      </div>
    </div>
  );
}
