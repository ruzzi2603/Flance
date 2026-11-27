export type EmailMessage = {
  from?: string;
  to: string | string[];
  subject: string;
  text: string;
  html: string;
};

/** Sends transactional email through Resend's HTTPS API (port 443). */
export async function sendEmail(message: EmailMessage): Promise<{ id?: string }> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = (message.from || process.env.EMAIL_FROM)?.trim();

  if (!apiKey || !from) {
    throw new Error("RESEND_API_KEY and EMAIL_FROM must be configured to send email");
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ ...message, from, to: Array.isArray(message.to) ? message.to : [message.to] }),
    signal: AbortSignal.timeout(15_000),
  });

  const result = (await response.json().catch(() => ({}))) as {
    id?: string;
    message?: string;
    name?: string;
  };

  if (!response.ok) {
    const details = result.message || result.name || "email provider rejected the request";
    throw new Error(`Resend API returned ${response.status}: ${details}`);
  }

  return result;
}
