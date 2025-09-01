// src/App.tsx
import React, { Suspense, lazy } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Landing from "./pages/Landing";
import MapPage from "./pages/MapPage";

// /supa-debug는 필요할 때만 로드
const SupaDebugPage = lazy(() => import("./pages/SupaDebug"));

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/map" element={<MapPage />} />
        <Route
          path="/supa-debug"
          element={
            <Suspense fallback={<div style={{ padding: 20 }}>Loading…</div>}>
              <SupaDebugPage />
            </Suspense>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
