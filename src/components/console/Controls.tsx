"use client";

import { Copy, PencilLine, Plus, Receipt, Scale, Shuffle } from "lucide-react";
import { FLAG_COLORS, flagLabel, outcomeLabel, type FlagColor } from "@/lib/domain";
import { useBillingStore } from "@/store/billingStore";
import { cn } from "@/lib/utils";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { Panel } from "../ui/Panel";

const FLAG_DOT: Record<FlagColor, string> = {
  green: "bg-flag-green",
  yellow: "bg-flag-yellow",
  red1: "bg-flag-red1",
  red2: "bg-flag-red2",
};

const FLAG_HINT: Record<FlagColor, string> = {
  green: "Bandeira verde: sem custo extra na conta",
  yellow: "Bandeira amarela: pequeno adicional por kWh",
  red1: "Bandeira vermelha patamar 1: adicional maior por kWh",
  red2: "Bandeira vermelha patamar 2: o maior adicional por kWh",
};

export function Controls() {
  const store = useBillingStore();
  const outcomeTone =
    store.lastOutcome === "duplicate" ? "info" : store.lastOutcome === "corrected" ? "warn" : "good";

  return (
    <Panel
      title="Ingestão & tarifa"
      icon={<Shuffle size={14} />}
      hint="Aqui você alimenta o sistema: registra leituras do medidor, escolhe a bandeira tarifária e emite ou corrige a fatura."
      bodyClassName="flex flex-col gap-3 p-3.5"
    >
      <p className="text-[0.72rem] leading-relaxed text-ink-dim">
        Simule o dia a dia de um medidor: registre leituras de consumo (inclusive repetidas ou atrasadas), escolha a
        bandeira do mês e feche a conta. Passe o mouse sobre o <span className="text-amber">?</span> de cada painel para
        entender o que ele faz.
      </p>

      <Group label="Registrar uma leitura">
        <Button
          icon={<Plus size={13} />}
          onClick={store.addReading}
          title="Registra uma nova leitura de consumo do medidor"
        >
          Adicionar
        </Button>
        <Button
          icon={<Shuffle size={13} />}
          onClick={store.injectOutOfOrder}
          title="Registra uma leitura de um período anterior que chegou atrasada — o sistema aceita sem bagunçar o resultado"
        >
          Fora de ordem
        </Button>
        <Button
          icon={<Copy size={13} />}
          onClick={store.injectDuplicate}
          title="Reenvia a última leitura; o sistema reconhece que é repetida e a ignora (idempotência)"
        >
          Duplicada
        </Button>
        <Button
          icon={<PencilLine size={13} />}
          onClick={store.injectCorrection}
          title="Reenvia a leitura mais antiga com outro valor; gera uma correção sem apagar a original"
        >
          Corrigir a mais antiga
        </Button>
      </Group>

      <Group label="Bandeira tarifária">
        {FLAG_COLORS.map((color) => (
          <Button key={color} onClick={() => store.setFlag(color)} title={FLAG_HINT[color]}>
            <span className={cn("h-2 w-2 rounded-full", FLAG_DOT[color])} aria-hidden />
            {flagLabel(color)}
          </Button>
        ))}
      </Group>

      <Group label="Faturamento">
        <Button
          variant="accent"
          icon={<Receipt size={13} />}
          onClick={store.issue}
          title="Fecha a conta do mês e lança os valores no livro-razão"
        >
          Emitir fatura
        </Button>
        <Button
          variant="accent"
          icon={<Scale size={13} />}
          onClick={store.reconcileCycle}
          title="Recalcula o mês e, se algo mudou, emite uma nota de ajuste — a fatura original nunca é alterada"
        >
          Reconciliar
        </Button>
      </Group>

      <div className="flex items-center gap-2 border-t border-edge/60 pt-2.5 text-[0.7rem] text-ink-dim">
        {store.lastOutcome && (
          <Badge tone={outcomeTone} title="Resultado da última leitura registrada">
            {outcomeLabel(store.lastOutcome)}
          </Badge>
        )}
        <span className="truncate">{store.lastEvent}</span>
      </div>
    </Panel>
  );
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[0.6rem] font-medium uppercase tracking-[0.12em] text-ink-faint">{label}</span>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}
