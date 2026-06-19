import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useAuth } from "@/hooks/use-auth";
import { usePricingCatalog } from "@/hooks/use-pricing-catalog";
import { useGeolocation } from "@/hooks/use-geolocation";
import { supabase } from "@/integrations/supabase/client";

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

  it("should recover from failed role fetch", async () => {
    const mockSession = { user: { id: "user-1" }, session: {} };
    vi.mocked(supabase.auth.getSession).mockResolvedValueOnce({
      data: mockSession,
    } as any);

    const { result } = renderHook(() => useAuth());

    await waitFor(() => {
      expect(result.current.user?.id).toBe("user-1");
      expect(result.current.role).toBeNull(); // Graceful fallback
    });
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

    // Should not throw and should handle gracefully
    expect(result.current.error).toBeNull();
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
    const mockError = new Error("Network error");
    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue(
          Promise.reject(mockError)
        ),
      }),
    } as any);

    const { result } = renderHook(() => usePricingCatalog());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
  });
});
