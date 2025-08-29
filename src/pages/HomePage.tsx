// src/pages/HomePage.tsx
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";

export default function HomePage() {
  const [q, setQ] = useState("");
  const nav = useNavigate();

  function goSearch() {
    const v = q.trim();
    if (!v) return;
    nav(`/map?q=${encodeURIComponent(v)}`);
  }

  return (
    <div className="min-h-screen bg-[#F3ECFF]">
      {/* 상단 로고/타이틀 영역(필요시 수정) */}
      <header className="w-full max-w-6xl mx-auto px-6 py-6">
        <div className="text-sm font-semibold">응답하라-입주민이여</div>
      </header>

      {/* 히어로 */}
      <main className="w-full max-w-4xl mx-auto px-6 pt-20 pb-16 text-center">
        <h1 className="text-2xl md:text-3xl font-extrabold text-gray-800 mb-6">
          원하는 지역의 광고 가능 단지를 확인하세요
        </h1>

        {/* 검색바 */}
        <div className="flex items-stretch w-full max-w-2xl mx-auto">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && goSearch()}
            placeholder="지역명, 아파트 이름, 단지명, 건물명을 입력해주세요"
            className="flex-1 h-12 rounded-l-xl border border-gray-200 bg-white px-4 text-sm outline-none"
          />
          <button
            onClick={goSearch}
            className="h-12 px-4 rounded-r-xl bg-[#6d28d9] text-white font-semibold hover:opacity-90"
            aria-label="검색"
          >
            🔍
          </button>
        </div>

        {/* 일러스트 자리(선택) */}
        <div className="mt-16 opacity-70">
          <svg width="240" height="160" viewBox="0 0 240 160" className="mx-auto">
            <rect x="20" y="40" width="60" height="100" rx="8" fill="#C7B6F7" />
            <rect x="100" y="20" width="60" height="120" rx="8" fill="#BFAAF5" />
            <rect x="180" y="60" width="40" height="80" rx="8" fill="#D4C7FA" />
          </svg>
        </div>
      </main>
    </div>
  );
}
