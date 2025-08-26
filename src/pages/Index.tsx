import React from 'react';
import { Header } from '@/components/Header';
import { SearchSection } from '@/components/SearchSection';
import { BuildingIllustration } from '@/components/BuildingIllustration';
const Index = () => {
  return <div className="w-full min-h-[1080px] relative overflow-hidden bg-[#F4F0FB] max-md:min-h-[800px] max-sm:min-h-[600px] rounded-2xl">
      <Header />
      
      <main>
        <SearchSection />
        <BuildingIllustration />
      </main>
    </div>;
};
export default Index;