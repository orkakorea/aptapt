// src/App.tsx
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import InquiriesPage from "./pages/admin/InquiriesPage";
import HomePage from "./pages/HomePage";   // 또는 Index.tsx를 쓰면 그걸 임포트
import MapPage from "./pages/MapPage";
import NotFound from "./pages/NotFound";


// /supa-debug는 필요할 때만 로드
const SupaDebugPage = lazy(() => import("./pages/SupaDebug"));

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />          {/* 또는 <Index /> */}
        <Route path="/map" element={<MapPage />} />
        <Route path="/admin/inquiries" element={<InquiriesPage />} />
        <Route path="/admin" element={<Navigate to="/admin/inquiries" replace />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}

