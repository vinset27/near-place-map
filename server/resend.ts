type SendEmailInput = {
  from: string;
  to: string;
  subject: string;
  html: string;
};

function getResendKey(): string | null {
  const k = process.env.RESEND_API_KEY || process.env.RESEND_KEY_API;
  return typeof k === "string" && k.trim() ? k.trim() : null;
}

export async function resendSendEmail(input: SendEmailInput): Promise<{ id?: string }> {
  const key = getResendKey();
  if (!key) {
    throw new Error("Resend not configured: set RESEND_KEY_API (or RESEND_API_KEY) in the backend environment.");
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: input.from,
      to: input.to,
      subject: input.subject,
      html: input.html,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Resend error (${res.status}): ${text || res.statusText}`);
  }

  const json = (await res.json().catch(() => null)) as any;
  return json;
}


