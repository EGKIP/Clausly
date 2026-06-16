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

vi.mock("@/lib/supabase/server", () => ({ createClient: async () => createSupabaseClient() }));
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
    process.env.STRIPE_PRO_PRICE_ID = "price_pro";
    process.env.NEXT_PUBLIC_BASE_URL = "https://clausly.test";
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
    expect(getOrCreateStripeCustomerMock).toHaveBeenCalledWith(expect.anything(), userA);
    expect(checkoutCreateMock).toHaveBeenCalledWith({
      mode: "subscription",
      customer: "cus_test",
      line_items: [{ price: "price_pro", quantity: 1 }],
      success_url: "https://clausly.test/dashboard/settings?upgraded=1",
      cancel_url: "https://clausly.test/upgrade?canceled=1",
      automatic_tax: { enabled: true },
    });
  });
});
