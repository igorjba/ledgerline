"use client";

import { HelpCircle } from "lucide-react";
import { useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

interface TipState {
  x: number;
  y: number;
  below: boolean;
}

/**
 * A plain-language tooltip triggered by a small "?" affordance. Shows on hover and
 * on keyboard focus (accessible), and is positioned with `position: fixed` so it
 * escapes the panels' `overflow: hidden` instead of being clipped. The trigger
 * carries an aria-label and the bubble a `tooltip` role.
 */
export function Tooltip({
  text,
  label = "Mais informações",
  children,
  className,
}: {
  text: string;
  label?: string;
  children?: ReactNode;
  className?: string;
}) {
  const [tip, setTip] = useState<TipState | null>(null);
  const ref = useRef<HTMLButtonElement>(null);

  const show = () => {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    const half = 130;
    const x = Math.min(Math.max(rect.left + rect.width / 2, half + 8), window.innerWidth - half - 8);
    const below = rect.top < 160;
    setTip({ x, y: below ? rect.bottom : rect.top, below });
  };
  const hide = () => setTip(null);

  return (
    <>
      <button
        ref={ref}
        type="button"
        aria-label={label}
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
        className={cn(
          "inline-flex cursor-help items-center text-ink-faint transition-colors hover:text-amber",
          className,
        )}
      >
        {children ?? <HelpCircle size={13} aria-hidden />}
      </button>
      {tip && (
        <span
          role="tooltip"
          style={{
            position: "fixed",
            left: tip.x,
            top: tip.y,
            transform: `translate(-50%, ${tip.below ? "8px" : "calc(-100% - 8px)"})`,
          }}
          className="pointer-events-none z-50 max-w-[260px] rounded-lg border border-edge-bright bg-panel-2 px-2.5 py-1.5 text-[0.72rem] font-normal leading-snug text-ink shadow-[0_10px_30px_-10px_rgba(0,0,0,0.85)]"
        >
          {text}
        </span>
      )}
    </>
  );
}
