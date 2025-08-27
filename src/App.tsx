// src/pages/App.tsx (중요 부분만 예시)
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./Index";
import MapPage from "./MapPage"; // 너희 프로젝트 이름에 맞춰 유지
import NotFound from "./NotFound";
import AdminGeocode from "./AdminGeocode"; // ✅ 추가

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Index />} />
        <Route path="/map" element={<MapPage />} />
        <Route path="/admin/geocode" element={<AdminGeocode />} /> {/* ✅ 추가 */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}
