// src/pages/mobile/home/index.tsx
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search } from "lucide-react";
import Footer from "@/components/layout/Footer";

export default function HomePage() {
  const [q, setQ] = useState("");
  const nav = useNavigate();

  function goSearch() {
    const v = q.trim();
    if (!v) return;
    // ✅ 모바일 홈에서 검색 → 모바일 지도 페이지로 이동
    nav(`/mobile?q=${encodeURIComponent(v)}`);
  }

  return (
    <div className="min-h-dvh bg-white flex flex-col">
      {/* 상단 헤더는 App.tsx의 공통 NavBar가 렌더링함 */}

      {/* Hero Section */}
      <section className="bg-[#F4ECFF]">
        <div className="w-full max-w-[420px] mx-auto px-4 pt-16 pb-12 text-center">
          <h1 className="text-[26px] leading-[36px] font-bold text-[#0A0A0A] font-pretendard tracking-[-0.01em] mb-4">
            원하는 지역의
            <br />
            광고 가능한 단지를 확인하세요
          </h1>

          <p className="text-[14px] leading-[22px] text-[#9CA3AF] text-center mb-5">
            주소, 지역명, 아파트명, 건물명을 입력해주세요
          </p>

          {/* Search Bar */}
          <div className="w-full max-w-none h-12 mx-auto relative overflow-hidden bg-white border border-[#E5E7EB] rounded-full focus-within:ring-2 focus-within:ring-[#C7B8FF]">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === "Search") {
                  e.preventDefault();
                  goSearch();
                }
              }}
              placeholder="우리 사업장 상호명으로도 검색이 가능해요"
              className="w-full h-12 pl-4 pr-12 text-[16px] text-[#111827] placeholder:text-[#9CA3AF] bg-transparent outline-none"
              aria-label="검색어 입력"
              inputMode="search"
              enterKeyHint="search"
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
          <div className="mt-12">
            <svg
              width="538"
              height="474"
              viewBox="0 0 538 474"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="mx-auto w-full max-w-[320px] h-auto"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M366.524 0.09375L241.089 53.714V498.205H279.278V404.769L270.44 405.61C266.825 405.951 263.617 403.297 263.276 399.682C262.935 396.066 265.589 392.859 269.204 392.517L337.173 386.048C340.789 385.706 343.996 388.36 344.338 391.976C344.679 395.591 342.026 398.799 338.41 399.14L328.337 400.099V498.204H491.96V53.714L366.524 0.09375ZM290.296 344.878L266.586 347.148V301.336L290.296 297.68V344.878ZM290.303 270.462L266.587 274.918V228.996L290.303 223.151V270.462ZM290.303 196.009L266.587 202.652V156.73L290.303 148.697V196.009ZM290.303 121.517L266.587 130.312V87.4104L290.311 77.2412L290.303 121.517ZM341.027 340.046L314.31 342.607V293.925L341.027 289.798V340.046ZM341.027 260.869L314.31 265.898V217.255L341.027 210.661V260.868V260.869ZM341.027 181.733L314.31 189.227V140.545L341.027 131.485V181.733ZM341.027 102.596L314.31 112.555L314.302 66.9621L341.026 55.4965V102.596H341.027ZM404.481 420.146C404.481 423.79 401.528 426.743 397.884 426.743C394.24 426.743 391.286 423.79 391.286 420.146V57.721C391.286 54.0769 394.24 51.1233 397.884 51.1233C401.528 51.1233 404.481 54.0769 404.481 57.721V420.148V420.146ZM435.84 420.146C435.84 423.79 432.886 426.743 429.242 426.743C425.598 426.743 422.645 423.79 422.645 420.146V71.1263C422.645 67.4822 425.599 64.5287 429.242 64.5287C432.885 64.5287 435.84 67.4833 435.84 71.1263V420.148V420.146ZM467.199 420.146C467.199 423.79 464.245 426.743 460.601 426.743C456.957 426.743 454.003 423.79 454.003 420.146V84.5317C454.003 80.8876 456.957 77.934 460.601 77.934C464.245 77.934 467.199 80.8876 467.199 84.5317V420.148V420.146ZM176.25 129.59L45.6316 185.426V498.205H86.4117V425.661L77.5741 426.502C73.9586 426.843 70.7511 424.19 70.4102 420.574C70.0693 416.959 72.7227 413.751 76.3382 413.411L144.307 406.942C147.923 406.601 151.13 409.254 151.472 412.87C151.813 416.485 149.16 419.693 145.544 420.035L135.471 420.993V498.206H227.895V151.667L176.25 129.59ZM92.8367 358.169L73.5397 360.812V323.667L92.8367 319.703V358.169ZM92.8367 297.624L73.5397 302.37V265.224L92.8367 259.157V297.624ZM92.8433 237.055L73.5408 243.88V209.188L92.8499 201.055L92.8433 237.055ZM134.799 352.376L112.575 355.438V315.657L134.799 311.071V352.376ZM134.799 287.262L112.575 292.737V252.932L134.799 245.909V287.262ZM134.799 222.125L112.568 230.037V192.761L134.799 183.34V222.125ZM0 511.4H537.59V538.902H0V511.4Z"
                fill="url(#paint0_linear_1_793)"
              />
              <defs>
                <linearGradient
                  id="paint0_linear_1_793"
                  x1="268.795"
                  y1="0.09375"
                  x2="268.795"
                  y2="538.902"
                  gradientUnits="userSpaceOnUse"
                >
                  <stop stopColor="#EFE5FF" />
                  <stop offset="1" stopColor="#D7C0FF" />
                </linearGradient>
              </defs>
            </svg>
          </div>
        </div>
      </section>

      {/* 푸터 */}
      <Footer />
    </div>
  );
}
