// src/App.tsx
// App.tsx 상단
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Suspense, lazy } from "react";   // ← 이 줄 추가!

const HomePage = lazy(() => import("./pages/HomePage"));
const MapPage = lazy(() => import("./pages/MapPage"));
const InquiriesPage = lazy(() => import("./pages/admin/InquiriesPage"));
const NotFound = lazy(() => import("./pages/NotFound"));


// /supa-debug는 필요할 때만 로드
const SupaDebugPage = lazy(() => import("./pages/SupaDebug"));

export default function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<div className="p-6">로딩중…</div>}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/map" element={<MapPage />} />
          <Route path="/admin/inquiries" element={<InquiriesPage />} />
          <Route path="/admin" element={<Navigate to="/admin/inquiries" replace />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
