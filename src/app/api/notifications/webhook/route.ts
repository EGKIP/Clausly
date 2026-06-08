import { NextResponse } from "next/server";
import { processVerifiedResendWebhook, verifyResendWebhookPayload } from "@/lib/notifications/webhook";
import { hasServiceSupabaseEnv, hasSupabaseEnv } from "@/lib/notifications/supabase-service";

export async function POST(request: Request) {
  const rawPayload = await request.text();
  const headers = {
    "svix-id": request.headers.get("svix-id"),
    "svix-timestamp": request.headers.get("svix-timestamp"),
    "svix-signature": request.headers.get("svix-signature"),
  };

  let event;
  try {
    event = verifyResendWebhookPayload(rawPayload, headers);
  } catch (error) {
    if (error instanceof Error && error.message === "Missing RESEND_WEBHOOK_SECRET.") {
      return NextResponse.json({ error: "Resend webhook secret is not configured." }, { status: 503 });
    }

    return NextResponse.json({ error: "Invalid webhook signature." }, { status: 401 });
  }

  if (!hasSupabaseEnv()) {
    return NextResponse.json({ error: "Supabase is not configured." }, { status: 503 });
  }

  if (!hasServiceSupabaseEnv()) {
    return NextResponse.json({ error: "Supabase service role is not configured." }, { status: 503 });
  }

  let result;
  try {
    result = await processVerifiedResendWebhook(event, headers["svix-id"]);
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Unsupported Resend webhook")) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    if (error instanceof Error && error.message.startsWith("Missing Resend webhook event id")) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ error: "Webhook processing failed." }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    duplicate: result.duplicate,
    event_id: result.eventId,
    type: result.type,
  });
}
