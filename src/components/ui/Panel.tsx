import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Tooltip } from "./Tooltip";

interface PanelProps {
  title?: string;
  icon?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  /** Small monospace tag shown at the right of the header (e.g. a live count). */
  tag?: ReactNode;
  /** Plain-language tooltip shown on hover over the panel title. */
  hint?: string;
}

const BASE =
  "flex min-h-0 flex-col overflow-hidden rounded-panel border border-edge bg-panel/80 backdrop-blur-sm " +
  "shadow-[0_1px_0_0_rgba(255,255,255,0.02)_inset,0_20px_40px_-24px_rgba(0,0,0,0.8)]";

export function Panel({ title, icon, actions, children, className, bodyClassName, tag, hint }: PanelProps) {
  return (
    <section className={cn(BASE, className)}>
      {title && (
        <header className="flex items-center gap-2 border-b border-edge/70 px-3.5 py-2.5">
          {icon && <span className="text-amber">{icon}</span>}
          <h2 className="text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-ink-dim">{title}</h2>
          {hint && <Tooltip text={hint} label={`O que é: ${title}`} />}
          <div className="ml-auto flex items-center gap-2">
            {tag && <span className="font-mono text-[0.7rem] text-ink-faint tabular">{tag}</span>}
            {actions}
          </div>
        </header>
      )}
      <div className={cn("min-h-0 flex-1", bodyClassName)}>{children}</div>
    </section>
  );
}
