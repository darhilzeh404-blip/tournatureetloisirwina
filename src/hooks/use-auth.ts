import { useEffect, useCallback, useSyncExternalStore } from "react";
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

const INITIAL_AUTH_STATE: AuthState = {
  user: null,
  session: null,
  role: null,
  isLoading: true,
  isAuthenticated: false,
};

/**
 * Shared module-level auth store.
 *
 * Prior to this refactor each `useAuth()` caller (Header, guards, ~30 routes)
 * created its own `getSession` + `user_roles` fetch + `onAuthStateChange`
 * subscription. On every navigation this fired 4-6 parallel Supabase requests
 * and left the app frozen on slow networks / Android WebView.
 *
 * We now do the work ONCE per tab and let every hook consumer subscribe to
 * the same snapshot.
 */
let currentState: AuthState = INITIAL_AUTH_STATE;

const AUTH_TIMEOUT_MS = 7_000;
const ROLE_TIMEOUT_MS = 4_000;
const AUTH_EVENT_ROLE_TIMEOUT_MS = 2_500;

function withTimeout<T>(promise: PromiseLike<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    Promise.resolve(promise),
    new Promise<T>((_, reject) => {
      globalThis.setTimeout(() => reject(new Error(`${label} trop lente. Réessayez dans quelques secondes.`)), ms);
    }),
  ]);
}

function clearBrokenAuthStorage() {
  if (typeof window === "undefined") return;
  try {
    Object.keys(window.localStorage)
      .filter((key) => key === "supabase.auth.token" || (key.startsWith("sb-") && key.endsWith("-auth-token")))
      .forEach((key) => window.localStorage.removeItem(key));
  } catch {}
}

function isRefreshTokenFailure(err: unknown) {
  const message = err instanceof Error ? err.message : String(err ?? "");
  return /refresh.*token|refresh_token_not_found|Invalid Refresh Token/i.test(message);
}

const listeners = new Set<() => void>();
let initialized = false;
let roleCache: Record<string, AppRole | null> = {};

function emit() {
  listeners.forEach((l) => l());
}

function setState(next: AuthState) {
  currentState = next;
  emit();
}

async function fetchRole(userId: string): Promise<AppRole | null> {
  if (userId in roleCache) return roleCache[userId];
  try {
    const { data, error } = await withTimeout(
      supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .limit(1)
        .maybeSingle(),
      ROLE_TIMEOUT_MS,
      "Lecture du rôle utilisateur",
    );
    if (error) {
      console.error("[useAuth] fetchRole error:", error);
      return null;
    }
    const role = (data?.role as AppRole) ?? null;
    roleCache[userId] = role;
    return role;
  } catch (err) {
    console.error("[useAuth] fetchRole exception:", err);
    return null;
  }
}

let readyPromise: Promise<AuthState> | null = null;
let authSubscription: { unsubscribe: () => void } | null = null;

function initAuth() {
  // Auth is browser-only. Running it during SSR mutates module-level state
  // across requests and creates hydration mismatches/freezes on mobile WebView.
  if (typeof window === "undefined") return;
  if (initialized) return;
  initialized = true;

  readyPromise = withTimeout(supabase.auth.getSession(), AUTH_TIMEOUT_MS, "Initialisation de session")
    .then(async ({ data: { session } }) => {
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
        setState({ ...currentState, isLoading: false });
      }
      return currentState;
    })
    .catch((err) => {
      console.error("[useAuth] getSession error:", err);
      // Refresh-token failures (400 "refresh_token_not_found") leave a bad
      // token in storage; clear it so subsequent calls stop hammering /token.
      if (isRefreshTokenFailure(err)) clearBrokenAuthStorage();
      try { supabase.auth.signOut({ scope: "local" } as any); } catch {}
      setState({ ...currentState, isLoading: false });
      return currentState;
    });

  const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
    if (session?.user) {
      setState({
        user: session.user,
        session,
        role: roleCache[session.user.id] ?? currentState.role,
        isLoading: false,
        isAuthenticated: true,
      });

      // Defer role lookup outside the auth callback. Calling async auth/db work
      // directly inside the callback can deadlock auth-js on Android WebView.
      window.setTimeout(() => {
        withTimeout(fetchRole(session.user.id), AUTH_EVENT_ROLE_TIMEOUT_MS, "Lecture du rôle utilisateur")
          .then((role) => {
            if (currentState.user?.id !== session.user.id) return;
            setState({
              user: session.user,
              session,
              role,
              isLoading: false,
              isAuthenticated: true,
            });
          })
          .catch((err) => console.warn("[useAuth] deferred role lookup skipped:", err));
      }, 0);
    } else {
      roleCache = {};
      setState({
        user: null,
        session: null,
        role: null,
        isLoading: false,
        isAuthenticated: false,
      });
    }
  });
  authSubscription = subscription;
}

export function resetAuthRuntime() {
  try { authSubscription?.unsubscribe(); } catch {}
  authSubscription = null;
  initialized = false;
  readyPromise = null;
  roleCache = {};
  setState({ ...INITIAL_AUTH_STATE, isLoading: false });
}

export function recoverAndroidAuthFreeze() {
  if (typeof window === "undefined") return;
  clearBrokenAuthStorage();
  try { supabase.auth.signOut({ scope: "local" } as any); } catch {}
  resetAuthRuntime();
}
        setState({
          user: session.user,
          session,
          role,
          isLoading: false,
          isAuthenticated: true,
        });
      });
    } else {
      roleCache = {};
      setState({
        user: null,
        session: null,
        role: null,
        isLoading: false,
        isAuthenticated: false,
      });
    }
  });
}

/**
 * For non-React callers (route `beforeLoad`). Resolves with the first
 * ready snapshot and reuses the same in-flight request across the app.
 */
export async function waitForAuth(): Promise<AuthState> {
  if (typeof window === "undefined") {
    return { ...INITIAL_AUTH_STATE, isLoading: false };
  }
  initAuth();
  if (!currentState.isLoading) return currentState;
  return readyPromise ?? currentState;
}


function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): AuthState {
  return currentState;
}

function getServerSnapshot(): AuthState {
  return INITIAL_AUTH_STATE;
}

export function useAuth() {
  // Kick off the shared init on the first mount, once per tab.
  useEffect(() => {
    initAuth();
  }, []);

  const state = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const signIn = useCallback(async (email: string, password: string): Promise<AuthState> => {
    const { data, error } = await withTimeout(
      supabase.auth.signInWithPassword({ email, password }),
      AUTH_TIMEOUT_MS,
      "Connexion",
    );
    if (error) throw error;

    if (data.session?.user) {
      const role = await fetchRole(data.session.user.id);
      const nextState = {
        user: data.session.user,
        session: data.session,
        role,
        isLoading: false,
        isAuthenticated: true,
      };
      setState(nextState);
      return nextState;
    }

    const nextState = { ...currentState, isLoading: false };
    setState(nextState);
    return nextState;
  }, []);

  const signUp = useCallback(async (email: string, password: string, fullName: string) => {
    const { error } = await withTimeout(
      supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName } },
      }),
      AUTH_TIMEOUT_MS,
      "Création du compte",
    );
    if (error) throw error;
  }, []);

  const signOut = useCallback(async () => {
    await withTimeout(supabase.auth.signOut(), AUTH_TIMEOUT_MS, "Déconnexion");
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

export type { AuthState };
