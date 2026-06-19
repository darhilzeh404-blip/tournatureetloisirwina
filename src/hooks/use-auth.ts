import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";

export type AppRole = "admin" | "gerant" | "chauffeur" | "client" | "agence";

interface AuthState {
  user: User | null;
  session: Session | null;
  role: AppRole | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    user: null,
    session: null,
    role: null,
    isLoading: true,
    isAuthenticated: false,
  });

  const fetchRole = useCallback(async (userId: string): Promise<AppRole | null> => {
    try {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .limit(1)
        .single();
      if (error) {
        console.error("[useAuth] fetchRole error:", error);
        return null;
      }
      return (data?.role as AppRole) ?? null;
    } catch (err) {
      console.error("[useAuth] fetchRole exception:", err);
      return null;
    }
  }, []);

  useEffect(() => {
    // 1. Restore session from storage FIRST
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        const role = await fetchRole(session.user.id);
        setState({
          user: session.user,
          session,
          role,
          isLoading: false,
          isAuthenticated: true,
        });
      } else {
        setState(s => ({ ...s, isLoading: false }));
      }
    }).catch((err) => {
      console.error("[useAuth] getSession error:", err);
      setState(s => ({ ...s, isLoading: false }));
    });

    // 2. Listen for auth changes — DO NOT await inside callback (causes deadlock)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (session?.user) {
          // Fire-and-forget role fetch to avoid blocking the auth event queue
          fetchRole(session.user.id).then((role) => {
            setState({
              user: session.user,
              session,
              role,
              isLoading: false,
              isAuthenticated: true,
            });
          });
        } else {
          setState({
            user: null,
            session: null,
            role: null,
            isLoading: false,
            isAuthenticated: false,
          });
        }
      }
    );

    return () => subscription.unsubscribe();
  }, [fetchRole]);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  }, []);

  const signUp = useCallback(async (email: string, password: string, fullName: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    });
    if (error) throw error;
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  return { ...state, signIn, signUp, signOut };
}

export function getRoleRedirectPath(role: AppRole | null): string {
  switch (role) {
    case "admin": return "/admin";
    case "gerant": return "/gerant";
    case "chauffeur": return "/chauffeur";
    case "agence": return "/agence";
    case "client": return "/";
    default: return "/";
  }
}
