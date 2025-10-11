import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Suspense, lazy } from "react";

// 페이지
const HomePage = lazy(() => import("./pages/HomePage"));
const MapPage = lazy(() => import("./pages/MapPage"));
const InquiriesPage = lazy(() => import("./pages/admin/InquiriesPage"));
const NotFound = lazy(() => import("./pages/NotFound"));
const SupaDebugPage = lazy(() => import("./pages/SupaDebug"));

// 어드민
const AdminLayout = lazy(() => import("./pages/admin/AdminLayout"));
const DashboardPage = lazy(() => import("./pages/admin/DashboardPage"));

// 모바일 레이아웃(App Shell)
import MobileLayout from "@/layouts/MobileLayout";

export default function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<div className="p-6">까꿍 !</div>}>
        <Routes>
          {/* ===== 사용자 영역: 모바일 레이아웃로 감싸기 ===== */}
          <Route element={<MobileLayout />}>
            <Route index element={<HomePage />} /> {/* "/" */}
            <Route path="map" element={<MapPage />} /> {/* "/map" */}
            {/* 추후: packages/saved/account/search 등도 여기에 추가 */}
          </Route>

          {/* ===== Admin ===== */}
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<DashboardPage />} />
            <Route path="inquiries" element={<InquiriesPage />} />
          </Route>

          {/* ===== 도구 페이지 ===== */}
          <Route path="/supa-debug" element={<SupaDebugPage />} />

          {/* ===== 404 ===== */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
