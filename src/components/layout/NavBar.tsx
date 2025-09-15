import React from 'react';

export default function NavBar() {
  return (
    <header className="bg-white">
      <div className="mx-auto max-w-[960px] h-14 flex items-center justify-between px-6">
        {/* 좌측 로고/타이틀 */}
        <div className="text-[16px] leading-[24px] font-semibold tracking-[-0.01em] text-[#0A0A0A]">
          응답하라-입주민이여
        </div>

        {/* 우측 로그인 버튼 */}
        <LoginModal />
      </div>
    </header>
  );
}
