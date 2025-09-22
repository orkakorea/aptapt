import React from "react";
import LoginModal from "@/components/LoginModal";

export default function NavBar() {
  return (
    <header className="bg-white border-b border-gray-100">
      <div className="mx-auto max-w-[960px] h-14 px-6 flex items-center">
        {/* 타이틀 + 로그인 버튼을 '바로 옆'에 배치 */}
        <div className="flex items-center gap-3">
          <span
            className="text-[16px] leading-[24px] font-semibold tracking-[-0.01em] text-[#0A0A0A]"
            title="홈으로"
          >
            응답하라 입주민이여
          </span>

          {/* 타이틀 바로 옆 로그인 버튼(모달 포함) */}
          <LoginModal />
        </div>

        {/* 필요하면 오른쪽에 다른 네비 넣을 수 있게 공간 확보 */}
        <div className="ml-auto" />
      </div>
    </header>
  );
}
