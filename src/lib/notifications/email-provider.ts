export type EmailMessage = {
  to: string;
  from: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
};

export type EmailSendResult = {
  id: string;
};

export interface EmailProvider {
  send(message: EmailMessage): Promise<EmailSendResult>;
}

type ResendResponse = {
  id?: string;
  message?: string;
  name?: string;
};

export class ResendEmailProvider implements EmailProvider {
  constructor(private apiKey: string, private endpoint = "https://api.resend.com/emails") {}

  async send(message: EmailMessage): Promise<EmailSendResult> {
    const response = await fetch(this.endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: message.from,
        to: [message.to],
        subject: message.subject,
        html: message.html,
        text: message.text,
        reply_to: message.replyTo,
      }),
    });

    const payload = await safeJson(response);

    if (!response.ok) {
      const message = payload?.message ?? payload?.name ?? `Resend failed with status ${response.status}.`;
      throw new Error(message);
    }

    if (!payload?.id) {
      throw new Error("Resend response did not include an email id.");
    }

    return { id: payload.id };
  }
}

export function createEmailProvider() {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("Missing RESEND_API_KEY.");
  }

  return new ResendEmailProvider(apiKey);
}

async function safeJson(response: Response): Promise<ResendResponse | null> {
  try {
    return (await response.json()) as ResendResponse;
  } catch {
    return null;
  }
}
