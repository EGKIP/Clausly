import { NextResponse } from "next/server";
import {
  BILLING_CHECKOUT_ERROR,
  BILLING_CONFIG_ERROR,
  BILLING_CONFIG_ERROR_CODE,
  logBillingError,
} from "@/lib/billing/errors";
import { getUserPlan } from "@/lib/billing/plan";
import { getOrCreateStripeCustomer, getStripe } from "@/lib/billing/stripe";
import { createClient } from "@/lib/supabase/server";
import { createServiceSupabaseClient } from "@/lib/supabase/service";

export async function POST() {
  if (!hasSupabaseEnv()) {
    return NextResponse.json({ url: "/dashboard/settings?demo=true" });
  }

  if (!hasServiceSupabaseEnv()) {
    return NextResponse.json({ error: "Supabase service role is not configured." }, { status: 503 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (await getUserPlan(supabase, user.id) === "pro") {
    return NextResponse.json({ error: "Already on Pro." }, { status: 409 });
  }

  const configIssue = billingConfigIssue();
  if (configIssue) {
    // The reason names the misconfigured variable but never its value —
    // wrong-field pastes must not end up in logs.
    console.error("Stripe checkout blocked by configuration.", { reason: configIssue });
    return NextResponse.json(
      { error: BILLING_CONFIG_ERROR, code: BILLING_CONFIG_ERROR_CODE },
      { status: 500 }
    );
  }

  const priceId = (process.env.STRIPE_PRO_PRICE_ID ?? "").trim();

  let sessionUrl: string | null;
  try {
    const billingSupabase = createServiceSupabaseClient();
    const customer = await getOrCreateStripeCustomer(billingSupabase, user);
    const baseUrl = getBaseUrl();
    const session = await getStripe().checkout.sessions.create({
      mode: "subscription",
      customer,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${baseUrl}/dashboard/settings?upgraded=1`,
      cancel_url: `${baseUrl}/upgrade?canceled=1`,
      automatic_tax: { enabled: true },
      billing_address_collection: "auto",
      customer_update: {
        address: "auto",
        name: "auto",
      },
    });
    sessionUrl = session.url;
  } catch (error) {
    logBillingError("Stripe checkout failed.", error);
    return NextResponse.json({ error: BILLING_CHECKOUT_ERROR }, { status: 500 });
  }

  if (!sessionUrl) {
    return NextResponse.json({ error: "Stripe checkout did not return a URL." }, { status: 500 });
  }

  return NextResponse.json({ url: sessionUrl });
}

function billingConfigIssue(): string | null {
  if (!process.env.STRIPE_SECRET_KEY?.trim()) return "STRIPE_SECRET_KEY is missing.";

  const priceId = process.env.STRIPE_PRO_PRICE_ID?.trim();
  if (!priceId) return "STRIPE_PRO_PRICE_ID is missing.";
  if (!priceId.startsWith("price_")) {
    return "STRIPE_PRO_PRICE_ID must be a price_... ID (a prod_... product ID will not work).";
  }

  return null;
}

function getBaseUrl() {
  return (process.env.NEXT_PUBLIC_BASE_URL ?? process.env.BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

function hasSupabaseEnv() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

function hasServiceSupabaseEnv() {
  return Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);
}
