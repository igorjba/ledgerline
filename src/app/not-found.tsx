import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="font-mono text-sm uppercase tracking-[0.2em] text-ink-faint">404 · não encontrado</p>
      <h1 className="text-2xl font-semibold">Esta página nunca foi registrada.</h1>
      <p className="max-w-md text-ink-dim">Nenhuma versão dela é válida em nenhuma data.</p>
      <Link
        href="/"
        className="mt-2 cursor-pointer rounded-lg border border-edge-bright bg-panel-2 px-4 py-2 text-sm text-ink transition-colors hover:border-amber/60 hover:bg-edge-bright active:translate-y-px"
      >
        Voltar ao console
      </Link>
    </main>
  );
}
