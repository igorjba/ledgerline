"use client";

import { useEffect } from "react";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="font-mono text-sm uppercase tracking-[0.2em] text-debit">erro</p>
      <h1 className="text-2xl font-semibold">Algo não fechou.</h1>
      <p className="max-w-md text-ink-dim">O console encontrou um estado inesperado e parou para manter a consistência.</p>
      <button
        type="button"
        onClick={reset}
        className="mt-2 cursor-pointer rounded-lg border border-edge-bright bg-panel-2 px-4 py-2 text-sm text-ink transition-colors hover:border-amber/60 hover:bg-edge-bright active:translate-y-px"
      >
        Tentar de novo
      </button>
    </main>
  );
}
