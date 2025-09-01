import React from 'react';

export const NavBar = () => {
  return (
    <nav className="bg-white">
      <div className="max-w-[960px] mx-auto px-6">
        <div className="flex items-center justify-between h-14">
          {/* Brand */}
          <span className="font-pretendard text-base font-semibold text-black">
            응답하라-입주민이여
          </span>
          
          {/* Right side - empty as specified */}
          <div></div>
        </div>
      </div>
    </nav>
  );
};