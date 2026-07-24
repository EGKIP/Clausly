export const DEFAULT_SUPPORT_EMAIL = "support@cloudly.app";

export function getSupportEmail() {
  return process.env.CLAUSLY_SUPPORT_EMAIL || DEFAULT_SUPPORT_EMAIL;
}

export function getDefaultFromEmail() {
  return process.env.CLAUSLY_EMAIL_FROM || `Clausly <${getSupportEmail()}>`;
}
