import React, { useEffect } from "react";
import { useLocation } from "wouter";
import { isOnboardingComplete } from "@/lib/onboarding";

export default function Entry() {
  const [, setLocation] = useLocation();

  useEffect(() => {
    const next = "/app";
    if (isOnboardingComplete()) setLocation(next);
    else setLocation(`/welcome?next=${encodeURIComponent(next)}`);
  }, [setLocation]);

  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
      <div className="text-center space-y-2">
        <div className="text-sm text-muted-foreground">Chargement…</div>
      </div>
    </div>
  );
}


