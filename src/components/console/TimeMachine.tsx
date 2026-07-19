"use client";

import { History } from "lucide-react";
import { knownAt } from "@/lib/domain";
import { BASE_NOW, useBillingStore } from "@/store/billingStore";
import { formatDateTime } from "@/lib/utils";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { Panel } from "../ui/Panel";

export function TimeMachine() {
  const clock = useBillingStore((s) => s.clock);
  const knownAsOf = useBillingStore((s) => s.knownAsOf);
  const setKnownAsOf = useBillingStore((s) => s.setKnownAsOf);
  const log = useBillingStore((s) => s.state.readings.log);

  const asOf = knownAsOf ?? clock;
  const min = BASE_NOW;
  const max = clock;
  const live = knownAsOf === null;
  const knownCount = knownAt(log, asOf).length;

  return (
    <Panel
      title="Máquina do tempo bitemporal"
      icon={<History size={14} />}
      hint="O sistema guarda não só o que aconteceu, mas quando ele ficou sabendo de cada coisa. Assim dá para reconstruir a conta exatamente como ela estava em qualquer data passada."
      bodyClassName="flex flex-col gap-3 p-3.5"
    >
      <p className="text-[0.72rem] leading-relaxed text-ink-dim">
        Arraste para voltar no tempo. Cada painel é recalculado para{" "}
        <span className="text-flux">aquilo que o sistema sabia naquele instante</span> — reproduzindo a fatura como ela
        estava antes de qualquer correção posterior.
      </p>

      <div className="flex items-center justify-between text-[0.7rem]">
        <Badge tone={live ? "good" : "info"} title="Você está no presente ou olhando para o passado?">
          {live ? "ao vivo · agora" : "voltando no tempo"}
        </Badge>
        <span className="font-mono tabular text-ink-dim">como se sabia em {formatDateTime(asOf)}</span>
      </div>

      <input
        type="range"
        min={min}
        max={max}
        step={60_000}
        value={asOf}
        onChange={(e) => {
          const v = Number(e.target.value);
          setKnownAsOf(v >= max ? null : v);
        }}
        aria-label="Data de referência (o que o sistema sabia)"
        title="Arraste para escolher a data de referência do cálculo"
        className="w-full cursor-pointer accent-amber"
      />

      <div className="flex items-center justify-between font-mono text-[0.64rem] tabular text-ink-faint">
        <span>{formatDateTime(min)}</span>
        <span title="Quantas leituras o sistema já conhecia nesta data">{knownCount} leituras conhecidas</span>
        <span>{formatDateTime(max)}</span>
      </div>

      {!live && (
        <Button
          variant="ghost"
          className="self-start"
          onClick={() => setKnownAsOf(null)}
          title="Voltar para o presente"
        >
          ir para agora
        </Button>
      )}
    </Panel>
  );
}
