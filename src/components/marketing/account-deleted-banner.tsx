"use client";

import { useSearchParams } from "next/navigation";

export function AccountDeletedBanner() {
  const searchParams = useSearchParams();
  if (searchParams.get("account") !== "deleted") return null;

  return (
    <div className="mx-auto mt-4 w-[min(1120px,calc(100%-32px))] rounded-[var(--radius-md)] border border-[color-mix(in_oklch,var(--accent)_26%,var(--border))] bg-[var(--accent-soft)] px-4 py-3 text-[13.5px] text-[var(--accent-ink)]">
      Your Clausly account has been deleted. Thanks for giving it a careful look.
    </div>
  );
}
