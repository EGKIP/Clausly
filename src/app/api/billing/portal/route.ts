import { NextResponse } from "next/server";
import { getStripe } from "@/lib/billing/stripe";
import { createClient } from "@/lib/supabase/server";

export async function POST() {
  if (!hasSupabaseEnv()) {
    return NextResponse.json({ error: "Supabase is not configured." }, { status: 503 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("billing_customers")
    .select("stripe_customer_id")
    .eq("user_id", user.id)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return NextResponse.json({ error: "No subscription found." }, { status: 404 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) return NextResponse.json({ error: "No subscription found." }, { status: 404 });

  let sessionUrl: string | null;
  try {
    const session = await getStripe().billingPortal.sessions.create({
      customer: data.stripe_customer_id,
      return_url: `${getBaseUrl()}/dashboard/settings`,
    });
    sessionUrl = session.url;
  } catch (error) {
    return NextResponse.json({ error: portalErrorMessage(error) }, { status: 500 });
  }

  if (!sessionUrl) {
    return NextResponse.json({ error: "Stripe portal did not return a URL." }, { status: 500 });
  }

  return NextResponse.json({ url: sessionUrl });
}

function getBaseUrl() {
  return (process.env.NEXT_PUBLIC_BASE_URL ?? process.env.BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

function hasSupabaseEnv() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

function portalErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "Stripe portal could not be opened.";
}
