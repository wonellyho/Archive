import { useMemo } from "react";
import { Navigate, useParams } from "react-router-dom";
import { AuthProvider } from "../context/AuthProvider";
import { TasteDataProvider } from "../context/TasteDataProvider";
import { publicRepository } from "../services/apiRepository";
import { PublicProfilePage } from "./PublicProfilePage";

/**
 * `/u/:username` — someone's public, read-only archive (#66). Always
 * read-only regardless of who's logged in: uses `publicRepository(username)`
 * (GET /api/u/{username}, write methods rejected) and `AuthProvider
 * forceReadOnly` (isOwner stays false even for the archive's own owner —
 * editing only happens on `/`).
 */
export function UserArchivePage() {
  const { username } = useParams<{ username: string }>();
  const repository = useMemo(
    () => (username ? publicRepository(username) : null),
    [username],
  );

  if (!repository) return <Navigate to="/" replace />;

  return (
    <AuthProvider forceReadOnly>
      <TasteDataProvider repository={repository}>
        <PublicProfilePage readOnly />
      </TasteDataProvider>
    </AuthProvider>
  );
}
