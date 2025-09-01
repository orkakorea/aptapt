import MapPage from "./pages/MapPage";
// ...
const router = createBrowserRouter([
  { path: "/", element: <RootLayout />, children: [
      { index: true, element: <Home /> },
      { path: "/map", element: <MapPage /> }, // ← 추가
  ]},
]);
