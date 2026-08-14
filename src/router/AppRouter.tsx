import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "../context/AuthProvider";
import { TasteDataProvider } from "../context/TasteDataProvider";
import { PublicProfilePage } from "../pages/PublicProfilePage";
import { UserArchivePage } from "../pages/UserArchivePage";
import { AdminPage } from "../pages/AdminPage";

export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        {/* 내 아카이브(홈) — 로그인 게이팅은 랜딩 페이지 작업(#66)에서 추가 예정 */}
        <Route
          path="/"
          element={
            <AuthProvider>
              <TasteDataProvider>
                <PublicProfilePage />
              </TasteDataProvider>
            </AuthProvider>
          }
        />
        {/* 남의 공개 아카이브 — 항상 읽기 전용(#66) */}
        <Route path="/u/:username" element={<UserArchivePage />} />
        <Route path="/admin/*" element={<AdminPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
