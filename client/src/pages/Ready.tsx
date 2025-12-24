import React from "react";
import { useLocation } from "wouter";
import { CheckCircle2, Sparkles, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getNextParam, setOnboardingComplete } from "@/lib/onboarding";
import EntryLayout from "@/components/EntryLayout";

export default function Ready() {
  const [, setLocation] = useLocation();
  const next = getNextParam() ?? "/app";

  const finish = () => {
    setOnboardingComplete(true);
    setLocation(next);
  };

  return (
    <EntryLayout
      step={3}
      totalSteps={3}
      eyebrow="Finalisation"
      title="Tout est prêt pour sortir"
      subtitle="Tu peux maintenant explorer la carte, consulter les détails d’un lieu, et obtenir un itinéraire clair jusqu’à destination."
      icon={<Sparkles className="h-10 w-10 text-primary" />}
    >
      <div className="space-y-3">
        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 h-5 w-5 text-primary" />
            <div>
              <div className="text-sm font-semibold">Carte + sélection</div>
              <div className="text-xs text-muted-foreground">
                Choisis un lieu sur la carte ou via la liste.
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="flex items-start gap-3">
            <Wand2 className="mt-0.5 h-5 w-5 text-primary" />
            <div>
              <div className="text-sm font-semibold">Itinéraire instantané</div>
              <div className="text-xs text-muted-foreground">
                Tracé visible, distance et durée estimées.
              </div>
            </div>
          </div>
        </div>

        <Button
          onClick={finish}
          className="w-full h-12 text-base font-bold rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground"
        >
          Accéder à l’application
        </Button>
      </div>
    </EntryLayout>
  );
}


