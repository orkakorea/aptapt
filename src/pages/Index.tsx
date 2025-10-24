import React, { useCallback } from "react";
import { useRouter } from "next/router";
import { Header } from "@/components/Header";
import { SearchSection } from "@/components/SearchSection";
import { BuildingIllustration } from "@/components/BuildingIllustration";

const Index = () => {
  const router = useRouter();

  const handleSearch = useCallback(
    (q: string) => {
      const keyword = (q ?? "").trim();
      if (!keyword) return;
      // 최종 목적지가 /mobile 이면 ↓
      router.push(`/mobile?q=${encodeURIComponent(keyword)}`);
      // 만약 /mobile/v2 로 유지할 거면:
      // router.push(`/mobile/v2?q=${encodeURIComponent(keyword)}`);
    },
    [router],
  );

  return (
    <div className="w-full min-h-screen relative overflow-hidden bg-[#F4F0FB]">
      <Header />
      <main>
        {/* ✅ onSearch 콜백만 넘겨주면 됨 */}
        <SearchSection onSearch={handleSearch} />
        <BuildingIllustration />
      </main>
    </div>
  );
};
export default Index;
