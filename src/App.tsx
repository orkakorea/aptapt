// src/App.tsx
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { Suspense, lazy, PropsWithChildren } from "react";

import NavBar from "@/components/layout/NavBar"; // 공통 헤더

const HomePage = lazy(() => import("./pages/HomePage"));
const MapPage = lazy(() => import("./pages/MapPage"));
const InquiriesPage = lazy(() => import("./pages/admin/InquiriesPage"));
const NotFound = lazy(() => import("./pages/NotFound"));
const SupaDebugPage = lazy(() => import("./pages/SupaDebug"));
const AdminLayout = lazy(() => import("./pages/admin/AdminLayout"));
const DashboardPage = lazy(() => import("./pages/admin/DashboardPage"));
const MapMobilePageV2 = lazy(() => import("./pages/mobile")); // /mobile (index.tsx의 default export)

/** 경로에 따라 헤더를 조건부로 노출하는 레이아웃 */
function AppLayout({ children }: PropsWithChildren) {
  const { pathname } = useLocation();
  // "/" 와 "/map" 계열에서만 헤더 노출 (모바일 경로는 숨김)
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
      <Suspense fallback={<div className="p-6">까꿍 !</div>}>
        <AppLayout>
          <Routes>
            {/* 홈 / PC 지도 */}
            <Route path="/" element={<HomePage />} />
            <Route path="/map" element={<MapPage />} />

            {/* 모바일 지도 (정식 경로) */}
            <Route path="/mobile" element={<MapMobilePageV2 />} />

            {/* 과거 경로 호환 → /mobile로 리다이렉트 */}
            <Route path="/m2" element={<Navigate to="/mobile" replace />} />
            <Route path="/m" element={<Navigate to="/mobile" replace />} />
            {/* 필요 시 예전 /mobile/v2도 함께 묶기 */}
            {/* <Route path="/mobile/v2" element={<Navigate to="/mobile" replace />} /> */}

            {/* Admin */}
            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<Navigate to="dashboard" replace />} />
              <Route path="dashboard" element={<DashboardPage />} />
              <Route path="inquiries" element={<InquiriesPage />} />
            </Route>

            {/* 도구/디버그 */}
            <Route path="/supa-debug" element={<SupaDebugPage />} />

            {/* 404 */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AppLayout>
      </Suspense>
    </BrowserRouter>
  );
}
