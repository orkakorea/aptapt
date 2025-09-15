// src/App.tsx
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { Suspense, lazy, PropsWithChildren } from "react";

import NavBar from "@/components/layout/NavBar"; // 공통 헤더

const HomePage = lazy(() => import("./pages/HomePage"));
const MapPage = lazy(() => import("./pages/MapPage"));
const InquiriesPage = lazy(() => import("./pages/admin/InquiriesPage"));
const NotFound = lazy(() => import("./pages/NotFound"));
const SupaDebugPage = lazy(() => import("./pages/SupaDebug"));

/** 경로에 따라 헤더를 조건부로 노출하는 레이아웃 */
function AppLayout({ children }: PropsWithChildren) {
  const { pathname } = useLocation();

  // "/" 와 "/map" 계열에서만 헤더 노출
  const showHeader = pathname === "/" || pathname.startsWith("/map");

  return (
    <div className="flex flex-col min-h-screen">
      {showHeader && <NavBar />}
      <main className="flex-1">{children}</main>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<div className="p-6">로딩중…</div>}>
        <AppLayout>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/map" element={<MapPage />} />

            {/* Admin */}
            <Route path="/admin/inquiries" element={<InquiriesPage />} />
            <Route path="/admin" element={<Navigate to="/admin/inquiries" replace />} />

            {/* 도구 페이지 (필요 시) */}
            <Route path="/supa-debug" element={<SupaDebugPage />} />

            {/* 404 */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AppLayout>
      </Suspense>
    </BrowserRouter>
  );
}
