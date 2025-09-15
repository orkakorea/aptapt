// src/App.tsx
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Suspense, lazy } from "react";

import NavBar from "@/components/layout/NavBar"; // ← NavBar 임포트

const HomePage = lazy(() => import("./pages/HomePage"));
const MapPage = lazy(() => import("./pages/MapPage"));
const InquiriesPage = lazy(() => import("./pages/admin/InquiriesPage"));
const NotFound = lazy(() => import("./pages/NotFound"));

// /supa-debug는 필요할 때만 로드
const SupaDebugPage = lazy(() => import("./pages/SupaDebug"));

export default function App() {
  return (
    <BrowserRouter>
      <div className="flex flex-col min-h-screen">
        {/* 공통 헤더 */}
        <NavBar />

        {/* 메인 콘텐츠 */}
        <main className="flex-1">
          <Suspense fallback={<div className="p-6">로딩중…</div>}>
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/map" element={<MapPage />} />
              <Route path="/admin/inquiries" element={<InquiriesPage />} />
              <Route
                path="/admin"
                element={<Navigate to="/admin/inquiries" replace />}
              />
              <Route path="/supa-debug" element={<SupaDebugPage />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </main>
      </div>
    </BrowserRouter>
  );
}
