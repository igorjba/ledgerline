import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type Tone = "neutral" | "good" | "warn" | "bad" | "info";

const TONES: Record<Tone, string> = {
  neutral: "border-edge bg-panel-2 text-ink-dim",
  good: "border-credit/30 bg-credit/10 text-credit",
  warn: "border-amber/30 bg-amber/10 text-amber",
  bad: "border-debit/30 bg-debit/10 text-debit",
  info: "border-flux/30 bg-flux/10 text-flux",
};

export function Badge({
  children,
  tone = "neutral",
  className,
  title,
}: {
  children: ReactNode;
  tone?: Tone;
  className?: string;
  title?: string;
}) {
  return (
    <span
      title={title}
      className={cn(
        "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 font-mono text-[0.66rem] tabular",
        title && "cursor-help",
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
