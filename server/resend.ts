type SendEmailInput = {
  // Optional: if omitted, we use RESEND_FROM (fallback: onboarding@resend.dev)
  from?: string;
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
};

function getResendKey(): string | null {
  const k = process.env.RESEND_API_KEY || process.env.RESEND_KEY_API;
  return typeof k === "string" && k.trim() ? k.trim() : null;
}

function getResendFrom(): string {
  const f =
    process.env.RESEND_FROM ||
    process.env.RESEND_FROM_EMAIL ||
    "onboarding@resend.dev";
  return String(f).trim();
}

export async function resendSendEmail(input: SendEmailInput): Promise<{ id?: string }> {
  const key = getResendKey();
  if (!key) {
    throw new Error("Resend not configured: set RESEND_KEY_API (or RESEND_API_KEY) in the backend environment.");
  }

  const from = String(input.from || getResendFrom()).trim();
  const replyTo = input.replyTo ? String(input.replyTo).trim() : "";

  async function sendOnce(fromAddr: string) {
    return await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromAddr,
        to: input.to,
        subject: input.subject,
        html: input.html,
        ...(replyTo ? { reply_to: replyTo } : {}),
      }),
    });
  }

  let res = await sendOnce(from);

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    // Common case: domain not verified in Resend.
    // Retry once with Resend's onboarding sender to unblock dev/testing.
    if (res.status === 403 && from !== "onboarding@resend.dev") {
      console.warn(`[Resend] from not authorized (${from}). Retrying with onboarding@resend.dev...`);
      res = await sendOnce("onboarding@resend.dev");
      if (!res.ok) {
        const text2 = await res.text().catch(() => "");
        throw new Error(`Resend error (${res.status}): ${text2 || res.statusText}`);
      }
    } else {
      throw new Error(`Resend error (${res.status}): ${text || res.statusText}`);
    }
  }

  const json = (await res.json().catch(() => null)) as any;
  return json;
}


