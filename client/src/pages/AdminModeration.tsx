import React, { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RefreshCw, Trash2, CheckCircle2, Ban, ArrowLeft } from "lucide-react";
import { apiUrl, getApiBase } from "@/lib/apiBase";

type PendingBlock<T> = T[];

type WithOwner = { owner?: { userId: string; name: string } };
type WithOrganizer = { organizer?: { userId: string; name: string; avatarUrl?: string | null } };

type ModerationPayload = {
  pending: {
    establishments: PendingBlock<any>;
    events: PendingBlock<any>;
    userEvents: PendingBlock<any>;
  };
  published?: {
    establishments?: any[];
    events?: any[];
    userEvents?: any[];
  };
};

export default function AdminModeration() {
  const [, setLocation] = useLocation();
  const [token, setToken] = useState<string>(() => localStorage.getItem("admin_token") || "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ModerationPayload | null>(null);

  const apiBase = useMemo(() => getApiBase() || "", []);
  const headers = useMemo(() => (token.trim() ? { "x-admin-token": token.trim() } : undefined), [token]);
  const hasToken = !!token.trim();

  const pendingEsts = useMemo(() => data?.pending?.establishments || [], [data]);
  const pendingEvents = useMemo(() => data?.pending?.events || [], [data]);
  const pendingUserEvents = useMemo(() => data?.pending?.userEvents || [], [data]);
  const publishedEsts = useMemo(() => data?.published?.establishments || [], [data]);
  const publishedEvents = useMemo(() => data?.published?.events || [], [data]);
  const publishedUserEvents = useMemo(() => data?.published?.userEvents || [], [data]);

  const saveToken = () => localStorage.setItem("admin_token", token.trim());

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(apiUrl(`/api/admin/moderation/pending?limit=400&includePublished=1&pubLimit=200`), {
        headers,
      });
      const text = await res.text();
      if (!res.ok) throw new Error(text);
      setData(JSON.parse(text));
    } catch (e: any) {
      setError(e?.message || "Erreur");
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasToken]);

  const act = async (method: "POST" | "DELETE", path: string, body?: any) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(apiUrl(path), {
        method,
        headers: { "Content-Type": "application/json", ...(headers || {}) },
        body: body ? JSON.stringify(body) : undefined,
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

  const approve = (kind: "est" | "ev" | "ue", id: string) => {
    const path =
      kind === "est"
        ? `/api/admin/establishments/${encodeURIComponent(id)}/approve`
        : kind === "ev"
          ? `/api/admin/events/${encodeURIComponent(id)}/approve`
          : `/api/admin/user-events/${encodeURIComponent(id)}/approve`;
    return act("POST", path, {});
  };
  const reject = (kind: "est" | "ev" | "ue", id: string) => {
    const path =
      kind === "est"
        ? `/api/admin/establishments/${encodeURIComponent(id)}/reject`
        : kind === "ev"
          ? `/api/admin/events/${encodeURIComponent(id)}/reject`
          : `/api/admin/user-events/${encodeURIComponent(id)}/reject`;
    return act("POST", path, {});
  };
  const del = (kind: "est" | "ev" | "ue", id: string) => {
    const path =
      kind === "est"
        ? `/api/admin/establishments/${encodeURIComponent(id)}`
        : kind === "ev"
          ? `/api/admin/events/${encodeURIComponent(id)}`
          : `/api/admin/user-events/${encodeURIComponent(id)}`;
    return act("DELETE", path);
  };

  return (
    <div className="min-h-screen bg-background text-foreground pb-24">
      <div className="sticky top-0 z-10 bg-background/85 backdrop-blur-xl border-b border-border">
        <div className="mx-auto max-w-5xl px-4 py-4 flex items-center gap-3">
          <button
            onClick={() => setLocation("/admin/applications")}
            className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center hover:bg-secondary/80"
            type="button"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1 min-w-0">
            <div className="font-display font-bold truncate">Admin • Modération</div>
            <div className="text-xs text-muted-foreground truncate">Pending + Publié (nettoyage)</div>
          </div>
          <Button variant="outline" onClick={load} disabled={loading}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Rafraîchir
          </Button>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-4 py-6 space-y-6">
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
              API: <code>{apiBase || "(vide) → /api local"}</code>
            </div>
          </div>
          {error && <div className="text-sm text-red-500">{error}</div>}
        </div>

        <Section
          title="En attente"
          loading={loading}
          ests={pendingEsts}
          events={pendingEvents}
          userEvents={pendingUserEvents}
          onApprove={approve}
          onReject={reject}
          onDelete={del}
          showDelete={false}
        />

        <Section
          title="Publié récemment"
          loading={loading}
          ests={publishedEsts}
          events={publishedEvents}
          userEvents={publishedUserEvents}
          onApprove={() => {}}
          onReject={() => {}}
          onDelete={del}
          showDelete
        />
      </div>
    </div>
  );
}

type SectionProps = {
  title: string;
  loading: boolean;
  ests: any[];
  events: any[];
  userEvents: any[];
  onApprove: (kind: "est" | "ev" | "ue", id: string) => Promise<void>;
  onReject: (kind: "est" | "ev" | "ue", id: string) => Promise<void>;
  onDelete: (kind: "est" | "ev" | "ue", id: string) => Promise<void>;
  showDelete: boolean;
};

function Section({ title, loading, ests, events, userEvents, onApprove, onReject, onDelete, showDelete }: SectionProps) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 space-y-4">
      <div className="font-display font-bold">{title}</div>
      {loading && <div className="text-sm text-muted-foreground">Chargement…</div>}

      <Block
        label="Établissements"
        items={ests}
        render={(e: any) => ({
          id: e.id,
          title: e.name,
          subtitle: `${e.category || "—"} • ${e.commune || e.address || "—"} • ${e.owner?.name || "—"}`,
          description: e.description,
        })}
        onApprove={showDelete ? undefined : (id) => onApprove("est", id)}
        onReject={showDelete ? undefined : (id) => onReject("est", id)}
        onDelete={showDelete ? (id) => onDelete("est", id) : undefined}
      />

      <Block
        label="Évènements établissements"
        items={events}
        render={(ev: any) => ({
          id: ev.id,
          title: ev.title,
          subtitle: `${ev.category || "event"} • ${new Date(ev.startsAt).toLocaleString()} • ${ev.organizer?.name || "—"}`,
          description: ev.description,
        })}
        onApprove={showDelete ? undefined : (id) => onApprove("ev", id)}
        onReject={showDelete ? undefined : (id) => onReject("ev", id)}
        onDelete={showDelete ? (id) => onDelete("ev", id) : undefined}
      />

      <Block
        label="Soirées users"
        items={userEvents}
        render={(ue: any) => ({
          id: ue.id,
          title: ue.title,
          subtitle: `${ue.kind || "party"} • ${new Date(ue.startsAt).toLocaleString()} • ${ue.organizer?.name || "—"}`,
          description: ue.description,
        })}
        onApprove={showDelete ? undefined : (id) => onApprove("ue", id)}
        onReject={showDelete ? undefined : (id) => onReject("ue", id)}
        onDelete={showDelete ? (id) => onDelete("ue", id) : undefined}
      />
    </div>
  );
}

type BlockProps = {
  label: string;
  items: any[];
  render: (item: any) => { id: string; title: string; subtitle?: string; description?: string | null };
  onApprove?: (id: string) => void | Promise<void>;
  onReject?: (id: string) => void | Promise<void>;
  onDelete?: (id: string) => void | Promise<void>;
};

function Block({ label, items, render, onApprove, onReject, onDelete }: BlockProps) {
  return (
    <div className="space-y-2">
      <div className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">{label}</div>
      {items.length === 0 ? (
        <div className="text-sm text-muted-foreground">— Aucun</div>
      ) : (
        <div className="space-y-3">
          {items.map((raw) => {
            const { id, title, subtitle, description } = render(raw);
            return (
              <div key={id} className="rounded-2xl border border-border bg-background p-4 space-y-2">
                <div className="font-display font-bold truncate">{title || "—"}</div>
                {subtitle && <div className="text-xs text-muted-foreground">{subtitle}</div>}
                {description && <Textarea value={description} readOnly className="min-h-[70px] bg-background" />}
                <div className="flex gap-2 flex-wrap">
                  {onApprove && (
                    <Button variant="secondary" size="sm" onClick={() => onApprove(id)}>
                      <CheckCircle2 className="w-4 h-4 mr-1" />
                      Publier
                    </Button>
                  )}
                  {onReject && (
                    <Button variant="outline" size="sm" onClick={() => onReject(id)}>
                      <Ban className="w-4 h-4 mr-1" />
                      Refuser
                    </Button>
                  )}
                  {onDelete && (
                    <Button variant="destructive" size="sm" onClick={() => onDelete(id)}>
                      <Trash2 className="w-4 h-4 mr-1" />
                      Supprimer
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}




