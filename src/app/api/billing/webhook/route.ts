import { NextResponse } from "next/server";
import Stripe from "stripe";
import { getStripe } from "@/lib/billing/stripe";
import { createServiceSupabaseClient } from "@/lib/supabase/service";

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!signature || !webhookSecret) {
    return NextResponse.json({ error: "Missing Stripe webhook signature configuration." }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch {
    return NextResponse.json({ error: "Invalid Stripe webhook signature." }, { status: 400 });
  }

  const supabase = createServiceSupabaseClient();

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const customerId = stripeCustomerId(session.customer);
    if (customerId) await updatePlanForCustomer(supabase, customerId, "pro");
  }

  if (event.type === "customer.subscription.deleted") {
    const subscription = event.data.object as Stripe.Subscription;
    const customerId = stripeCustomerId(subscription.customer);
    if (customerId) await updatePlanForCustomer(supabase, customerId, "free");
  }

  return NextResponse.json({ received: true });
}

async function updatePlanForCustomer(
  supabase: ReturnType<typeof createServiceSupabaseClient>,
  stripeCustomerId: string,
  plan: "free" | "pro"
) {
  const { data, error } = await supabase
    .from("billing_customers")
    .select("user_id")
    .eq("stripe_customer_id", stripeCustomerId)
    .single();

  if (error || !data) {
    console.warn("Stripe webhook could not find billing customer.", {
      stripeCustomerId,
      message: error?.message ?? "No billing customer row.",
    });
    return;
  }

  const { error: updateError } = await supabase
    .from("users")
    .update({ subscription_tier: plan })
    .eq("id", data.user_id);

  if (updateError) {
    console.warn("Stripe webhook could not update subscription tier.", {
      userId: data.user_id,
      plan,
      message: updateError.message,
    });
  }
}

function stripeCustomerId(customer: string | Stripe.Customer | Stripe.DeletedCustomer | null): string | null {
  if (!customer) return null;
  return typeof customer === "string" ? customer : customer.id;
}
