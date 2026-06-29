import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "../context/AuthProvider";
import { TasteDataProvider } from "../context/TasteDataProvider";
import { PublicProfilePage } from "../pages/PublicProfilePage";
import { AdminPage } from "../pages/AdminPage";

export function AppRouter() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <TasteDataProvider>
          <Routes>
            <Route path="/" element={<PublicProfilePage />} />
            <Route path="/admin/*" element={<AdminPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </TasteDataProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
