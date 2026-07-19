"use client";

import { useEffect, useRef, useState } from "react";
import { FlaskConical, Play } from "lucide-react";
import { runSequences } from "@/lib/harness/invariants";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { Panel } from "../ui/Panel";
import { StatTile } from "../ui/StatTile";

const TARGET = 5000;
const CHUNK = 200;

interface Report {
  sequences: number;
  checks: number;
  counterexamples: number;
  elapsedMs: number;
}

export function InvariantHarness() {
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [report, setReport] = useState<Report | null>(null);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    };
  }, []);

  const run = () => {
    setRunning(true);
    setReport(null);
    setProgress(0);
    let done = 0;
    let checks = 0;
    let counterexamples = 0;
    const t0 = performance.now();

    const step = () => {
      const n = Math.min(CHUNK, TARGET - done);
      const r = runSequences(1 + done, n);
      done += r.sequences;
      checks += r.checks;
      counterexamples += r.counterexamples;
      setProgress(done / TARGET);
      if (done < TARGET) {
        timer.current = window.setTimeout(step, 0);
      } else {
        setReport({ sequences: done, checks, counterexamples, elapsedMs: performance.now() - t0 });
        setRunning(false);
      }
    };
    step();
  };

  return (
    <Panel
      title="Verificador de invariantes"
      icon={<FlaskConical size={14} />}
      tag={report ? `${report.checks.toLocaleString("pt-BR")} verificações` : "parado"}
      hint="Em vez de só afirmar que o sistema está correto, ele testa: gera milhares de sequências aleatórias de operações e confere se as contas sempre fecham. Zero contraexemplos = nenhuma falha encontrada."
      actions={
        <Button
          variant="accent"
          icon={<Play size={12} />}
          onClick={run}
          disabled={running}
          title="Roda milhares de simulações e verifica se o livro sempre fecha em zero"
        >
          {running ? "rodando…" : `rodar ${TARGET.toLocaleString("pt-BR")}`}
        </Button>
      }
      bodyClassName="flex flex-col gap-3 p-3.5"
    >
      <p className="text-[0.72rem] leading-relaxed text-ink-dim">
        A mesma prova que roda na integração contínua, ao vivo: milhares de sequências embaralhadas — fora de ordem,
        duplicadas, corrigidas — cada uma conferida para que o livro-razão some zero a cada passo. Prova o motor, em vez
        de apenas alegar que funciona.
      </p>

      <div className="h-1.5 overflow-hidden rounded-full bg-panel-2">
        <div
          className="h-full rounded-full bg-amber transition-[width] duration-100"
          style={{ width: `${Math.round(progress * 100)}%` }}
        />
      </div>

      {report && (
        <div className="grid grid-cols-3 gap-2">
          <StatTile
            label="Sequências"
            value={report.sequences.toLocaleString("pt-BR")}
            title="Quantas sequências aleatórias de operações foram testadas"
          />
          <StatTile
            label="Contraexemplos"
            tone={report.counterexamples === 0 ? "credit" : "debit"}
            value={report.counterexamples}
            title="Quantas vezes as contas NÃO fecharam. Zero é o resultado esperado."
          />
          <StatTile label="Tempo" tone="muted" value={`${Math.round(report.elapsedMs)} ms`} title="Duração do teste" />
        </div>
      )}

      {report && (
        <Badge
          tone={report.counterexamples === 0 ? "good" : "bad"}
          className="self-start text-[0.76rem]"
          title="Confirma que a soma do livro deu zero em todas as verificações"
        >
          {report.counterexamples === 0 ? "Σ = 0 vale · 0 contraexemplos" : "invariante violada"}
        </Badge>
      )}
    </Panel>
  );
}
