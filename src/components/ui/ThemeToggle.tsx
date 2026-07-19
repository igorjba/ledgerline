"use client";

import { Moon, Sun } from "lucide-react";

/**
 * Dark/light toggle. The visible icon is chosen by CSS from the `data-theme` set
 * on <html> (see globals.css), so there is no hydration mismatch and no flash —
 * this component only flips the attribute and persists the choice. Dark is the
 * default; a stored "light" is re-applied on load by the inline script in layout.
 */
export function ThemeToggle() {
  const toggle = () => {
    const root = document.documentElement;
    const next = root.getAttribute("data-theme") === "light" ? "dark" : "light";
    if (next === "light") root.setAttribute("data-theme", "light");
    else root.removeAttribute("data-theme");
    try {
      localStorage.setItem("theme", next);
    } catch {
      // Ignore: private mode / storage disabled — the toggle still works for the session.
    }
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="Alternar entre modo claro e escuro"
      title="Alternar tema claro / escuro"
      className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-transparent px-1.5 py-1 text-ink-faint transition-colors hover:border-edge-bright hover:bg-panel-2 hover:text-ink active:translate-y-px"
    >
      <Sun size={13} className="theme-icon-sun" aria-hidden />
      <Moon size={13} className="theme-icon-moon" aria-hidden />
    </button>
  );
}
