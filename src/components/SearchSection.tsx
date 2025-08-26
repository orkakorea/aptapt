import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate } from 'react-router-dom';
const searchSchema = z.object({
  searchQuery: z.string().min(1, '검색어를 입력해주세요')
});
type SearchFormData = z.infer<typeof searchSchema>;
export const SearchSection: React.FC = () => {
  const navigate = useNavigate();
  const {
    register,
    handleSubmit,
    formState: {
      errors
    }
  } = useForm<SearchFormData>({
    resolver: zodResolver(searchSchema)
  });
  const onSubmit = (data: SearchFormData) => {
    const query = data.searchQuery.trim();
    if (query) {
      navigate(`/map?q=${encodeURIComponent(query)}`);
    }
  };
  return <section className="relative z-[2]">
      <div className="w-[656px] h-[70px] text-black text-center text-[40px] font-bold leading-[72px] tracking-[-0.8px] absolute left-[632px] top-[252px] max-md:w-[90%] max-md:text-[32px] max-md:leading-[48px] max-md:left-[5%] max-md:top-[180px] max-sm:w-[95%] max-sm:text-2xl max-sm:leading-8 max-sm:left-[2.5%] max-sm:top-[120px]">
        <h2 className="text-black font-pretendard text-4xl font-bold">
          원하는 지역의 광고 가능 단지를 확인하세요
        </h2>
      </div>
      
      <form onSubmit={handleSubmit(onSubmit)} className="relative">
        <div className="w-[651px] h-[71px] border absolute bg-white rounded-[10px] border-solid border-[#D3D3D3] left-[637px] top-[357px] max-md:w-[70%] max-md:h-[60px] max-md:left-[15%] max-md:top-[280px] max-sm:w-[85%] max-sm:h-[50px] max-sm:left-[7.5%] max-sm:top-[220px]">
          <input {...register('searchQuery')} type="text" placeholder="지역명, 아파트 이름, 단지명, 건물명을 입력해주세요" className="w-full h-full text-[#767676] text-xl font-normal leading-[38px] tracking-[-0.4px] px-[25px] py-0 rounded-[10px] border-[none] outline-none font-pretendard max-md:text-lg max-md:px-5 max-md:py-0 max-sm:text-base max-sm:px-[15px] max-sm:py-0" aria-label="아파트 검색" />
        </div>
        
        <button type="submit" className="w-[71px] h-[71px] absolute z-[2] flex items-center justify-center cursor-pointer bg-[#6C2DFF] rounded-[10px] left-[1218px] top-[357px] max-md:w-[60px] max-md:h-[60px] max-md:left-[calc(85%_-_5px)] max-md:top-[280px] max-sm:w-[50px] max-sm:h-[50px] max-sm:left-[calc(92.5%_-_5px)] max-sm:top-[220px] hover:bg-[#5a24d9] transition-colors" aria-label="검색">
          <svg width="25" height="25" viewBox="0 0 25 25" fill="none" xmlns="http://www.w3.org/2000/svg" className="search-icon">
            <g clipPath="url(#clip0_1_794)">
              <path d="M10.0617 20.1148C12.2963 20.1149 14.4669 19.3694 16.2298 17.9963L22.8806 24.6471C23.3774 25.1269 24.1691 25.1131 24.6489 24.6163C25.117 24.1317 25.117 23.3633 24.6489 22.8787L17.9981 16.2279C21.4053 11.8419 20.6119 5.52434 16.2259 2.11714C11.8399 -1.29005 5.52238 -0.496636 2.11519 3.88934C-1.29201 8.27532 -0.498589 14.5929 3.88739 18.0001C5.65315 19.3719 7.82572 20.116 10.0617 20.1148ZM4.71786 4.71597C7.66922 1.76455 12.4543 1.7645 15.4057 4.71586C18.3571 7.66722 18.3572 12.4523 15.4058 15.4037C12.4545 18.3551 7.66938 18.3552 4.71797 15.4038C4.71791 15.4038 4.71791 15.4038 4.71786 15.4037C1.7665 12.4739 1.74911 7.70622 4.67897 4.75486C4.69191 4.74186 4.70486 4.72891 4.71786 4.71597Z" fill="white" />
            </g>
            <defs>
              <clipPath id="clip0_1_794">
                <rect width="25" height="25" fill="white" />
              </clipPath>
            </defs>
          </svg>
        </button>
      </form>
      
      {errors.searchQuery && <div className="absolute left-[637px] top-[440px] text-red-500 text-sm max-md:left-[15%] max-md:top-[350px] max-sm:left-[7.5%] max-sm:top-[280px]">
          {errors.searchQuery.message}
        </div>}
    </section>;
};