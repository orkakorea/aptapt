// src/App.tsx
import { BrowserRouter, Routes, Route } from "react-router-dom";
// 이미 있는 페이지들
import Index from "./pages/Index";        // 경로는 프로젝트에 맞게 유지
import MapPage from "./pages/MapPage";    // 없으면 지워도 됨
import NotFound from "./pages/NotFound";  // 없으면 지워도 됨

// ✅ 새로 추가
import AdminGeocode from "./pages/AdminGeocode";
import SupaDebug from "./pages/SupaDebug";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Index />} />
        <Route path="/map" element={<MapPage />} />
        {/* ✅ 배치 지오코딩 페이지 */}
        <Route path="/admin/geocode" element={<AdminGeocode />} />
        <Route path="/supa-debug" element={<SupaDebug />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}
