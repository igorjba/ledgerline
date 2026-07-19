"use client";

import { Scale } from "lucide-react";
import { ACCOUNT_IDS, CHART, formatBRL, isBalanced, totalBalance, trialBalance } from "@/lib/domain";
import { useBillingStore } from "@/store/billingStore";
import { Badge } from "../ui/Badge";
import { Panel } from "../ui/Panel";
import { Tooltip } from "../ui/Tooltip";

export function LedgerCard() {
  const entries = useBillingStore((s) => s.state.entries);
  const balances = trialBalance(entries);
  const balanced = isBalanced(entries);
  const recent = entries.slice(-9).reverse();

  return (
    <Panel
      title="Livro-razão · partida dobrada"
      icon={<Scale size={14} />}
      tag={`${entries.length} lançamentos`}
      hint="Contabilidade de dupla entrada: todo valor entra em duas contas ao mesmo tempo (débito e crédito), e a soma tem de dar sempre zero. Se não der, há um erro."
      bodyClassName="flex flex-col gap-3 p-3.5"
    >
      <p className="text-[0.72rem] leading-relaxed text-ink-dim">
        O registro contábil por trás da conta. Cada valor é lançado em duas contas ao mesmo tempo — uma recebe (débito,
        <span className="text-ink"> D</span>), a outra entrega (crédito, <span className="text-credit">C</span>) — e a
        soma de tudo tem de fechar em zero.
      </p>

      <div className="flex items-center justify-between rounded-lg border border-edge/70 bg-panel-2/60 px-3 py-2">
        <div className="flex flex-col">
          <span className="text-[0.62rem] uppercase tracking-[0.12em] text-ink-faint">Fechamento do livro</span>
          <span className="font-mono text-sm text-ink-dim tabular">Σ de todos os lançamentos</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Badge tone={balanced ? "good" : "bad"} className="text-[0.8rem]">
            Σ = {formatBRL(totalBalance(entries))} {balanced ? "✓" : "✗"}
          </Badge>
          <Tooltip
            label="O que significa Σ = 0"
            text="Σ (sigma) é a soma de todos os lançamentos. Numa contabilidade correta ela é sempre zero: cada débito tem um crédito igual. O ✓ verde confirma que as contas fecham."
          />
        </div>
      </div>

      <table className="w-full border-collapse text-[0.76rem]">
        <tbody className="font-mono tabular">
          {ACCOUNT_IDS.map((id) => {
            const bal = balances[id] ?? 0;
            const side = bal === 0 ? "" : bal > 0 ? "D" : "C";
            return (
              <tr key={id} className="border-t border-edge/40 first:border-t-0">
                <td className="py-1.5 font-sans text-ink-dim">{CHART[id].label}</td>
                <td className="py-1.5 text-right text-ink-faint" title={bal >= 0 ? "Débito" : "Crédito"}>
                  {side}
                </td>
                <td className={`py-1.5 text-right ${bal < 0 ? "text-credit" : bal > 0 ? "text-ink" : "text-ink-faint"}`}>
                  {formatBRL(Math.abs(bal))}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div className="flex flex-col gap-1 border-t border-edge/60 pt-2">
        <span className="text-[0.6rem] font-medium uppercase tracking-[0.12em] text-ink-faint">
          Lançamentos recentes
        </span>
        <ul className="flex flex-col gap-0.5 font-mono text-[0.7rem] tabular">
          {recent.length === 0 && <li className="text-ink-faint">nenhum lançamento ainda — emita uma fatura</li>}
          {recent.map((e) => (
            <li key={e.id} className="flex items-center justify-between gap-2">
              <span className="truncate text-ink-faint">
                <span className={e.amount < 0 ? "text-credit" : "text-ink-dim"} title={e.amount < 0 ? "Crédito" : "Débito"}>
                  {e.amount < 0 ? "C" : "D"}
                </span>{" "}
                {CHART[e.account].label} · {e.memo}
              </span>
              <span className={e.amount < 0 ? "text-credit" : "text-ink"}>{formatBRL(Math.abs(e.amount))}</span>
            </li>
          ))}
        </ul>
      </div>
    </Panel>
  );
}
