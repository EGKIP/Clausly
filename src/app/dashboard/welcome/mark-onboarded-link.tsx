"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

/* Children render inside the button as-is so the parent server component can
 * compose lucide icons + label without serializing component types across the
 * server/client boundary. */
export function MarkOnboardedLink({
  href,
  children,
  variant = "primary",
}: {
  href: string;
  children: React.ReactNode;
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
      {pending ? "Saving..." : children}
    </Button>
  );
}
