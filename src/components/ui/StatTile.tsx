import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type StatTone = "neutral" | "money" | "credit" | "debit" | "muted";

const TONE: Record<StatTone, string> = {
  neutral: "text-ink",
  money: "text-amber",
  credit: "text-credit",
  debit: "text-debit",
  muted: "text-ink-faint",
};

interface StatTileProps {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  tone?: StatTone;
  icon?: ReactNode;
  /** Tooltip shown on hover, for a plain-language explanation. */
  title?: string;
}

export function StatTile({ label, value, sub, tone = "neutral", icon, title }: StatTileProps) {
  return (
    <div
      title={title}
      className={cn(
        "flex flex-col gap-1 rounded-lg border border-edge/70 bg-panel-2/60 px-3 py-2.5",
        title && "cursor-help",
      )}
    >
      <div className="flex items-center gap-1.5 text-[0.62rem] font-medium uppercase tracking-[0.12em] text-ink-faint">
        {icon}
        {label}
      </div>
      <div className={cn("font-mono text-xl font-semibold leading-none tabular", TONE[tone])}>{value}</div>
      {sub && <div className="text-[0.66rem] text-ink-faint tabular">{sub}</div>}
    </div>
  );
}
