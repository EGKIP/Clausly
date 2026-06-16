import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createSupabaseClient,
  db,
  resetSupabaseMock,
  seedBillingCustomer,
  userA,
} from "@/../tests/helpers/supabase";
import { __setStripeForTests, getOrCreateStripeCustomer, getStripe } from "../stripe";

vi.mock("server-only", () => ({}));

describe("Stripe billing helpers", () => {
  beforeEach(() => {
    resetSupabaseMock(userA);
    __setStripeForTests(null);
    delete process.env.STRIPE_SECRET_KEY;
  });

  it("throws a clear error when STRIPE_SECRET_KEY is missing", () => {
    expect(() => getStripe()).toThrow("Missing STRIPE_SECRET_KEY.");
  });

  it("reuses an existing Stripe customer mapping", async () => {
    seedBillingCustomer(userA, { stripe_customer_id: "cus_existing" });
    const stripeMock = stripeClientMock();
    __setStripeForTests(stripeMock as never);

    await expect(getOrCreateStripeCustomer(createSupabaseClient(), userA)).resolves.toBe("cus_existing");
    expect(stripeMock.customers.create).not.toHaveBeenCalled();
  });

  it("creates and persists a Stripe customer when no mapping exists", async () => {
    const stripeMock = stripeClientMock({ customerId: "cus_created" });
    __setStripeForTests(stripeMock as never);

    await expect(getOrCreateStripeCustomer(createSupabaseClient(), userA)).resolves.toBe("cus_created");

    expect(stripeMock.customers.create).toHaveBeenCalledWith({
      email: userA.email,
      metadata: { user_id: userA.id },
    });
    expect(db().billing_customers).toEqual([
      expect.objectContaining({
        user_id: userA.id,
        stripe_customer_id: "cus_created",
      }),
    ]);
  });
});

function stripeClientMock(options: { customerId?: string } = {}) {
  return {
    customers: {
      create: vi.fn(async () => ({ id: options.customerId ?? "cus_created" })),
    },
  };
}
