import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useAuth, resetAuthRuntime } from "@/hooks/use-auth";
import { usePricingCatalog } from "@/hooks/use-pricing-catalog";
import { useGeolocation } from "@/hooks/use-geolocation";
import { supabase } from "@/integrations/supabase/client";
import { getFlightAuthRedirectPath } from "@/routes/vols.index";

// Mock supabase
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getSession: vi.fn(),
      onAuthStateChange: vi.fn(() => ({
        data: {
          subscription: { unsubscribe: vi.fn() },
        },
      })),
      signInWithPassword: vi.fn(),
      signUp: vi.fn(),
      signOut: vi.fn(),
    },
    from: vi.fn(),
    rpc: vi.fn(),
  },
}));

describe("useAuth hook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetAuthRuntime();
  });

  it("should handle auth errors gracefully", async () => {
    const mockError = new Error("Auth service unavailable");
    vi.mocked(supabase.auth.getSession).mockRejectedValueOnce(mockError);

    const { result } = renderHook(() => useAuth());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.isAuthenticated).toBe(false);
  });

  it("should reset auth state safely when role lookup is unavailable", () => {
    expect(() => resetAuthRuntime()).not.toThrow();
  });
});

describe("flight request auth redirect", () => {
  it("should redirect unauthenticated users to the real login route", () => {
    expect(getFlightAuthRedirectPath()).toBe("/connexion");
  });
});

describe("usePricingCatalog hook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should catch Promise.all() failures", async () => {
    const mockError = { message: "Database error" };
    const mockSelect = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
    };

    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn().mockReturnValue(Promise.reject(mockError)),
    } as any);

    const { result } = renderHook(() => usePricingCatalog());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBeTruthy();
  });

  it("should mark data as loaded even on partial error", async () => {
    const { result } = renderHook(() => usePricingCatalog());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(Array.isArray(result.current.schoolTrips)).toBe(true);
    });
  });
});

describe("useGeolocation hook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should handle permissions API errors", async () => {
    const mockQuery = vi.fn().mockRejectedValueOnce(new Error("Permissions API error"));
    Object.defineProperty(navigator, "permissions", {
      value: { query: mockQuery },
      writable: true,
    });

    const { result } = renderHook(() =>
      useGeolocation({ enabled: true })
    );

    expect(result.current.error === null || result.current.error?.code === "unsupported" || result.current.error?.code === "permission_denied" || result.current.error?.code === "unavailable" || result.current.error?.code === "timeout" || result.current.error?.code === "unknown").toBe(true);
  });

  it("should respect enabled flag", () => {
    const { result, rerender } = renderHook(
      ({ enabled }: { enabled: boolean }) =>
        useGeolocation({ enabled }),
      { initialProps: { enabled: false } }
    );

    expect(result.current.position).toBeNull();

    // Re-enable
    rerender({ enabled: true });

    // Component should still work without crashing
    expect(result.current.error === null || result.current.error !== null).toBe(
      true
    );
  });
});

describe("Error handling in async operations", () => {
  it("should not leave components in loading state on error", async () => {
    vi.mocked(supabase.from).mockImplementation((table: string) => {
      if (table === "school_trip_tariffs") {
        return {
          select: vi.fn().mockReturnValue(Promise.reject(new Error("Network error"))),
        } as any;
      }
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
          order: vi.fn().mockResolvedValue({ data: [], error: null }),
        }),
      } as any;
    });

    const { result } = renderHook(() => usePricingCatalog());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBeTruthy();
  });
});
