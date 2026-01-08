import React, { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, CheckCircle2, LocateFixed, MapPin, RefreshCw } from "lucide-react";
import { useLocation } from "wouter";
import LocationPickerDialog from "@/components/LocationPickerDialog";
import { apiUrl, getApiBase } from "@/lib/apiBase";

type Application = {
  id: string;
  createdAt: string;
  status: string;
  name: string;
  category: string;
  phone: string;
  description: string | null;
  photos: string[] | null;
  address?: string | null;
  commune?: string | null;
  lat?: number | null;
  lng?: number | null;
};

type PendingEstablishment = {
  id: string;
  createdAt: string;
  name: string;
  category: string;
  phone?: string | null;
  description?: string | null;
  photos?: string[] | null;
  address?: string | null;
  commune?: string | null;
  lat?: number | null;
  lng?: number | null;
  owner?: { userId: string; name: string };
};

type PendingEvent = {
  id: string;
  createdAt: string;
  title: string;
  category?: string;
  description?: string | null;
  startsAt: string;
  endsAt?: string | null;
  coverUrl?: string | null;
  photos?: string[] | null;
  establishment?: {
    id: string;
    name: string;
    category?: string;
    commune?: string | null;
    address?: string | null;
  } | null;
  organizer: { userId: string; name: string; avatarUrl?: string | null };
};

type PendingUserEvent = {
  id: string;
  createdAt: string;
  kind: string;
  title: string;
  description?: string | null;
  startsAt: string;
  endsAt?: string | null;
  photos?: string[] | null;
  ageMin?: number | null;
  lat?: number | null;
  lng?: number | null;
  organizer: { userId: string; name: string };
};

function formatDateTime(value?: string | null) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" });
}

export default function AdminApplications() {
  const [, setLocation] = useLocation();
  const [token, setToken] = useState<string>(() => localStorage.getItem("admin_token") || "");
  const [status, setStatus] = useState<"pending" | "all" | "approved">(() => {
    const saved = localStorage.getItem("admin_apps_status");
    if (saved === "pending" || saved === "all" || saved === "approved") return saved;
    return "all";
  });
  const [apps, setApps] = useState<Application[]>([]);
  const [pendingEstablishments, setPendingEstablishments] = useState<PendingEstablishment[]>([]);
  const [pendingEvents, setPendingEvents] = useState<PendingEvent[]>([]);
  const [pendingUserEvents, setPendingUserEvents] = useState<PendingUserEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const [importingBatch, setImportingBatch] = useState(false);
  const [batchLog, setBatchLog] = useState<string[]>([]);

  const [approval, setApproval] = useState<Record<string, { lat: string; lng: string; address: string; commune: string }>>(
    {},
  );
  const [pickerForId, setPickerForId] = useState<string | null>(null);

  const hasToken = useMemo(() => token.trim().length > 0, [token]);
  const apiBase = useMemo(() => getApiBase() || "", []);
  const headers = useMemo(() => (hasToken ? { "x-admin-token": token.trim() } : undefined), [hasToken, token]);

  const [importLat, setImportLat] = useState<string>("5.3261");
  const [importLng, setImportLng] = useState<string>("-4.0200");
  const [importRadius, setImportRadius] = useState<number>(8000);
  const [importTypes, setImportTypes] = useState<Record<string, boolean>>({
    restaurant: true,
    bar: true,
    night_club: true,
    lodging: true,
    liquor_store: true,
    pharmacy: true,
    police: true,
    hospital: true,
    fire_station: false,
    doctor: false,
  });

  const fillAngre = () => {
    // Cocody Angré (approx center). Increase radius to capture the neighborhood.
    setImportLat("5.3800");
    setImportLng("-3.9960");
    setImportRadius(8000);
    // default: restaurants at least
    setImportTypes((p) => ({ ...p, restaurant: true }));
  };

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(apiUrl(`/api/admin/business/applications?status=${status}`), {
        headers,
      });
      const text = await res.text();
      if (!res.ok) throw new Error(text);
      const data = JSON.parse(text);
      setApps(data.applications || []);

      // Unified moderation (mobile app submissions create rows in `establishments` directly).
      const res2 = await fetch(apiUrl(`/api/admin/moderation/pending?limit=500`), {
        headers,
      });
      const text2 = await res2.text();
      if (!res2.ok) throw new Error(text2);
      const data2 = JSON.parse(text2);
      const pending = (data2 as any)?.pending || {};
      setPendingEstablishments(pending.establishments || []);
      setPendingEvents(pending.events || []);
      setPendingUserEvents(pending.userEvents || []);
    } catch (e: any) {
      setError(e?.message || "Erreur");
      setApps([]);
      setPendingEstablishments([]);
      setPendingEvents([]);
      setPendingUserEvents([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, hasToken]);

  useEffect(() => {
    localStorage.setItem("admin_apps_status", status);
  }, [status]);

  const saveToken = () => {
    localStorage.setItem("admin_token", token.trim());
  };

  const approvePendingEstablishment = async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(apiUrl(`/api/admin/establishments/${encodeURIComponent(id)}/approve`), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(headers || {}) },
        body: JSON.stringify({}),
      });
      const text = await res.text();
      if (!res.ok) throw new Error(text);
      await load();
    } catch (e: any) {
      setError(e?.message || "Erreur");
    } finally {
      setLoading(false);
    }
  };

  const rejectPendingEstablishment = async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(apiUrl(`/api/admin/establishments/${encodeURIComponent(id)}/reject`), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(headers || {}) },
        body: JSON.stringify({}),
      });
      const text = await res.text();
      if (!res.ok) throw new Error(text);
      await load();
    } catch (e: any) {
      setError(e?.message || "Erreur");
    } finally {
      setLoading(false);
    }
  };

  const approvePendingEvent = async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(apiUrl(`/api/admin/events/${encodeURIComponent(id)}/approve`), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(headers || {}) },
        body: JSON.stringify({}),
      });
      const text = await res.text();
      if (!res.ok) throw new Error(text);
      await load();
    } catch (e: any) {
      setError(e?.message || "Erreur");
    } finally {
      setLoading(false);
    }
  };

  const rejectPendingEvent = async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(apiUrl(`/api/admin/events/${encodeURIComponent(id)}/reject`), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(headers || {}) },
        body: JSON.stringify({}),
      });
      const text = await res.text();
      if (!res.ok) throw new Error(text);
      await load();
    } catch (e: any) {
      setError(e?.message || "Erreur");
    } finally {
      setLoading(false);
    }
  };

  const approvePendingUserEvent = async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(apiUrl(`/api/admin/user-events/${encodeURIComponent(id)}/approve`), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(headers || {}) },
        body: JSON.stringify({}),
      });
      const text = await res.text();
      if (!res.ok) throw new Error(text);
      await load();
    } catch (e: any) {
      setError(e?.message || "Erreur");
    } finally {
      setLoading(false);
    }
  };

  const rejectPendingUserEvent = async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(apiUrl(`/api/admin/user-events/${encodeURIComponent(id)}/reject`), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(headers || {}) },
        body: JSON.stringify({}),
      });
      const text = await res.text();
      if (!res.ok) throw new Error(text);
      await load();
    } catch (e: any) {
      setError(e?.message || "Erreur");
    } finally {
      setLoading(false);
    }
  };

  const useMyLocation = () => {
    if (!navigator.geolocation) {
      setError("Géolocalisation indisponible sur ce navigateur.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setImportLat(String(pos.coords.latitude));
        setImportLng(String(pos.coords.longitude));
      },
      () => setError("Impossible de récupérer ta position."),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 },
    );
  };

  const runImport = async () => {
    if (!hasToken) {
      setError("Ajoute ton ADMIN_TOKEN (serveur + page) avant d’importer.");
      return;
    }
    const lat = Number(importLat);
    const lng = Number(importLng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      setError("Lat/Lng invalides pour l’import.");
      return;
    }
    const types = Object.entries(importTypes)
      .filter(([, v]) => v)
      .map(([k]) => k);
    if (!types.length) {
      setError("Choisis au moins 1 type Google (restaurant, bar, etc.)");
      return;
    }

    setLoading(true);
    setError(null);
    setImportMsg(null);
    try {
      const res = await fetch(apiUrl("/api/admin/import/google/nearby"), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(headers || {}) },
        body: JSON.stringify({
          lat,
          lng,
          radiusMeters: importRadius,
          types,
        }),
      });
      const text = await res.text();
      if (!res.ok) throw new Error(text);
      const data = JSON.parse(text);
      setImportMsg(`Import OK: scanned=${data.scanned}, upserted=${data.upserted}`);
    } catch (e: any) {
      setError(e?.message || "Erreur import");
    } finally {
      setLoading(false);
    }
  };

  const runAbidjanBatch = async () => {
    if (!hasToken) {
      setError("Ajoute ton ADMIN_TOKEN (serveur + page) avant d’importer.");
      return;
    }
    setImportingBatch(true);
    setBatchLog([]);
    setError(null);
    setImportMsg(null);

    // Coverage points (Abidjan) — you can tweak later.
    const centers = [
      { name: "Plateau", lat: 5.3236, lng: -4.0267 },
      { name: "Adjamé", lat: 5.3552, lng: -4.0236 },
      { name: "Cocody", lat: 5.3600, lng: -3.9900 },
      { name: "Deux Plateaux", lat: 5.3550, lng: -4.0050 },
      { name: "Riviera", lat: 5.3790, lng: -3.9800 },
      { name: "Cocody Angré", lat: 5.3950, lng: -3.9650 },
      { name: "Treichville", lat: 5.2936, lng: -4.0190 },
      { name: "Marcory", lat: 5.2950, lng: -3.9980 },
      { name: "Koumassi", lat: 5.2892, lng: -3.9588 },
      { name: "Port-Bouët", lat: 5.2568, lng: -3.9009 },
      { name: "Yopougon", lat: 5.3300, lng: -4.0800 },
      { name: "Abobo", lat: 5.4169, lng: -4.0186 },
      { name: "Anyama", lat: 5.4948, lng: -4.0512 },
      { name: "Bingerville", lat: 5.3556, lng: -3.8833 },
    ];

    const types = Object.entries(importTypes)
      .filter(([, v]) => v)
      .map(([k]) => k);

    try {
      for (let i = 0; i < centers.length; i++) {
        const c = centers[i];
        setBatchLog((prev) => [...prev, `Import ${c.name}…`]);
        const res = await fetch(apiUrl("/api/admin/import/google/nearby"), {
          method: "POST",
          headers: { "Content-Type": "application/json", ...(headers || {}) },
          body: JSON.stringify({
            lat: c.lat,
            lng: c.lng,
            radiusMeters: importRadius,
            types,
          }),
        });
        const text = await res.text();
        if (!res.ok) throw new Error(text);
        const data = JSON.parse(text);
        setBatchLog((prev) => [
          ...prev,
          `✔ ${c.name}: scanned=${data.scanned}, upserted=${data.upserted}`,
        ]);

        // Small pause to be gentle with quotas.
        await new Promise((r) => setTimeout(r, 700));
      }
      setImportMsg("Batch Abidjan terminé ✅");
    } catch (e: any) {
      setError(e?.message || "Erreur batch");
    } finally {
      setImportingBatch(false);
    }
  };

  const approve = async (id: string) => {
    const a = approval[id] || { lat: "", lng: "", address: "", commune: "" };
    const lat = Number(a.lat);
    const lng = Number(a.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      setError("Lat/Lng invalides (ex: 5.3261 et -4.0200)");
      return;
    }
    if (Math.abs(lat) < 0.000001 && Math.abs(lng) < 0.000001) {
      setError("Lat/Lng ne peuvent pas être 0,0 (sinon l'établissement est invisible sur la carte).");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(apiUrl(`/api/admin/business/applications/${encodeURIComponent(id)}/approve`), {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-token": token.trim() },
        body: JSON.stringify({
          lat,
          lng,
          address: a.address || null,
          commune: a.commune || null,
        }),
      });
      const text = await res.text();
      if (!res.ok) throw new Error(text);
      await load();
    } catch (e: any) {
      setError(e?.message || "Erreur");
    } finally {
      setLoading(false);
    }
  };

  const setAppLatLng = (id: string, lat: number, lng: number) => {
    const current = approval[id] || { lat: "", lng: "", address: "", commune: "" };
    setApproval((p) => ({
      ...p,
      [id]: {
        ...current,
        lat: String(lat),
        lng: String(lng),
      },
    }));
  };

  const useMyLocationFor = (id: string) => {
    if (!navigator.geolocation) {
      setError("Géolocalisation indisponible sur ce navigateur.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setAppLatLng(id, pos.coords.latitude, pos.coords.longitude);
      },
      () => setError("Impossible de récupérer ta position."),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 },
    );
  };

  const pickerValue = useMemo(() => {
    const id = pickerForId;
    if (!id) return null;
    const a = apps.find((x) => x.id === id);
    const local = approval[id];
    const lat = local?.lat ? Number(local.lat) : a?.lat ?? undefined;
    const lng = local?.lng ? Number(local.lng) : a?.lng ?? undefined;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return { lat: Number(lat), lng: Number(lng) };
  }, [pickerForId, apps, approval]);

  return (
    <div className="min-h-screen bg-background text-foreground pb-24">
      <div className="sticky top-0 z-10 bg-background/85 backdrop-blur-xl border-b border-border">
        <div className="mx-auto max-w-2xl px-4 py-4 flex items-center gap-3">
          <button
            onClick={() => window.history.back()}
            className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center hover:bg-secondary/80"
            type="button"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
            <div className="flex-1 min-w-0">
              <div className="font-display font-bold truncate">Admin • Modération</div>
              <div className="text-xs text-muted-foreground truncate">
                Lieux, évènements Pro et soirées utilisateurs à valider
              </div>
            </div>
          <Button variant="secondary" onClick={() => setLocation("/admin/moderation")}>
            Vue complète
          </Button>
          <Button variant="outline" onClick={load} disabled={!canLoad || loading}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Rafraîchir
          </Button>
        </div>
      </div>

      <div className="mx-auto max-w-2xl px-4 py-6 space-y-6">
        <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
          <div className="space-y-2">
            <Label>ADMIN_TOKEN</Label>
            <div className="flex gap-2">
              <Input value={token} onChange={(e) => setToken(e.target.value)} placeholder="Colle ton ADMIN_TOKEN" />
              <Button type="button" onClick={saveToken} variant="secondary">
                Enregistrer
              </Button>
            </div>
            <div className="text-xs text-muted-foreground">
              Le token doit aussi être défini côté serveur dans ton `.env` (ADMIN_TOKEN=...).
            </div>
            <div className="text-xs text-muted-foreground">
              API utilisée: <code>{apiBase || "(vide) → /api sur le frontend (mauvais en prod)"}</code>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Label className="mr-2">Filtre</Label>
            <select
              className="h-10 rounded-md border border-border bg-background px-3 text-sm"
              value={status}
              onChange={(e) => setStatus(e.target.value as any)}
            >
              <option value="pending">En attente</option>
              <option value="approved">Approuvées</option>
              <option value="all">Toutes</option>
            </select>
            {!hasToken && (
              <span className="text-xs text-amber-700 font-semibold">
                (Sans token: il faut être connecté en admin sur le même domaine)
              </span>
            )}
          </div>

          {error && <div className="text-sm text-red-500">{error}</div>}
          {importMsg && <div className="text-sm text-emerald-600">{importMsg}</div>}
        </div>

        <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="font-display font-bold">Importer Google Places</div>
              <div className="text-xs text-muted-foreground">
                Nécessite `GOOGLE_PLACES_API_KEY` + `ADMIN_TOKEN` côté serveur.
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={fillAngre} type="button">
                <MapPin className="w-4 h-4 mr-2" />
                Angré
              </Button>
              <Button variant="outline" onClick={useMyLocation} type="button">
                <LocateFixed className="w-4 h-4 mr-2" />
                Ma position
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Lat</Label>
              <Input value={importLat} onChange={(e) => setImportLat(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Lng</Label>
              <Input value={importLng} onChange={(e) => setImportLng(e.target.value)} />
            </div>
            <div className="space-y-1 col-span-2">
              <Label>Rayon (mètres)</Label>
              <Input
                type="number"
                value={importRadius}
                onChange={(e) => setImportRadius(Number(e.target.value))}
                min={100}
                max={50000}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Types (Google)</Label>
            <div className="flex flex-wrap gap-2">
              {Object.keys(importTypes).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setImportTypes((p) => ({ ...p, [t]: !p[t] }))}
                  className={`px-3 py-1 rounded-full text-xs font-semibold border ${
                    importTypes[t] ? "bg-primary/10 text-primary border-primary/20" : "bg-background text-foreground border-border"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <Button onClick={runImport} disabled={loading || !canLoad} className="w-full">
            Importer maintenant
          </Button>

          <Button
            onClick={runAbidjanBatch}
            disabled={loading || importingBatch || !canLoad}
            variant="secondary"
            className="w-full"
            type="button"
          >
            Importer Abidjan (batch)
          </Button>

          {batchLog.length > 0 && (
            <div className="text-xs text-muted-foreground space-y-1">
              {batchLog.slice(-8).map((l, idx) => (
                <div key={idx}>{l}</div>
              ))}
            </div>
          )}
        </div>

        {/* Mobile app submissions: pending establishments created via POST /api/establishments */}
        <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="font-display font-bold">Lieux ajoutés depuis l’app</div>
              <div className="text-xs text-muted-foreground">
                En attente de validation (table <code>establishments</code>).
              </div>
            </div>
            <div className="text-xs text-muted-foreground font-semibold">
              {pendingEstablishments.length} en attente
            </div>
          </div>

          {pendingEstablishments.length === 0 ? (
            <div className="text-sm text-muted-foreground">
              {loading ? "Chargement…" : "Aucun lieu en attente depuis l’app."}
            </div>
          ) : (
            <div className="space-y-3">
              {pendingEstablishments.map((e) => (
                <div key={e.id} className="rounded-2xl border border-border bg-background p-4 space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-display font-bold truncate">{e.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {e.category}
                        {e.commune ? ` • ${e.commune}` : ""}
                        {e.phone ? ` • ${e.phone}` : ""}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {e.owner?.name ? `Par: ${e.owner.name} • ` : ""}
                        ID: {e.id}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="secondary"
                        type="button"
                        disabled={loading || !canLoad}
                        onClick={() => approvePendingEstablishment(e.id)}
                      >
                        Publier
                      </Button>
                      <Button
                        variant="outline"
                        type="button"
                        disabled={loading || !canLoad}
                        onClick={() => rejectPendingEstablishment(e.id)}
                      >
                        Refuser
                      </Button>
                    </div>
                  </div>
                  {!!e.address && <div className="text-xs text-muted-foreground">Adresse: {e.address}</div>}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Pro events (establishment events created in the Pro app) */}
        <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="font-display font-bold">Évènements établissements (Pro)</div>
              <div className="text-xs text-muted-foreground">
                Évènements créés par les comptes établissement, en attente de validation.
              </div>
            </div>
            <div className="text-xs text-muted-foreground font-semibold">
              {pendingEvents.length} en attente
            </div>
          </div>

          {pendingEvents.length === 0 ? (
            <div className="text-sm text-muted-foreground">
              {loading ? "Chargement…" : "Aucun évènement en attente."}
            </div>
          ) : (
            <div className="space-y-3">
              {pendingEvents.map((ev) => {
                const firstPhoto = ev.coverUrl || (ev.photos && ev.photos[0]);
                return (
                  <div key={ev.id} className="rounded-2xl border border-border bg-background p-4 space-y-3">
                    <div className="flex items-start gap-3">
                      {firstPhoto && (
                        <img
                          src={firstPhoto}
                          alt={ev.title}
                          className="w-20 h-20 rounded-xl object-cover border border-border flex-shrink-0"
                        />
                      )}
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="font-display font-bold truncate">{ev.title}</div>
                        <div className="text-xs text-muted-foreground">
                          {ev.category || "Évènement"} • {formatDateTime(ev.startsAt)}
                          {ev.establishment?.name ? ` • ${ev.establishment.name}` : ""}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Organisateur: {ev.organizer.name} • ID utilisateur: {ev.organizer.userId}
                        </div>
                        {ev.establishment?.commune && (
                          <div className="text-xs text-muted-foreground">
                            Lieu: {ev.establishment.commune} {ev.establishment.address ? `• ${ev.establishment.address}` : ""}
                          </div>
                        )}
                        {ev.description && (
                          <div className="text-xs text-muted-foreground line-clamp-3">{ev.description}</div>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="secondary"
                        type="button"
                        disabled={loading || !canLoad}
                        onClick={() => approvePendingEvent(ev.id)}
                      >
                        Publier
                      </Button>
                      <Button
                        variant="outline"
                        type="button"
                        disabled={loading || !canLoad}
                        onClick={() => rejectPendingEvent(ev.id)}
                      >
                        Refuser
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* User-created parties/meetups (“soirées”) */}
        <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="font-display font-bold">Soirées utilisateurs</div>
              <div className="text-xs text-muted-foreground">
                Soirées et rencontres créées par les utilisateurs, à valider avant affichage sur la carte.
              </div>
            </div>
            <div className="text-xs text-muted-foreground font-semibold">
              {pendingUserEvents.length} en attente
            </div>
          </div>

          {pendingUserEvents.length === 0 ? (
            <div className="text-sm text-muted-foreground">
              {loading ? "Chargement…" : "Aucune soirée en attente."}
            </div>
          ) : (
            <div className="space-y-3">
              {pendingUserEvents.map((ue) => {
                const firstPhoto = ue.photos && ue.photos[0];
                return (
                  <div key={ue.id} className="rounded-2xl border border-border bg-background p-4 space-y-3">
                    <div className="flex items-start gap-3">
                      {firstPhoto && (
                        <img
                          src={firstPhoto}
                          alt={ue.title}
                          className="w-20 h-20 rounded-xl object-cover border border-border flex-shrink-0"
                        />
                      )}
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="font-display font-bold truncate">{ue.title}</div>
                        <div className="text-xs text-muted-foreground">
                          {ue.kind === "meet" ? "Rencontre" : "Soirée"} • {formatDateTime(ue.startsAt)}
                          {typeof ue.ageMin === "number" ? ` • ${ue.ageMin}+` : ""}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Créateur: {ue.organizer.name} • ID utilisateur: {ue.organizer.userId}
                        </div>
                        {ue.description && (
                          <div className="text-xs text-muted-foreground line-clamp-3">{ue.description}</div>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="secondary"
                        type="button"
                        disabled={loading || !canLoad}
                        onClick={() => approvePendingUserEvent(ue.id)}
                      >
                        Publier
                      </Button>
                      <Button
                        variant="outline"
                        type="button"
                        disabled={loading || !canLoad}
                        onClick={() => rejectPendingUserEvent(ue.id)}
                      >
                        Refuser
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {apps.length === 0 && pendingEstablishments.length === 0 && pendingEvents.length === 0 && pendingUserEvents.length === 0 && (
          <div className="rounded-2xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
            {loading ? "Chargement…" : "Aucune demande."}
          </div>
        )}

        {apps.map((a) => {
          const val = approval[a.id] || {
            lat: a.lat != null ? String(a.lat) : "",
            lng: a.lng != null ? String(a.lng) : "",
            address: a.address ?? "",
            commune: a.commune ?? "",
          };
          const missingLocation =
            (a.status === "approved" || a.status === "pending") &&
            (!Number.isFinite(Number(val.lat)) || !Number.isFinite(Number(val.lng)) ||
              (Math.abs(Number(val.lat)) < 0.000001 && Math.abs(Number(val.lng)) < 0.000001));
          return (
            <div key={a.id} className="rounded-2xl border border-border bg-card p-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-display font-bold truncate">{a.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {a.category} • {a.phone} • {a.status}
                  </div>
                  <div className="text-xs text-muted-foreground">ID: {a.id}</div>
                  {missingLocation && (
                    <div className="mt-1 text-xs text-amber-700">
                      ⚠ Position manquante/invalides → invisible sur la carte + itinéraire impossible
                    </div>
                  )}
                </div>
                {a.status === "approved" ? (
                  <div className="text-emerald-600 text-xs font-semibold inline-flex items-center">
                    <CheckCircle2 className="w-4 h-4 mr-1" />
                    Approuvé
                  </div>
                ) : null}
              </div>

              {a.description && (
                <Textarea value={a.description} readOnly className="min-h-[70px] bg-background" />
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Latitude</Label>
                  <Input
                    value={val.lat}
                    onChange={(e) => setApproval((p) => ({ ...p, [a.id]: { ...val, lat: e.target.value } }))}
                    placeholder="ex: 5.3261"
                  />
                </div>
                <div className="space-y-1">
                  <Label>Longitude</Label>
                  <Input
                    value={val.lng}
                    onChange={(e) => setApproval((p) => ({ ...p, [a.id]: { ...val, lng: e.target.value } }))}
                    placeholder="ex: -4.0200"
                  />
                </div>
                <div className="space-y-1">
                  <Label>Adresse</Label>
                  <Input
                    value={val.address}
                    onChange={(e) => setApproval((p) => ({ ...p, [a.id]: { ...val, address: e.target.value } }))}
                    placeholder="Rue, quartier…"
                  />
                </div>
                <div className="space-y-1">
                  <Label>Commune</Label>
                  <Input
                    value={val.commune}
                    onChange={(e) => setApproval((p) => ({ ...p, [a.id]: { ...val, commune: e.target.value } }))}
                    placeholder="Cocody, Marcory…"
                  />
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" onClick={() => useMyLocationFor(a.id)}>
                  <LocateFixed className="w-4 h-4 mr-2" />
                  Ma position
                </Button>
                <Button type="button" variant="outline" onClick={() => setPickerForId(a.id)}>
                  <MapPin className="w-4 h-4 mr-2" />
                  Choisir sur la carte
                </Button>
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={() => approve(a.id)}
                  disabled={loading || !canLoad}
                  className="w-full"
                >
                  {a.status === "approved" ? "Mettre à jour la localisation" : "Publier sur la carte"}
                </Button>
              </div>
            </div>
          );
        })}

        <div className="text-center">
          <Button variant="ghost" onClick={() => setLocation("/app")} type="button">
            Retour à la carte
          </Button>
        </div>
      </div>

      <LocationPickerDialog
        open={Boolean(pickerForId)}
        onOpenChange={(v) => {
          if (!v) setPickerForId(null);
        }}
        value={pickerValue}
        onPick={(v) => {
          if (!pickerForId) return;
          setAppLatLng(pickerForId, v.lat, v.lng);
        }}
        title="Position de l'établissement"
      />
    </div>
  );
}



