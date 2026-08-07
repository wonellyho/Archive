import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { isSupabaseConfigured, supabase } from "../services/supabaseClient";
import { AuthContext } from "./authContext";
import type { AuthValue } from "./authContext";

interface AuthProviderProps {
  children: ReactNode;
  /**
   * Skips the Supabase session sync and always reports isOwner=false — used
   * for `/u/:username` (#66), which must stay read-only no matter who's
   * actually logged in (viewing your own share link isn't "owning" that page;
   * editing only ever happens on `/`).
   */
  forceReadOnly?: boolean;
}

export function AuthProvider({ children, forceReadOnly }: AuthProviderProps) {
  // localStorage mode: there is no auth, so the local user is always the owner.
  const [isOwner, setIsOwner] = useState(!isSupabaseConfigured && !forceReadOnly);
  const [ready, setReady] = useState(Boolean(!isSupabaseConfigured || forceReadOnly));

  useEffect(() => {
    if (!supabase || forceReadOnly) return;
    let active = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setIsOwner(data.session !== null);
      setReady(true);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsOwner(session !== null);
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [forceReadOnly]);

  const signIn = useCallback(async (email: string, password: string) => {
    if (!supabase) return null;
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return error ? error.message : null;
  }, []);

  const signOut = useCallback(async () => {
    await supabase?.auth.signOut();
  }, []);

  const value = useMemo<AuthValue>(
    () => ({
      mode: isSupabaseConfigured ? "supabase" : "local",
      isOwner,
      ready,
      signIn,
      signOut,
    }),
    [isOwner, ready, signIn, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
