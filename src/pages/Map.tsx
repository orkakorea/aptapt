import React from 'react';
import { Header } from '@/components/Header';

const Map = () => {
  return (
    <div className="w-full min-h-screen relative overflow-hidden bg-[#F4F0FB]">
      <Header />
      
      <main className="pt-[122px] max-md:pt-20 max-sm:pt-[60px]">
        <div className="container mx-auto px-4 py-8">
          <div className="text-center mb-8">
            <h1 className="font-bold text-[40px] text-black font-pretendard leading-[72px] tracking-[-0.8px] max-md:text-[32px] max-md:leading-[48px] max-sm:text-2xl max-sm:leading-8">
              지도에서 단지 찾기
            </h1>
            <p className="text-[#767676] text-xl font-normal font-pretendard mt-4 max-md:text-lg max-sm:text-base">
              지도에서 광고 가능한 단지를 확인해보세요
            </p>
          </div>
          
          <div className="w-full h-[600px] bg-white rounded-[10px] border border-[#D3D3D3] flex items-center justify-center max-md:h-[500px] max-sm:h-[400px]">
            <div className="text-center">
              <div className="w-16 h-16 bg-[#6C2DFF] rounded-full flex items-center justify-center mx-auto mb-4">
                <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M16 2C11.589 2 8 5.589 8 10C8 16.5 16 28 16 28S24 16.5 24 10C24 5.589 20.411 2 16 2ZM16 13C14.343 13 13 11.657 13 10C13 8.343 14.343 7 16 7C17.657 7 19 8.343 19 10C19 11.657 17.657 13 16 13Z" fill="white"/>
                </svg>
              </div>
              <p className="text-[#767676] font-pretendard text-lg max-sm:text-base">
                지도 기능이 곧 제공될 예정입니다
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Map;