import React, { useState } from "react";
import { useLocation } from "wouter";
import { Lock, MapPin, Navigation } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getNextParam } from "@/lib/onboarding";
import EntryLayout from "@/components/EntryLayout";

export default function Permissions() {
  const [, setLocation] = useLocation();
  const next = getNextParam() ?? "/app";
  const [loading, setLoading] = useState(false);

  const requestLocation = async () => {
    if (!navigator.geolocation) {
      setLocation(`/ready?next=${encodeURIComponent(next)}`);
      return;
    }

    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      () => {
        setLoading(false);
        setLocation(`/ready?next=${encodeURIComponent(next)}`);
      },
      () => {
        setLoading(false);
        setLocation(`/ready?next=${encodeURIComponent(next)}`);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 10000,
      },
    );
  };

  return (
    <EntryLayout
      step={2}
      totalSteps={3}
      eyebrow="Localisation"
      title="Une expérience vraiment personnalisée"
      subtitle="La localisation améliore la précision du point sur la carte et la pertinence des itinéraires. Tu peux aussi continuer sans GPS."
      icon={<MapPin className="h-10 w-10 text-primary" />}
    >
      <div className="space-y-3">
        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="flex items-start gap-3">
            <Navigation className="mt-0.5 h-5 w-5 text-primary" />
            <div>
              <div className="text-sm font-semibold">Itinéraires plus fiables</div>
              <div className="text-xs text-muted-foreground">
                Distance, durée et tracé depuis ta position.
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="flex items-start gap-3">
            <Lock className="mt-0.5 h-5 w-5 text-primary" />
            <div>
              <div className="text-sm font-semibold">Respect de la vie privée</div>
              <div className="text-xs text-muted-foreground">
                Ta position sert uniquement à l’affichage et au calcul d’itinéraire sur ton appareil.
              </div>
            </div>
          </div>
        </div>

        <Button
          onClick={requestLocation}
          disabled={loading}
          className="w-full h-12 text-base font-bold rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground"
        >
          <MapPin className="w-5 h-5 mr-2" />
          {loading ? "Demande en cours…" : "Autoriser la localisation"}
        </Button>

        <Button
          variant="outline"
          onClick={() => setLocation(`/ready?next=${encodeURIComponent(next)}`)}
          className="w-full h-12 rounded-xl"
        >
          Continuer sans GPS
        </Button>

        <div className="text-center text-xs text-muted-foreground">
          Astuce: pour une précision maximale sur mobile, active “position précise” dans les réglages du téléphone.
        </div>
      </div>
    </EntryLayout>
  );
}


