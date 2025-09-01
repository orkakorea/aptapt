// src/pages/HomePage.tsx
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search } from "lucide-react";
import NavBar from "../components/layout/NavBar";
import Footer from "../components/layout/Footer";

export default function HomePage() {
  const [q, setQ] = useState("");
  const nav = useNavigate();

  function goSearch() {
    const v = q.trim();
    if (!v) return;
    nav(`/map?q=${encodeURIComponent(v)}`);
  }

  return (
    <div className="min-h-screen bg-white">
      <NavBar />

      {/* Hero Section */}
      <section className="bg-[#F4ECFF]">
        <div className="w-full max-w-[960px] mx-auto px-6 pt-[120px] pb-20 text-center">
          <h1 className="text-[40px] leading-[56px] font-bold text-[#0A0A0A] font-pretendard tracking-[-0.01em] mb-4">
            원하는 지역의 광고 가능 단지를 확인하세요
          </h1>

          <p className="text-[16px] leading-[24px] text-[#9CA3AF] text-center mb-6">
            지역명, 아파트 이름, 단지명, 건물명을 입력해주세요
          </p>

          {/* Search Bar */}
          <div className="w-[560px] h-12 mx-auto relative overflow-hidden bg-white border border-[#E5E7EB] rounded-full focus-within:ring-2 focus-within:ring-[#C7B8FF]">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && goSearch()}
              placeholder="지역명, 아파트 이름, 단지명, 건물명을 입력해주세요"
              className="w-full h-12 pl-4 pr-12 text-[16px] text-[#111827] placeholder:text-[#9CA3AF] bg-transparent outline-none"
            />
            <button
              onClick={goSearch}
              className="absolute right-0 top-0 w-12 h-12 bg-[#7B61FF] hover:bg-[#6A52FF] rounded-r-full flex items-center justify-center transition-colors"
              aria-label="검색"
            >
              <Search className="w-5 h-5 text-white" />
            </button>
          </div>

          {/* Building Illustration */}
          <div className="mt-20">
            <svg width="560" height="200" viewBox="0 0 560 200" className="mx-auto">
              <defs>
                <linearGradient id="buildingGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#D9CFFF" />
                  <stop offset="100%" stopColor="#BFA6FF" />
                </linearGradient>
              </defs>
              
              {/* Building 1 */}
              <rect x="120" y="80" width="80" height="120" rx="4" fill="url(#buildingGradient)" />
              
              {/* Building 2 - Tallest */}
              <rect x="220" y="40" width="90" height="160" rx="4" fill="url(#buildingGradient)" />
              
              {/* Building 3 */}
              <rect x="330" y="100" width="70" height="100" rx="4" fill="url(#buildingGradient)" />
            </svg>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
