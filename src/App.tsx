// src/App.tsx
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { Suspense, lazy, PropsWithChildren } from "react";
import NavBar from "@/components/layout/NavBar";
import MobileRedirectGuard from "@/components/routing/MobileRedirectGuard"; // ✅ 추가

const HomePage = lazy(() => import("./pages/HomePage"));
const MapPage = lazy(() => import("./pages/MapPage"));
const InquiriesPage = lazy(() => import("./pages/admin/InquiriesPage"));
const NotFound = lazy(() => import("./pages/NotFound"));
const SupaDebugPage = lazy(() => import("./pages/SupaDebug"));
const AdminLayout = lazy(() => import("./pages/admin/AdminLayout"));
const DashboardPage = lazy(() => import("./pages/admin/DashboardPage"));
const MapMobilePageV2 = lazy(() => import("./pages/mobile")); // /mobile

function AppLayout({ children }: PropsWithChildren) {
  const { pathname } = useLocation();
  const showHeader = pathname === "/" || pathname.startsWith("/map");

  return (
    <div className="flex flex-col min-h-screen">
      <MobileRedirectGuard /> {/* ✅ 여기서 항상 감시 */}
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
            <Route path="/" element={<HomePage />} />
            <Route path="/map" element={<MapPage />} />
            <Route path="/mobile" element={<MapMobilePageV2 />} />
            <Route path="/m2" element={<Navigate to="/mobile" replace />} />
            <Route path="/m" element={<Navigate to="/mobile" replace />} />
            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<Navigate to="dashboard" replace />} />
              <Route path="dashboard" element={<DashboardPage />} />
              <Route path="inquiries" element={<InquiriesPage />} />
            </Route>
            <Route path="/supa-debug" element={<SupaDebugPage />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AppLayout>
      </Suspense>
    </BrowserRouter>
  );
}
