export const BILLING_CHECKOUT_ERROR = "Stripe checkout could not be started. Please try again or contact support.";
export const BILLING_PORTAL_ERROR = "Stripe portal could not be opened. Please try again or contact support.";

type StripeLikeError = {
  type?: unknown;
  code?: unknown;
  statusCode?: unknown;
  requestId?: unknown;
};

export function logBillingError(context: string, error: unknown) {
  const metadata = billingErrorMetadata(error);
  console.warn(context, metadata);
}

function billingErrorMetadata(error: unknown) {
  if (!error || typeof error !== "object") {
    return { type: typeof error };
  }

  const stripeError = error as StripeLikeError;
  return {
    name: error instanceof Error ? error.name : undefined,
    type: stringValue(stripeError.type),
    code: stringValue(stripeError.code),
    statusCode: numberValue(stripeError.statusCode),
    requestId: stringValue(stripeError.requestId),
  };
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value : undefined;
}

function numberValue(value: unknown) {
  return typeof value === "number" ? value : undefined;
}
