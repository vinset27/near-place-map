import React, { useEffect } from "react";
import { useLocation } from "wouter";
import { isOnboardingComplete } from "@/lib/onboarding";

export function RequireOnboarding({ children }: { children: React.ReactNode }) {
  const [location, setLocation] = useLocation();

  useEffect(() => {
    if (isOnboardingComplete()) return;
    const next = typeof window !== "undefined" ? window.location.pathname + window.location.search : location;
    setLocation(`/welcome?next=${encodeURIComponent(next)}`);
  }, [location, setLocation]);

  if (!isOnboardingComplete()) return null;
  return <>{children}</>;
}


