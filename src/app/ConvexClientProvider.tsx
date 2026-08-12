"use client";
import { ConvexProviderWithAuth, ConvexReactClient } from "convex/react";
import { ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import PasswordGate from "@/components/PasswordGate";

const convex = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

function useMisticaAuth() {
  const [state, setState] = useState({ isLoading: true, isAuthenticated: false });

  useEffect(() => {
    fetch("/api/auth/status", { cache: "no-store" })
      .then((response) => response.json())
      .then(({ authed }) => setState({ isLoading: false, isAuthenticated: Boolean(authed) }))
      .catch(() => setState({ isLoading: false, isAuthenticated: false }));
  }, []);

  const fetchAccessToken = useCallback(async () => {
    const response = await fetch("/api/auth/token", { cache: "no-store" });
    if (!response.ok) return null;
    return (await response.json()).token as string;
  }, []);

  return useMemo(() => ({ ...state, fetchAccessToken }), [state, fetchAccessToken]);
}

export function ConvexClientProvider({ children }: { children: ReactNode }) {
  return (
    <ConvexProviderWithAuth client={convex} useAuth={useMisticaAuth}>
      <PasswordGate>{children}</PasswordGate>
    </ConvexProviderWithAuth>
  );
}
