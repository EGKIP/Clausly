export const AUDIT_ACTIONS = {
  DOCUMENT_UPLOADED: "document.uploaded",
  DOCUMENT_RENAMED: "document.renamed",
  DOCUMENT_DELETED: "document.deleted",
  REMINDER_APPROVED: "reminder.approved",
  REMINDER_DISMISSED: "reminder.dismissed",
  REMINDER_FIRED: "reminder.fired",
  CONVERSATION_CREATED: "conversation.created",
  SUBSCRIPTION_UPGRADED: "subscription.upgraded",
  SUBSCRIPTION_CANCELLED: "subscription.cancelled",
  SHARE_CREATED: "share.created",
  SHARE_REVOKED: "share.revoked",
  EXPORT_CREATED: "export.created",
  ACCOUNT_DELETED: "account.deleted",
} as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS];
