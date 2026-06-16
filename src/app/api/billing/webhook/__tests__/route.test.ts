import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createSupabaseClient,
  db,
  resetSupabaseMock,
  seedBillingCustomer,
  seedUser,
  userA,
} from "@/../tests/helpers/supabase";

const constructEventMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/service", () => ({ createServiceSupabaseClient: () => createSupabaseClient() }));
vi.mock("@/lib/billing/stripe", () => ({
  getStripe: () => ({
    webhooks: {
      constructEvent: constructEventMock,
    },
  }),
}));

import { POST } from "../route";

describe("POST /api/billing/webhook", () => {
  beforeEach(() => {
    resetSupabaseMock(userA);
    constructEventMock.mockReset();
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";
  });

  it("returns 400 when signature verification fails", async () => {
    constructEventMock.mockImplementation(() => {
      throw new Error("bad signature");
    });

    const response = await POST(stripeRequest("{}"));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({ error: "Invalid Stripe webhook signature." });
  });

  it("upgrades the mapped user on checkout.session.completed", async () => {
    seedUser(userA, { subscription_tier: "free" });
    seedBillingCustomer(userA, { stripe_customer_id: "cus_paid" });
    constructEventMock.mockReturnValue({
      type: "checkout.session.completed",
      data: { object: { customer: "cus_paid" } },
    });

    const response = await POST(stripeRequest("{\"id\":\"evt_checkout\"}"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ received: true });
    expect(db().users[0]).toMatchObject({ id: userA.id, subscription_tier: "pro" });
    expect(constructEventMock).toHaveBeenCalledWith("{\"id\":\"evt_checkout\"}", "sig_test", "whsec_test");
  });

  it("downgrades the mapped user on customer.subscription.deleted", async () => {
    seedUser(userA, { subscription_tier: "pro" });
    seedBillingCustomer(userA, { stripe_customer_id: "cus_paid" });
    constructEventMock.mockReturnValue({
      type: "customer.subscription.deleted",
      data: { object: { customer: "cus_paid" } },
    });

    const response = await POST(stripeRequest("{\"id\":\"evt_deleted\"}"));

    expect(response.status).toBe(200);
    expect(db().users[0]).toMatchObject({ id: userA.id, subscription_tier: "free" });
  });
});

function stripeRequest(body: string) {
  return new Request("http://localhost.test/api/billing/webhook", {
    method: "POST",
    headers: { "stripe-signature": "sig_test" },
    body,
  });
}
