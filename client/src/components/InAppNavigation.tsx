import React, { useEffect, useMemo, useState } from "react";
import { type RouteInfo, formatDistance, formatDuration } from "@/lib/routing";
import { haversineMeters } from "@/lib/geo";
import { cn } from "@/lib/utils";
import { ChevronUp, Navigation2, Route, X } from "lucide-react";
import { Button } from "@/components/ui/button";

type Props = {
  route: RouteInfo | null | undefined;
  userLoc: { lat: number; lng: number };
  active: boolean;
  onStop: () => void;
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export default function InAppNavigation({ route, userLoc, active, onStop }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);

  // Reset when route changes
  useEffect(() => {
    setStepIndex(0);
  }, [route?.distance, route?.duration]);

  const steps = route?.steps ?? [];

  // Advance step when close to the maneuver point
  useEffect(() => {
    if (!active) return;
    if (!route) return;
    if (!steps.length) return;
    if (stepIndex >= steps.length) return;

    const step = steps[stepIndex];
    const [lng, lat] = step.maneuver.location || [userLoc.lng, userLoc.lat];
    const d = haversineMeters(userLoc, { lat, lng });

    // If we're within ~35m of the maneuver, progress
    if (d < 35 && stepIndex < steps.length - 1) {
      setStepIndex(stepIndex + 1);
    }
  }, [active, route, steps, userLoc, stepIndex]);

  const nextStep = steps[stepIndex];

  const distanceToNext = useMemo(() => {
    if (!nextStep?.maneuver?.location) return undefined;
    const [lng, lat] = nextStep.maneuver.location;
    return haversineMeters(userLoc, { lat, lng });
  }, [nextStep, userLoc]);

  const remaining = useMemo(() => {
    if (!route) return null;
    if (!steps.length) return { distance: route.distance, duration: route.duration };
    const remainingSteps = steps.slice(stepIndex);
    const distance = remainingSteps.reduce((acc, s) => acc + (s.distance ?? 0), 0);
    const duration = remainingSteps.reduce((acc, s) => acc + (s.duration ?? 0), 0);
    return { distance, duration };
  }, [route, steps, stepIndex]);

  if (!active) return null;

  return (
    <div className="absolute left-0 right-0 top-16 z-20 px-4">
      <div className="mx-auto max-w-xl">
        <div className="rounded-2xl border border-border bg-card/80 backdrop-blur-xl shadow-lg">
          <div className="p-4">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 h-10 w-10 rounded-xl bg-primary/15 border border-primary/20 flex items-center justify-center">
                <Navigation2 className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Navigation en cours
                </div>
                <div className="mt-1 text-base font-bold leading-tight">
                  {nextStep?.instruction || "Suivez la route"}
                </div>
                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  {distanceToNext !== undefined && (
                    <span>
                      Prochaine étape: <span className="font-semibold">{formatDistance(distanceToNext)}</span>
                    </span>
                  )}
                  {remaining && (
                    <span>
                      Restant:{" "}
                      <span className="font-semibold">
                        {formatDistance(remaining.distance)} • {formatDuration(remaining.duration)}
                      </span>
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setExpanded((v) => !v)}
                  className="h-10 w-10 rounded-xl border border-border bg-background/50 hover:bg-secondary flex items-center justify-center"
                  aria-label="Afficher les étapes"
                >
                  <ChevronUp className={cn("h-5 w-5 transition-transform", expanded ? "rotate-180" : "")} />
                </button>
                <button
                  onClick={onStop}
                  className="h-10 w-10 rounded-xl border border-border bg-background/50 hover:bg-secondary flex items-center justify-center"
                  aria-label="Stop"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {expanded && (
              <div className="mt-4 border-t border-border/60 pt-3">
                <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                  <Route className="h-4 w-4" />
                  Étapes
                </div>

                <div className="max-h-56 overflow-auto space-y-2 pr-1">
                  {steps.slice(0, 20).map((s, idx) => {
                    const isCurrent = idx === stepIndex;
                    return (
                      <div
                        key={idx}
                        className={cn(
                          "rounded-xl border p-3 text-sm",
                          isCurrent
                            ? "border-primary/40 bg-primary/10"
                            : "border-border/60 bg-background/30",
                        )}
                      >
                        <div className="font-semibold">{s.instruction || "Continuer"}</div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          {formatDistance(s.distance)} • {formatDuration(s.duration)}
                        </div>
                      </div>
                    );
                  })}
                  {steps.length > 20 && (
                    <div className="text-xs text-muted-foreground">
                      +{steps.length - 20} étapes…
                    </div>
                  )}
                </div>

                <div className="mt-3">
                  <Button variant="outline" className="w-full" onClick={onStop}>
                    Arrêter la navigation
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}


