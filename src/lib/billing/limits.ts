export const PLAN_LIMITS = {
  free: { maxDocuments: 5, hasInsights: false, hasPriorityProcessing: false },
  pro: { maxDocuments: Infinity, hasInsights: true, hasPriorityProcessing: true },
} as const;

export type PlanName = keyof typeof PLAN_LIMITS;
