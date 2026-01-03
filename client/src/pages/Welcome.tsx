import React from "react";
import { useLocation } from "wouter";
import { Compass, ListChecks, Navigation, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getNextParam } from "@/lib/onboarding";
import bg from "@assets/cave2.jpg";
import logo from "@assets/localisation.png";

export default function Welcome() {
  const [, setLocation] = useLocation();
  const next = getNextParam() ?? "/app";

  return (
    <div className="min-h-screen w-full relative overflow-hidden">
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url(${bg})` }}
      />
      <div className="absolute inset-0 bg-black/55" />
      <div className="absolute inset-0 bg-gradient-to-b from-black/55 via-black/35 to-black/65" />
      <div className="absolute inset-0 bg-gradient-to-tr from-primary/20 via-transparent to-transparent" />

      <div className="relative z-10 min-h-screen flex items-center">
        <div className="w-full max-w-5xl mx-auto px-6 py-10">
          <div className="flex items-center gap-3 mb-8">
            <img
              src={logo}
              alt="NearPlace"
              className="h-12 w-12 rounded-2xl object-cover border border-white/10 bg-black/20"
            />
            <div className="leading-tight">
              <div className="text-white font-extrabold text-lg tracking-tight">O’Show</div>
              <div className="text-white/70 text-sm">Sortir. Découvrir. Y aller.</div>
            </div>
          </div>

          <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/10 text-white/80 text-xs font-semibold">
                <Sparkles className="h-4 w-4 text-primary" />
                Une expérience simple, locale, premium.
              </div>

              <h1 className="mt-4 text-white font-extrabold leading-tight text-4xl sm:text-5xl">
                Découvre les meilleurs spots autour de toi.
              </h1>
              <p className="mt-4 text-white/80 text-base leading-relaxed max-w-xl">
                Bars, maquis, lounges, caves — sélection claire, infos utiles, itinéraire, et suivi en temps réel
                pendant le trajet.
              </p>

              <div className="mt-8 flex flex-col sm:flex-row gap-3">
                <Button
                  onClick={() => setLocation(`/permissions?next=${encodeURIComponent(next)}`)}
                  className="h-12 px-6 text-base font-bold rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground"
                >
                  Commencer
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setLocation(`/permissions?next=${encodeURIComponent(next)}`)}
                  className="h-12 px-6 text-base font-semibold rounded-xl bg-white/5 border-white/10 text-white hover:bg-white/10"
                >
                  Voir comment ça marche
                </Button>
              </div>

              <div className="mt-4 text-sm text-white/70">
                Aucun compte requis pour explorer. La section Pro sert aux établissements.
              </div>
            </div>

            <div className="space-y-4">
              <Feature icon={<Compass className="h-5 w-5 text-primary" />} title="Explorer">
                Carte interactive + recherche + rayon (5/10/25 km).
              </Feature>
              <Feature icon={<ListChecks className="h-5 w-5 text-primary" />} title="Choisir">
                Infos rapides et catégories lisibles.
              </Feature>
              <Feature icon={<Navigation className="h-5 w-5 text-primary" />} title="Y aller">
                Tracé premium + mode “Démarrer” compact (sans bloquer la carte).
              </Feature>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Feature({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xl p-4">
      <div className="flex items-start gap-3">
        <div className="h-10 w-10 rounded-xl bg-primary/15 border border-primary/20 flex items-center justify-center">
          {icon}
        </div>
        <div>
          <div className="text-white font-bold">{title}</div>
          <div className="text-white/75 text-sm mt-1">{children}</div>
        </div>
      </div>
    </div>
  );
}


