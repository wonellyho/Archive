import { createContext, useContext } from "react";

export interface AuthValue {
  /** "local" = no Supabase configured (always owner). */
  mode: "local" | "supabase";
  /** Whether the current viewer may edit (owner). */
  isOwner: boolean;
  /** False until the initial session check finishes (supabase mode). */
  ready: boolean;
  /** Returns an error message, or null on success. */
  signIn: (email: string, password: string) => Promise<string | null>;
  signOut: () => Promise<void>;
}

export const AuthContext = createContext<AuthValue | null>(null);

export function useAuth(): AuthValue {
  const value = useContext(AuthContext);
  if (value === null) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return value;
}
