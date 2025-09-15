import React from "react";
import LoginModal from "@/components/LoginModal";

export default function NavBar() {
  return (
    <header className="bg-white border-b border-gray-100">
      <div className="mx-auto max-w-[960px] h-14 px-6 flex items-center justify-between">
        {/* 좌측: 로고/타이틀 */}
        <div
          className="text-[16px] leading-[24px] font-semibold tracking-[-0.01em] text-[#0A0A0A]"
          title="홈으로"
        >
          응답하라-입주민이여
        </div>

        {/* 우측: 로그인 버튼(모달 포함) */}
        <LoginModal />
      </div>
    </header>
  );
}
