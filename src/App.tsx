// src/App.tsx
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
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
    <BrowserRouter>
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

            {/* 어드민 */}
            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<Navigate to="dashboard" replace />} />
              <Route path="dashboard" element={<DashboardPage />} />
              <Route path="inquiries" element={<InquiriesPage />} />
            </Route>

            {/* 유틸/디버그 */}
            <Route path="/supa-debug" element={<SupaDebugPage />} />

            {/* 404 */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AppLayout>
      </Suspense>
    </BrowserRouter>
  );
}
