"use client";

import { RotateCcw } from "lucide-react";
import { CYCLE, METER, useBillingStore } from "@/store/billingStore";
import { cycleKey } from "@/lib/domain";
import { formatDateTime } from "@/lib/utils";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";

export function TopBar() {
  const clock = useBillingStore((s) => s.clock);
  const reset = useBillingStore((s) => s.reset);

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-edge/70 px-4 py-3">
      <div className="flex items-baseline gap-2">
        <span className="font-mono text-sm font-semibold tracking-tight text-amber">Ledgerline</span>
        <span className="text-[0.7rem] text-ink-faint">console de faturamento bitemporal</span>
      </div>

      <div className="ml-auto flex flex-wrap items-center gap-2 text-[0.7rem] text-ink-dim">
        <Badge tone="neutral" title="Identificador do medidor de energia em demonstração">
          medidor {METER}
        </Badge>
        <Badge tone="neutral" title="Mês de referência da fatura (ciclo de faturamento)">
          ciclo {cycleKey(CYCLE)}
        </Badge>
        <Badge tone="info" title="Todo o cálculo roda aqui no seu navegador, sem enviar nada a um servidor">
          <span className="live-dot inline-block h-1.5 w-1.5 rounded-full bg-flux" aria-hidden />
          motor: no navegador
        </Badge>
        <span className="font-mono tabular text-ink-faint" title="Horário atual do sistema na simulação">
          agora {formatDateTime(clock)}
        </span>
        <Button
          variant="ghost"
          icon={<RotateCcw size={13} />}
          onClick={reset}
          aria-label="Reiniciar cenário"
          title="Recomeça a demonstração do zero, com o cenário inicial"
        >
          reiniciar
        </Button>
      </div>
    </div>
  );
}
