import React from 'react';

export default function Footer() {
  return (
    <footer className="bg-white">
      <div className="mx-auto max-w-[960px] px-6 py-6 flex items-center justify-between">
        <div className="text-sm text-[#9CA3AF]">
          © 2024 응답하라-입주민이여. All rights reserved.
        </div>
        <div className="flex items-center gap-6">
          <a href="#" className="text-sm text-[#9CA3AF] hover:text-[#6A52FF]">Contact</a>
          <a href="#" className="text-sm text-[#9CA3AF] hover:text-[#6A52FF]">Terms</a>
          <a href="#" className="text-sm text-[#9CA3AF] hover:text-[#6A52FF]">Privacy</a>
        </div>
      </div>
    </footer>
  );
}