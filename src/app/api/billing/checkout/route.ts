import { NextResponse } from "next/server";
import { getUserPlan } from "@/lib/billing/plan";
import { getOrCreateStripeCustomer, getStripe } from "@/lib/billing/stripe";
import { createClient } from "@/lib/supabase/server";

export async function POST() {
  if (!hasSupabaseEnv()) {
    return NextResponse.json({ url: "/dashboard/settings?demo=true" });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (await getUserPlan(supabase, user.id) === "pro") {
    return NextResponse.json({ error: "Already on Pro." }, { status: 409 });
  }

  const priceId = process.env.STRIPE_PRO_PRICE_ID;
  if (!priceId) {
    return NextResponse.json({ error: "Missing STRIPE_PRO_PRICE_ID." }, { status: 500 });
  }

  const customer = await getOrCreateStripeCustomer(supabase, user);
  const baseUrl = getBaseUrl();
  const session = await getStripe().checkout.sessions.create({
    mode: "subscription",
    customer,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${baseUrl}/dashboard/settings?upgraded=1`,
    cancel_url: `${baseUrl}/upgrade?canceled=1`,
    automatic_tax: { enabled: true },
  });

  if (!session.url) {
    return NextResponse.json({ error: "Stripe checkout did not return a URL." }, { status: 500 });
  }

  return NextResponse.json({ url: session.url });
}

function getBaseUrl() {
  return (process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

function hasSupabaseEnv() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}
