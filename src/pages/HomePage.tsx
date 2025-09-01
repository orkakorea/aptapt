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
    <div className="py-20">
      {/* Hero Section */}
      <section className="text-center mb-16">
        <h1 className="text-4xl md:text-5xl font-bold text-text-strong mb-6">
          원하는 지역의 광고 가능 단지를 확인하세요
        </h1>
        <p className="text-lg text-text-muted mb-12 max-w-2xl mx-auto">
          지역명, 아파트 이름, 단지명, 건물명을 검색하여 광고 가능한 위치를 찾아보세요.
        </p>

        {/* Search Bar */}
        <div className="flex items-stretch w-full max-w-2xl mx-auto mb-16">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && goSearch()}
            placeholder="지역명, 아파트 이름, 단지명, 건물명을 입력해주세요"
            className="flex-1 h-14 rounded-l-input border border-input bg-background px-6 text-base outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
          />
          <button
            onClick={goSearch}
            className="h-14 px-8 rounded-r-input bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition-colors"
            aria-label="검색"
          >
            🔍
          </button>
        </div>

        {/* Building Illustration */}
        <div className="mt-20">
          <svg width="320" height="200" viewBox="0 0 320 200" className="mx-auto opacity-80">
            <rect x="40" y="60" width="80" height="120" rx="12" fill="hsl(var(--accent))" opacity="0.7" />
            <rect x="140" y="40" width="80" height="140" rx="12" fill="hsl(var(--primary))" opacity="0.8" />
            <rect x="240" y="80" width="60" height="100" rx="12" fill="hsl(var(--accent))" opacity="0.6" />
            
            {/* Windows */}
            <rect x="50" y="80" width="12" height="16" rx="2" fill="white" opacity="0.9" />
            <rect x="70" y="80" width="12" height="16" rx="2" fill="white" opacity="0.9" />
            <rect x="90" y="80" width="12" height="16" rx="2" fill="white" opacity="0.9" />
            
            <rect x="150" y="60" width="12" height="16" rx="2" fill="white" opacity="0.9" />
            <rect x="170" y="60" width="12" height="16" rx="2" fill="white" opacity="0.9" />
            <rect x="190" y="60" width="12" height="16" rx="2" fill="white" opacity="0.9" />
            
            <rect x="250" y="100" width="12" height="16" rx="2" fill="white" opacity="0.9" />
            <rect x="270" y="100" width="12" height="16" rx="2" fill="white" opacity="0.9" />
          </svg>
        </div>
      </section>
    </div>
  );
}
