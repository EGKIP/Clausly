import "server-only";

import Stripe from "stripe";

type SupabaseError = {
  message: string;
  code?: string;
};

type BillingCustomerRow = {
  stripe_customer_id: string;
};

type BillingCustomerQuery = PromiseLike<{
  data: BillingCustomerRow | null;
  error: SupabaseError | null;
}> & {
  eq(column: string, value: unknown): BillingCustomerQuery;
  single(): PromiseLike<{ data: BillingCustomerRow | null; error: SupabaseError | null }>;
};

type BillingCustomerInsert = PromiseLike<{
  data: unknown;
  error: SupabaseError | null;
}>;

type BillingCustomersTable = {
  select(columns?: string): BillingCustomerQuery;
  insert(payload: { user_id: string; stripe_customer_id: string }): BillingCustomerInsert;
};

type BillingSupabase = {
  from(table: "billing_customers"): {
    select(columns?: string): BillingCustomerQuery;
    insert(payload: { user_id: string; stripe_customer_id: string }): BillingCustomerInsert;
  };
};

type BillingUser = {
  id: string;
  email?: string | null;
};

let stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (stripe) return stripe;

  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error("Missing STRIPE_SECRET_KEY.");
  }

  stripe = new Stripe(secretKey);
  return stripe;
}

export function __setStripeForTests(nextStripe: Stripe | null) {
  stripe = nextStripe;
}

export async function getOrCreateStripeCustomer(
  supabase: unknown,
  user: BillingUser
): Promise<string> {
  const billingCustomers = (supabase as BillingSupabase).from("billing_customers") as BillingCustomersTable;
  const { data, error } = await billingCustomers
    .select("stripe_customer_id")
    .eq("user_id", user.id)
    .single();

  if (data?.stripe_customer_id) return data.stripe_customer_id;
  if (error && error.code !== "PGRST116") {
    throw new Error(error.message);
  }

  const customer = await getStripe().customers.create({
    email: user.email ?? undefined,
    metadata: { user_id: user.id },
  });

  const { error: insertError } = await billingCustomers.insert({
    user_id: user.id,
    stripe_customer_id: customer.id,
  });

  if (insertError) {
    throw new Error(insertError.message);
  }

  return customer.id;
}
