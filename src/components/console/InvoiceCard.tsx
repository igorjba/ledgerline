"use client";

import { Receipt } from "lucide-react";
import {
  cycleKey,
  flagLabel,
  formatBRL,
  invoiceAsOf,
  periodLabel,
} from "@/lib/domain";
import { CYCLE, useBillingStore } from "@/store/billingStore";
import { formatDateTime, formatKwh } from "@/lib/utils";
import { Badge } from "../ui/Badge";
import { Panel } from "../ui/Panel";
import { StatTile } from "../ui/StatTile";
import { Tooltip } from "../ui/Tooltip";

export function InvoiceCard() {
  const state = useBillingStore((s) => s.state);
  const clock = useBillingStore((s) => s.clock);
  const knownAsOf = useBillingStore((s) => s.knownAsOf);

  const asOf = knownAsOf ?? clock;
  const invoice = invoiceAsOf(state, CYCLE, asOf);
  const issued = state.invoices[0] ?? null;
  const live = knownAsOf === null;

  const differsFromIssued = issued !== null && issued.computed.totalCents !== invoice.totalCents;

  return (
    <Panel
      title="Fatura"
      icon={<Receipt size={14} />}
      tag={cycleKey(CYCLE)}
      hint="A conta do mês, detalhada por posto (horário) e bandeira. Muda conforme a data escolhida na máquina do tempo."
      bodyClassName="flex flex-col gap-3 p-3.5"
    >
      <p className="text-[0.72rem] leading-relaxed text-ink-dim">
        A conta de luz do mês, aberta por faixa de horário (posto) e com o adicional da bandeira. O valor muda conforme a
        data escolhida na máquina do tempo — abaixo você vê o que o sistema sabia naquele momento.
      </p>

      <div className="flex flex-wrap items-center gap-2 text-[0.7rem]">
        <Badge
          tone={live ? "good" : "info"}
          title="A que data se refere o cálculo mostrado (o que o sistema sabia naquele momento)"
        >
          {live ? "como se sabe agora" : `como se sabia em ${formatDateTime(asOf)}`}
        </Badge>
        {issued && !differsFromIssued && (
          <Badge tone="neutral" title="O valor exibido é idêntico ao da fatura que foi emitida">
            reproduz a fatura emitida
          </Badge>
        )}
        {differsFromIssued && (
          <Badge tone="warn" title="Algo mudou depois da emissão; clique em Reconciliar para gerar a nota de ajuste">
            difere da emitida · precisa reconciliar
          </Badge>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2">
        <StatTile label="Total" tone="money" value={formatBRL(invoice.totalCents)} title="Valor final da conta do mês" />
        <StatTile label="Energia" value={formatKwh(invoice.kwh)} title="Consumo total do período, em quilowatt-hora" />
        <StatTile
          label="Bandeira"
          value={flagLabel(invoice.flagColor)}
          title="Bandeira tarifária em vigor no mês, que define o adicional cobrado"
        />
      </div>

      <table className="w-full border-collapse text-[0.76rem]">
        <thead>
          <tr className="text-left text-[0.62rem] uppercase tracking-[0.1em] text-ink-faint">
            <th className="py-1 font-medium">
              <span className="inline-flex items-center gap-1">
                Posto
                <Tooltip
                  label="O que é posto"
                  text="Faixa de horário que define o preço: ponta (fim de tarde/noite em dias úteis, a mais cara), intermediário (1h antes e depois da ponta) e fora-ponta (o resto, além de fins de semana e feriados)."
                />
              </span>
            </th>
            <th className="py-1 text-right font-medium">kWh</th>
            <th className="py-1 text-right font-medium" title="Preço da energia por quilowatt-hora naquele posto">
              R$/kWh
            </th>
            <th className="py-1 text-right font-medium">Energia</th>
          </tr>
        </thead>
        <tbody className="font-mono tabular">
          {invoice.lines.length === 0 && (
            <tr>
              <td colSpan={4} className="py-3 text-center text-ink-faint">
                nenhuma leitura conhecida nesta data
              </td>
            </tr>
          )}
          {invoice.lines.map((line) => (
            <tr key={line.period} className="border-t border-edge/50">
              <td className="py-1.5 font-sans text-ink-dim">{periodLabel(line.period)}</td>
              <td className="py-1.5 text-right">{line.kwh.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}</td>
              <td className="py-1.5 text-right text-ink-faint">
                {line.energyRate.toLocaleString("pt-BR", { minimumFractionDigits: 5, maximumFractionDigits: 5 })}
              </td>
              <td className="py-1.5 text-right">{formatBRL(line.energyCents)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <dl className="flex flex-col gap-1 border-t border-edge/60 pt-2 font-mono text-[0.76rem] tabular">
        <Row label={`Adicional de bandeira (${flagLabel(invoice.flagColor)})`} value={formatBRL(invoice.flagCents)} />
        <Row label="Subtotal" value={formatBRL(invoice.subtotalCents)} muted />
        <Row label="Tributos (ICMS + PIS/COFINS)" value={formatBRL(invoice.taxCents)} muted />
        <Row label="Total" value={formatBRL(invoice.totalCents)} accent />
      </dl>
    </Panel>
  );
}

function Row({ label, value, muted, accent }: { label: string; value: string; muted?: boolean; accent?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <dt className={`font-sans ${accent ? "text-ink" : "text-ink-dim"}`}>{label}</dt>
      <dd className={accent ? "text-amber" : muted ? "text-ink-faint" : "text-ink"}>{value}</dd>
    </div>
  );
}
