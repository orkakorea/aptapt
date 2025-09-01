// src/App.tsx
import React, { Suspense, lazy } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import MapPage from "./pages/MapPage";
import HeroFigma from "./components/HeroFigma";

// /supa-debug는 필요할 때만 로드
const SupaDebugPage = lazy(() => import("./pages/SupaDebug"));

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* 홈: Figma 그대로의 Hero만 표시 */}
        <Route path="/" element={<HeroFigma />} />

        {/* 지도 페이지 */}
        <Route path="/map" element={<MapPage />} />

        {/* Supabase 디버그 (지연 로드) */}
        <Route
          path="/supa-debug"
          element={
            <Suspense fallback={<div style={{ padding: 20 }}>Loading…</div>}>
              <SupaDebugPage />
            </Suspense>
          }
        />

        {/* 기타 경로 → 홈으로 */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
