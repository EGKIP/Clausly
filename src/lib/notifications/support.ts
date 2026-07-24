export const DEFAULT_SUPPORT_EMAIL = "support@clausly.app";
export const DEFAULT_FROM_EMAIL = "Clausly <support@send.clausly.app>";

export function getSupportEmail() {
  return process.env.CLAUSLY_SUPPORT_EMAIL || DEFAULT_SUPPORT_EMAIL;
}

export function getDefaultFromEmail() {
  return process.env.CLAUSLY_EMAIL_FROM || DEFAULT_FROM_EMAIL;
}
