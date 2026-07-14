import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createSupabaseClient,
  resetSupabaseMock,
  seedBillingCustomer,
  setSupabaseUser,
  userA,
} from "@/../tests/helpers/supabase";

const portalCreateMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/server", () => ({ createClient: async () => createSupabaseClient() }));
vi.mock("@/lib/billing/stripe", () => ({
  getStripe: () => ({
    billingPortal: {
      sessions: {
        create: portalCreateMock,
      },
    },
  }),
}));

import { POST } from "../route";

describe("POST /api/billing/portal", () => {
  beforeEach(() => {
    resetSupabaseMock(userA);
    portalCreateMock.mockReset();
    portalCreateMock.mockResolvedValue({ url: "https://billing.stripe.test/session" });
    process.env.NEXT_PUBLIC_BASE_URL = "https://clausly.test";
  });

  it("returns 401 when unauthenticated", async () => {
    setSupabaseUser(null);

    const response = await POST();

    expect(response.status).toBe(401);
  });

  it("returns 404 when no Stripe customer exists", async () => {
    const response = await POST();
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body).toEqual({ error: "No subscription found." });
  });

  it("creates a billing portal session", async () => {
    seedBillingCustomer(userA, { stripe_customer_id: "cus_existing" });

    const response = await POST();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ url: "https://billing.stripe.test/session" });
    expect(portalCreateMock).toHaveBeenCalledWith({
      customer: "cus_existing",
      return_url: "https://clausly.test/dashboard/settings",
    });
  });

  it("returns a readable Stripe error when portal creation fails", async () => {
    seedBillingCustomer(userA, { stripe_customer_id: "cus_existing" });
    portalCreateMock.mockRejectedValue(new Error("Customer portal is not configured."));

    const response = await POST();
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({ error: "Customer portal is not configured." });
  });
});
