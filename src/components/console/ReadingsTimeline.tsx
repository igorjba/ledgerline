"use client";

import { Layers } from "lucide-react";
import { formatDate, formatKwh } from "@/lib/utils";
import { useBillingStore } from "@/store/billingStore";
import { Badge } from "../ui/Badge";
import { Panel } from "../ui/Panel";

export function ReadingsTimeline() {
  const log = useBillingStore((s) => s.state.readings.log);
  const rows = [...log].sort(
    (a, b) => a.validRange.start - b.validRange.start || a.transactionRange.start - b.transactionRange.start,
  );

  return (
    <Panel
      title="Histórico de leituras (bitemporal)"
      icon={<Layers size={14} />}
      tag={`${log.length} versões`}
      hint="Toda leitura que já entrou fica registrada. Quando uma leitura é corrigida, a versão antiga não é apagada — ela é encerrada e uma nova é anexada. Nada se perde, tudo é auditável."
      bodyClassName="flex flex-col gap-2 p-3.5"
    >
      <p className="text-[0.7rem] leading-relaxed text-ink-dim">
        Cada versão registrada. Uma correção encerra a leitura anterior e anexa uma nova — a linha antiga nunca é
        sobrescrita.
      </p>

      <div className="max-h-64 overflow-y-auto">
        <table className="w-full border-collapse text-[0.72rem]">
          <thead className="sticky top-0 bg-panel/95">
            <tr className="text-left text-[0.6rem] uppercase tracking-[0.1em] text-ink-faint">
              <th className="py-1 font-medium" title="Dia a que a leitura de consumo se refere">
                Intervalo válido
              </th>
              <th className="py-1 text-right font-medium">kWh</th>
              <th className="py-1 text-right font-medium" title="Se esta versão é a que vale hoje ou foi substituída">
                Situação
              </th>
            </tr>
          </thead>
          <tbody className="font-mono tabular">
            {rows.map((v) => {
              const open = v.transactionRange.end === null;
              return (
                <tr key={v.id} className={`border-t border-edge/40 ${open ? "" : "text-ink-faint"}`}>
                  <td className="py-1.5">{formatDate(v.validRange.start)}</td>
                  <td className={`py-1.5 text-right ${open ? "" : "line-through"}`}>{formatKwh(v.value.kwh)}</td>
                  <td className="py-1.5 text-right">
                    <Badge
                      tone={open ? "good" : "neutral"}
                      title={open ? "Versão em vigor" : "Substituída por uma correção posterior"}
                    >
                      {open ? "vigente" : "substituída"}
                    </Badge>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}
