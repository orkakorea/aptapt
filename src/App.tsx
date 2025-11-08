// src/App.tsx
import { BrowserRouter, HashRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { Suspense, lazy, PropsWithChildren } from "react";
import NavBar from "@/components/layout/NavBar";
import MobileRedirectGuard from "@/components/routing/MobileRedirectGuard";

const HomePage = lazy(() => import("./pages/HomePage"));
const MapPage = lazy(() => import("./pages/MapPage"));
const InquiriesPage = lazy(() => import("./pages/admin/InquiriesPage"));
const NotFound = lazy(() => import("./pages/NotFound"));
const SupaDebugPage = lazy(() => import("./pages/SupaDebug"));
const AdminLayout = lazy(() => import("./pages/admin/AdminLayout"));
const DashboardPage = lazy(() => import("./pages/admin/DashboardPage"));
const MapMobilePageV2 = lazy(() => import("./pages/mobile")); // -> src/pages/mobile/index.tsx

// ✅ 프로덕션 관리자 노출 플래그
const ENABLE_ADMIN = String(import.meta.env.VITE_FEATURE_ADMIN ?? "false") === "true";

// ✅ HashRouter 토글 (러버블/프리뷰에서 404 방지)
//  - .env (개발/프리뷰): VITE_USE_HASH_ROUTER=true  → URL이 /#/... 형태
//  - .env.production(리라이트 설정된 서버면): false로 두고 BrowserRouter 사용
const USE_HASH = String(import.meta.env.VITE_USE_HASH_ROUTER ?? "true") === "true";
const Router = USE_HASH ? HashRouter : BrowserRouter;

function AppLayout({ children }: PropsWithChildren) {
  const { pathname } = useLocation();
  const showHeader = pathname === "/" || pathname.startsWith("/map");

  return (
    <div className="flex flex-col min-h-screen">
      <MobileRedirectGuard />
      {showHeader && <NavBar />}
      <main className="flex-1">{children}</main>
    </div>
  );
}

export default function App() {
  return (
    <Router>
      <Suspense fallback={<div className="p-6">WELCOME !</div>}>
        <AppLayout>
          <Routes>
            {/* 데스크톱 홈 */}
            <Route path="/" element={<HomePage />} />

            {/* 데스크톱 맵 */}
            <Route path="/map" element={<MapPage />} />

            {/* 모바일 전용 페이지 */}
            <Route path="/mobile" element={<MapMobilePageV2 />} />
            <Route path="/m2" element={<Navigate to="/mobile" replace />} />
            <Route path="/m" element={<Navigate to="/mobile" replace />} />

            {/* 어드민 — 플래그 기반 노출/차단 */}
            {ENABLE_ADMIN ? (
              <Route path="/admin" element={<AdminLayout />}>
                <Route index element={<Navigate to="dashboard" replace />} />
                <Route path="dashboard" element={<DashboardPage />} />
                <Route path="inquiries" element={<InquiriesPage />} />
              </Route>
            ) : (
              <Route path="/admin/*" element={<Navigate to="/" replace />} />
            )}

            {/* 유틸/디버그 */}
            <Route path="/supa-debug" element={<SupaDebugPage />} />

            {/* 404 */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AppLayout>
      </Suspense>
    </Router>
  );
}
