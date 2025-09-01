// src/pages/HomePage.tsx
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search } from "lucide-react";

export default function HomePage() {
  const [q, setQ] = useState("");
  const nav = useNavigate();

  function goSearch() {
    const v = q.trim();
    if (!v) return;
    nav(`/map?q=${encodeURIComponent(v)}`);
  }

  return (
    <div className="min-h-screen bg-[#F4ECFF]">
      {/* Header */}
      <header className="w-full px-6 py-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-lg font-bold text-gray-900 font-pretendard">응답하라-입주민이여</div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="w-full max-w-[960px] mx-auto px-6 pt-[120px] pb-20 text-center">
        <h1 className="text-[40px] leading-[56px] font-bold text-[#0A0A0A] font-pretendard tracking-[-0.01em] mb-4">
          원하는 지역의 광고 가능 단지를 확인하세요
        </h1>

        <p className="text-base leading-6 text-[#9CA3AF] mb-6">
          지역명, 아파트 이름, 단지명, 건물명을 입력해주세요
        </p>

        {/* Search Bar */}
        <div className="w-[560px] mx-auto relative">
          <div className="relative flex items-center h-12 bg-white border border-[#E5E7EB] rounded-full pl-4">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && goSearch()}
              placeholder="지역명, 아파트 이름, 단지명, 건물명을 입력해주세요"
              className="flex-1 text-base text-[#111827] placeholder:text-[#9CA3AF] bg-transparent outline-none focus-visible:ring-2 focus-visible:ring-[#C7B8FF] focus-visible:ring-offset-2 pr-16"
            />
            <button
              onClick={goSearch}
              className="absolute right-0 w-12 h-12 bg-[#7B61FF] hover:bg-[#6A52FF] rounded-full flex items-center justify-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C7B8FF] focus-visible:ring-offset-2"
              aria-label="검색"
            >
              <Search className="w-5 h-5 text-white" />
            </button>
          </div>
        </div>

        {/* Building Illustration */}
        <div className="mt-20 w-[560px] mx-auto">
          <svg width="560" height="200" viewBox="0 0 560 200" className="mx-auto">
            <defs>
              <linearGradient id="buildingGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#D9CFFF" />
                <stop offset="100%" stopColor="#BFA6FF" />
              </linearGradient>
            </defs>
            
            {/* Building 1 */}
            <rect x="120" y="80" width="80" height="120" rx="4" fill="url(#buildingGradient)" />
            <rect x="130" y="95" width="8" height="8" rx="1" fill="rgba(255,255,255,0.3)" />
            <rect x="142" y="95" width="8" height="8" rx="1" fill="rgba(255,255,255,0.3)" />
            <rect x="154" y="95" width="8" height="8" rx="1" fill="rgba(255,255,255,0.3)" />
            <rect x="166" y="95" width="8" height="8" rx="1" fill="rgba(255,255,255,0.3)" />
            <rect x="178" y="95" width="8" height="8" rx="1" fill="rgba(255,255,255,0.3)" />
            
            <rect x="130" y="110" width="8" height="8" rx="1" fill="rgba(255,255,255,0.3)" />
            <rect x="142" y="110" width="8" height="8" rx="1" fill="rgba(255,255,255,0.3)" />
            <rect x="154" y="110" width="8" height="8" rx="1" fill="rgba(255,255,255,0.3)" />
            <rect x="166" y="110" width="8" height="8" rx="1" fill="rgba(255,255,255,0.3)" />
            <rect x="178" y="110" width="8" height="8" rx="1" fill="rgba(255,255,255,0.3)" />
            
            {/* Building 2 - Tallest */}
            <rect x="220" y="40" width="90" height="160" rx="4" fill="url(#buildingGradient)" />
            <rect x="235" y="60" width="10" height="10" rx="1" fill="rgba(255,255,255,0.3)" />
            <rect x="250" y="60" width="10" height="10" rx="1" fill="rgba(255,255,255,0.3)" />
            <rect x="265" y="60" width="10" height="10" rx="1" fill="rgba(255,255,255,0.3)" />
            <rect x="280" y="60" width="10" height="10" rx="1" fill="rgba(255,255,255,0.3)" />
            
            <rect x="235" y="80" width="10" height="10" rx="1" fill="rgba(255,255,255,0.3)" />
            <rect x="250" y="80" width="10" height="10" rx="1" fill="rgba(255,255,255,0.3)" />
            <rect x="265" y="80" width="10" height="10" rx="1" fill="rgba(255,255,255,0.3)" />
            <rect x="280" y="80" width="10" height="10" rx="1" fill="rgba(255,255,255,0.3)" />
            
            <rect x="235" y="100" width="10" height="10" rx="1" fill="rgba(255,255,255,0.3)" />
            <rect x="250" y="100" width="10" height="10" rx="1" fill="rgba(255,255,255,0.3)" />
            <rect x="265" y="100" width="10" height="10" rx="1" fill="rgba(255,255,255,0.3)" />
            <rect x="280" y="100" width="10" height="10" rx="1" fill="rgba(255,255,255,0.3)" />
            
            {/* Building 3 */}
            <rect x="330" y="100" width="70" height="100" rx="4" fill="url(#buildingGradient)" />
            <rect x="340" y="115" width="8" height="8" rx="1" fill="rgba(255,255,255,0.3)" />
            <rect x="352" y="115" width="8" height="8" rx="1" fill="rgba(255,255,255,0.3)" />
            <rect x="364" y="115" width="8" height="8" rx="1" fill="rgba(255,255,255,0.3)" />
            <rect x="376" y="115" width="8" height="8" rx="1" fill="rgba(255,255,255,0.3)" />
            
            <rect x="340" y="130" width="8" height="8" rx="1" fill="rgba(255,255,255,0.3)" />
            <rect x="352" y="130" width="8" height="8" rx="1" fill="rgba(255,255,255,0.3)" />
            <rect x="364" y="130" width="8" height="8" rx="1" fill="rgba(255,255,255,0.3)" />
            <rect x="376" y="130" width="8" height="8" rx="1" fill="rgba(255,255,255,0.3)" />
          </svg>
        </div>
      </main>
    </div>
  );
}
