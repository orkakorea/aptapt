import React from 'react';

export const Header: React.FC = () => {
  return (
    <header className="w-full h-[122px] absolute z-[1] bg-white left-0 top-0 max-md:h-20 max-sm:h-[60px]">
      <div className="text-black text-2xl font-bold absolute w-[198px] h-[29px] z-[2] left-60 top-[47px] max-md:text-xl max-md:left-5 max-md:top-[25px] max-sm:text-lg max-sm:left-[15px] max-sm:top-[15px]">
        <h1 className="font-bold text-2xl text-black">응답하라-입주민이여</h1>
      </div>
    </header>
  );
};
