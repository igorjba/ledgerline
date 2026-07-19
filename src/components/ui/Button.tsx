"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

type Variant = "default" | "accent" | "ghost";

// Each variant reads clearly as a button at rest (visible border + fill) and jumps
// on hover — a distinctly lighter fill, an amber border and brighter text — so the
// affordance is obvious. Hover uses `enabled:` so a disabled button never reacts.
const VARIANTS: Record<Variant, string> = {
  default:
    "border-edge-bright bg-panel-2 text-ink-dim enabled:hover:border-amber/60 enabled:hover:bg-edge-bright enabled:hover:text-ink",
  accent: "border-amber/50 bg-amber/15 text-amber enabled:hover:border-amber enabled:hover:bg-amber/25",
  ghost:
    "border-transparent bg-transparent text-ink-faint enabled:hover:border-edge-bright enabled:hover:bg-panel-2 enabled:hover:text-ink",
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  icon?: ReactNode;
}

export function Button({ variant = "default", icon, className, children, ...rest }: ButtonProps) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[0.78rem] font-medium",
        // `pointer` hand cursor (buttons don't get it by default); presses in on click.
        "transition-colors duration-150 enabled:active:translate-y-px",
        "disabled:cursor-not-allowed disabled:opacity-40",
        VARIANTS[variant],
        className,
      )}
      {...rest}
    >
      {icon}
      {children}
    </button>
  );
}
