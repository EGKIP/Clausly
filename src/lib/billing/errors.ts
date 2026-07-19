export const BILLING_CHECKOUT_ERROR = "Stripe checkout could not be started. Please try again or contact support.";
export const BILLING_PORTAL_ERROR = "Stripe portal could not be opened. Please try again or contact support.";
export const BILLING_CONFIG_ERROR = "Billing isn't configured correctly on our side. Please contact support.";
export const BILLING_CONFIG_ERROR_CODE = "BILLING_CONFIG_ERROR";

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
    // Stripe error messages carry the actionable detail ("No such price:
    // 'prod_x'") but auth failures echo part of the API key — strip any
    // key-shaped token before it reaches logs.
    message: error instanceof Error ? sanitizeBillingMessage(error.message) : undefined,
    type: stringValue(stripeError.type),
    code: stringValue(stripeError.code),
    statusCode: numberValue(stripeError.statusCode),
    requestId: stringValue(stripeError.requestId),
  };
}

function sanitizeBillingMessage(message: string) {
  return message
    .replace(/\b(sk|rk|pk|whsec)_[A-Za-z0-9*_$]+/g, "[redacted]")
    .slice(0, 300);
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value : undefined;
}

function numberValue(value: unknown) {
  return typeof value === "number" ? value : undefined;
}
