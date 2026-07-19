import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createSupabaseClient,
  resetSupabaseMock,
  seedUser,
  setSupabaseEnv,
  setSupabaseUser,
  userA,
} from "@/../tests/helpers/supabase";

const getOrCreateStripeCustomerMock = vi.hoisted(() => vi.fn());
const checkoutCreateMock = vi.hoisted(() => vi.fn());
const serviceSupabaseClient = vi.hoisted(() => ({ kind: "service" }));

vi.mock("@/lib/supabase/server", () => ({ createClient: async () => createSupabaseClient() }));
vi.mock("@/lib/supabase/service", () => ({
  createServiceSupabaseClient: () => serviceSupabaseClient,
}));
vi.mock("@/lib/billing/stripe", () => ({
  getOrCreateStripeCustomer: getOrCreateStripeCustomerMock,
  getStripe: () => ({
    checkout: {
      sessions: {
        create: checkoutCreateMock,
      },
    },
  }),
}));

import { POST } from "../route";

describe("POST /api/billing/checkout", () => {
  beforeEach(() => {
    resetSupabaseMock(userA);
    getOrCreateStripeCustomerMock.mockReset();
    getOrCreateStripeCustomerMock.mockResolvedValue("cus_test");
    checkoutCreateMock.mockReset();
    checkoutCreateMock.mockResolvedValue({ url: "https://checkout.stripe.test/session" });
    process.env.STRIPE_SECRET_KEY = "sk_test_config";
    process.env.STRIPE_PRO_PRICE_ID = "price_pro";
    process.env.NEXT_PUBLIC_BASE_URL = "https://clausly.test";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role";
  });

  it("returns the demo URL when Supabase env is absent", async () => {
    setSupabaseEnv(false);

    const response = await POST();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ url: "/dashboard/settings?demo=true" });
    expect(checkoutCreateMock).not.toHaveBeenCalled();
  });

  it("returns 401 when unauthenticated", async () => {
    setSupabaseUser(null);

    const response = await POST();

    expect(response.status).toBe(401);
  });

  it("returns 409 when the user is already Pro", async () => {
    seedUser(userA, { subscription_tier: "pro" });

    const response = await POST();
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body).toEqual({ error: "Already on Pro." });
  });

  it("creates a checkout session for a free user", async () => {
    seedUser(userA, { subscription_tier: "free" });

    const response = await POST();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ url: "https://checkout.stripe.test/session" });
    expect(getOrCreateStripeCustomerMock).toHaveBeenCalledWith(serviceSupabaseClient, userA);
    expect(checkoutCreateMock).toHaveBeenCalledWith({
      mode: "subscription",
      customer: "cus_test",
      line_items: [{ price: "price_pro", quantity: 1 }],
      success_url: "https://clausly.test/dashboard/settings?upgraded=1",
      cancel_url: "https://clausly.test/upgrade?canceled=1",
      automatic_tax: { enabled: true },
      billing_address_collection: "auto",
      customer_update: {
        address: "auto",
        name: "auto",
      },
    });
  });

  it("returns 503 when the service role key is missing", async () => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    seedUser(userA, { subscription_tier: "free" });

    const response = await POST();
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body).toEqual({ error: "Supabase service role is not configured." });
    expect(checkoutCreateMock).not.toHaveBeenCalled();
  });

  it("returns a readable Stripe error when checkout creation fails", async () => {
    seedUser(userA, { subscription_tier: "free" });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const error = new Error("Invalid API Key provided: sk_test_**************************************************IVe$");
    Object.assign(error, {
      type: "StripeAuthenticationError",
      code: "api_key_invalid",
      requestId: "req_test",
      statusCode: 401,
    });
    checkoutCreateMock.mockRejectedValue(error);

    const response = await POST();
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({ error: "Stripe checkout could not be started. Please try again or contact support." });
    expect(JSON.stringify(body)).not.toContain("sk_test");
    expect(warn).toHaveBeenCalledWith("Stripe checkout failed.", {
      name: "Error",
      message: "Invalid API Key provided: [redacted]",
      type: "StripeAuthenticationError",
      code: "api_key_invalid",
      statusCode: 401,
      requestId: "req_test",
    });
    expect(JSON.stringify(warn.mock.calls)).not.toContain("sk_test");
    warn.mockRestore();
  });

  it("returns BILLING_CONFIG_ERROR when the price ID is missing", async () => {
    delete process.env.STRIPE_PRO_PRICE_ID;
    seedUser(userA, { subscription_tier: "free" });
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => {});

    const response = await POST();
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toMatchObject({ code: "BILLING_CONFIG_ERROR" });
    expect(checkoutCreateMock).not.toHaveBeenCalled();
    expect(errorLog).toHaveBeenCalledWith("Stripe checkout blocked by configuration.", {
      reason: "STRIPE_PRO_PRICE_ID is missing.",
    });
    errorLog.mockRestore();
  });

  it("returns BILLING_CONFIG_ERROR when the price ID is a product ID", async () => {
    process.env.STRIPE_PRO_PRICE_ID = "prod_ABC123";
    seedUser(userA, { subscription_tier: "free" });
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => {});

    const response = await POST();
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toMatchObject({ code: "BILLING_CONFIG_ERROR" });
    expect(checkoutCreateMock).not.toHaveBeenCalled();
    expect(JSON.stringify(errorLog.mock.calls)).not.toContain("prod_ABC123");
    errorLog.mockRestore();
  });

  it("returns BILLING_CONFIG_ERROR when the Stripe secret key is missing", async () => {
    delete process.env.STRIPE_SECRET_KEY;
    seedUser(userA, { subscription_tier: "free" });
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => {});

    const response = await POST();
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({
      error: "Billing isn't configured correctly on our side. Please contact support.",
      code: "BILLING_CONFIG_ERROR",
    });
    expect(checkoutCreateMock).not.toHaveBeenCalled();
    errorLog.mockRestore();
  });

  it("trims whitespace pasted into the price ID env var", async () => {
    process.env.STRIPE_PRO_PRICE_ID = "  price_pro\n";
    seedUser(userA, { subscription_tier: "free" });

    const response = await POST();

    expect(response.status).toBe(200);
    expect(checkoutCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({ line_items: [{ price: "price_pro", quantity: 1 }] })
    );
  });
});
