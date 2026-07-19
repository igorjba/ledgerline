"use client";

import { Radio, Send } from "lucide-react";
import { pendingOutbox, type OutboxEventType } from "@/lib/domain";
import { useBillingStore } from "@/store/billingStore";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { Panel } from "../ui/Panel";

const TYPE_LABEL: Record<OutboxEventType, string> = {
  "reading.ingested": "leitura registrada",
  "flag.declared": "bandeira declarada",
  "invoice.issued": "fatura emitida",
  "adjustment.issued": "nota de ajuste",
};

export function OutboxCard() {
  const outbox = useBillingStore((s) => s.state.outbox);
  const state = useBillingStore((s) => s.state);
  const drain = useBillingStore((s) => s.drain);
  const pending = pendingOutbox(state).length;
  const recent = outbox.slice(-8).reverse();

  return (
    <Panel
      title="Outbox transacional"
      icon={<Radio size={14} />}
      tag={`${pending} pendentes`}
      hint="Uma fila de saída que garante entrega. Cada mudança grava um evento junto com o dado, e um processo os envia depois — assim nenhuma notificação se perde, mesmo se o servidor cair no meio."
      actions={
        <Button
          variant="accent"
          icon={<Send size={12} />}
          onClick={drain}
          disabled={pending === 0}
          title="Envia os eventos pendentes da fila para fora"
        >
          drenar
        </Button>
      }
      bodyClassName="flex flex-col gap-2 p-3.5"
    >
      <p className="text-[0.7rem] leading-relaxed text-ink-dim">
        Cada mudança grava um evento na mesma transação do dado. Um processo os entrega depois do commit — então nada se
        perde se a função cair entre uma coisa e outra.
      </p>

      <ul className="flex flex-col gap-0.5 font-mono text-[0.7rem] tabular">
        {recent.length === 0 && <li className="text-ink-faint">nenhum evento ainda</li>}
        {recent.map((e) => (
          <li key={e.id} className="flex items-center justify-between gap-2 border-t border-edge/40 py-1 first:border-t-0">
            <span className="flex items-center gap-1.5 truncate">
              <Badge tone={e.published ? "good" : "warn"} title={e.published ? "Evento já entregue" : "Evento ainda na fila"}>
                {e.published ? "enviado" : "pendente"}
              </Badge>
              <span className="text-ink-dim">{TYPE_LABEL[e.type as OutboxEventType] ?? e.type}</span>
              <span className="truncate text-ink-faint">{e.summary}</span>
            </span>
          </li>
        ))}
      </ul>
    </Panel>
  );
}
