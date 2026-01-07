type ExpoPushMessage = {
  to: string;
  title?: string;
  body?: string;
  sound?: "default" | null;
  data?: Record<string, any>;
};

function isExpoPushToken(token: string): boolean {
  const t = String(token || "").trim();
  return t.startsWith("ExponentPushToken[") || t.startsWith("ExpoPushToken[");
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export async function sendExpoPush(tokens: string[], msg: Omit<ExpoPushMessage, "to">) {
  const valid = Array.from(new Set(tokens.map((t) => String(t || "").trim()).filter(isExpoPushToken)));
  if (valid.length === 0) return { ok: true, sent: 0 };

  const batches = chunk(valid, 90);
  let sent = 0;

  for (const batch of batches) {
    const payload = batch.map((to) => ({
      to,
      sound: "default",
      ...msg,
    }));

    const res = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    // We don't throw on non-200 to avoid breaking core flows (best-effort).
    // Log minimal info so operators can debug.
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.warn("[push] Expo push send failed", res.status, text.slice(0, 200));
    }
    sent += batch.length;
  }

  return { ok: true, sent };
}






