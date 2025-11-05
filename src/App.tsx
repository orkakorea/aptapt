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

// =============================
// Router mode switches by .env
// =============================
// .env(.local/.production)
//   VITE_USE_HASH_ROUTER=true  → HashRouter 사용 (주소: /#/admin)
//   VITE_USE_HASH_ROUTER=false → BrowserRouter 사용 (주소: /admin)
const USE_HASH = String(import.meta.env.VITE_USE_HASH_ROUTER ?? "false") === "true";

// 프로덕션에서 관리자 라우트 노출 제어
// .env.production: VITE_FEATURE_ADMIN=false  → /admin 접근 시 홈으로 리다이렉트
// .env.local(or development): VITE_FEATURE_ADMIN=true → /admin 라우트 표시
const ENABLE_ADMIN = String(import.meta.env.VITE_FEATURE_ADMIN ?? "false") === "true";

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

function AppRoutes() {
  return (
    <Suspense fallback={<div className="p-6">WELCOME !</div>}>
      <AppLayout>
        <Routes>
          {/* 데스크톱 홈 */}
          <Route path="/" element={<HomePage />} />

          {/* 데스크톱 맵 */}
          <Route path="/map" element={<MapPage />} />

          {/* 모바일 전용 페이지 (src/pages/mobile/index.tsx) */}
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
            // 플래그 OFF일 때 우회 접근도 홈으로 정리
            <Route path="/admin/*" element={<Navigate to="/" replace />} />
          )}

          {/* 유틸/디버그 */}
          <Route path="/supa-debug" element={<SupaDebugPage />} />

          {/* 404 */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </AppLayout>
    </Suspense>
  );
}

export default function App() {
  if (USE_HASH) {
    return (
      <HashRouter>
        <AppRoutes />
      </HashRouter>
    );
  }
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}
