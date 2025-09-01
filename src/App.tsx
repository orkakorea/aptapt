// src/App.tsx
import React, { Suspense, lazy } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { RootLayout } from "./layouts/RootLayout";
import HomePage from "./pages/HomePage";
import MapPage from "./pages/MapPage";

// Lazy load pages
const SupaDebugPage = lazy(() => import("./pages/SupaDebug"));

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<RootLayout />}>
          <Route index element={<HomePage />} />
          <Route path="explore" element={<div className="py-20 text-center"><h1 className="text-4xl font-bold text-text-strong">Explore</h1><p className="text-text-muted mt-4">Coming soon...</p></div>} />
          <Route path="pricing" element={<div className="py-20 text-center"><h1 className="text-4xl font-bold text-text-strong">Pricing</h1><p className="text-text-muted mt-4">Coming soon...</p></div>} />
          <Route path="cases" element={<div className="py-20 text-center"><h1 className="text-4xl font-bold text-text-strong">Cases</h1><p className="text-text-muted mt-4">Coming soon...</p></div>} />
          <Route path="cm-song" element={<div className="py-20 text-center"><h1 className="text-4xl font-bold text-text-strong">CM Song</h1><p className="text-text-muted mt-4">Coming soon...</p></div>} />
          <Route path="contact" element={<div className="py-20 text-center"><h1 className="text-4xl font-bold text-text-strong">Contact</h1><p className="text-text-muted mt-4">Coming soon...</p></div>} />
          <Route path="terms" element={<div className="py-20 text-center"><h1 className="text-4xl font-bold text-text-strong">Terms</h1><p className="text-text-muted mt-4">Coming soon...</p></div>} />
          <Route path="privacy" element={<div className="py-20 text-center"><h1 className="text-4xl font-bold text-text-strong">Privacy</h1><p className="text-text-muted mt-4">Coming soon...</p></div>} />
          <Route path="map" element={<MapPage />} />
          <Route
            path="supa-debug"
            element={
              <Suspense fallback={<div style={{ padding: 20 }}>Loading…</div>}>
                <SupaDebugPage />
              </Suspense>
            }
          />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
