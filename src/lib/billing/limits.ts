export const PLAN_LIMITS = {
  free: { maxDocuments: 5, hasInsights: false, hasPriorityProcessing: false, qaPerDay: 25 },
  pro: { maxDocuments: Infinity, hasInsights: true, hasPriorityProcessing: true, qaPerDay: 250 },
} as const;

export type PlanName = keyof typeof PLAN_LIMITS;
