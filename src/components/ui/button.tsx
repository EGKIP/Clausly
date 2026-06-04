import * as React from "react";
import Link from "next/link";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const button = cva(
  "relative inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium select-none transition-[transform,background,color,border,box-shadow] duration-200 ease-[var(--ease-out-quart)] disabled:pointer-events-none disabled:opacity-50 active:scale-[0.985] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)]",
  {
    variants: {
      variant: {
        primary:
          "bg-[var(--foreground)] text-[var(--background)] hover:bg-[var(--color-ink-soft)] shadow-[inset_0_1px_0_0_oklch(100%_0_0/0.1),0_1px_2px_oklch(0%_0_0/0.1)]",
        accent:
          "bg-[var(--accent)] text-white hover:brightness-[1.08] shadow-[inset_0_1px_0_0_oklch(100%_0_0/0.15),0_4px_14px_-2px_color-mix(in_oklch,var(--accent)_45%,transparent)]",
        secondary:
          "bg-[var(--surface)] text-[var(--foreground)] border border-[var(--border)] hover:bg-[var(--surface-2)] hover:border-[var(--border-strong)]",
        ghost:
          "text-[var(--foreground)] hover:bg-[var(--surface-2)]",
        outline:
          "border border-[var(--border-strong)] text-[var(--foreground)] hover:bg-[var(--surface-2)]",
        link: "text-[var(--accent)] underline-offset-4 hover:underline px-0",
      },
      size: {
        sm: "h-8 px-3 text-[13px] rounded-[var(--radius-sm)]",
        md: "h-10 px-4 text-sm rounded-[var(--radius-sm)]",
        lg: "h-12 px-5 text-[15px] rounded-[var(--radius-md)]",
        xl: "h-14 px-7 text-base rounded-[var(--radius-md)]",
        icon: "size-9 rounded-[var(--radius-sm)]",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  }
);

type ButtonBaseProps = VariantProps<typeof button> & { className?: string };

type ButtonProps =
  | (React.ButtonHTMLAttributes<HTMLButtonElement> & ButtonBaseProps & { href?: undefined })
  | (Omit<React.ComponentProps<typeof Link>, "className"> & ButtonBaseProps & { href: string });

export function Button(props: ButtonProps) {
  const { variant, size, className, ...rest } = props as ButtonProps & { href?: string };
  const classes = cn(button({ variant, size }), className);
  if ("href" in rest && rest.href) {
    return <Link {...(rest as React.ComponentProps<typeof Link>)} className={classes} />;
  }
  return <button {...(rest as React.ButtonHTMLAttributes<HTMLButtonElement>)} className={classes} />;
}

export { button as buttonVariants };
