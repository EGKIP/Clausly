"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

export function MarkOnboardedLink({
  href,
  children,
  icon: Icon,
  variant = "primary",
}: {
  href: string;
  children: React.ReactNode;
  icon?: LucideIcon;
  variant?: "primary" | "secondary";
}) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);

  return (
    <Button
      variant={variant}
      size="lg"
      disabled={pending}
      onClick={async () => {
        setPending(true);
        await fetch("/api/onboarding/complete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "{}",
        }).catch(() => null);
        router.push(href);
        router.refresh();
      }}
    >
      {Icon && <Icon className="size-4" />}
      {pending ? "Saving..." : children}
    </Button>
  );
}
