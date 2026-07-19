/**
 * The chart of accounts. Small on purpose — enough to show a real double-entry
 * shape for energy billing without turning into an accounting package.
 *
 * Sign convention: a debit is positive, a credit is negative, and every
 * transaction's signed amounts sum to zero. Normal balances follow from the
 * account's nature (assets debit-positive, revenue/liabilities credit-negative),
 * which `normalBalance` records so a report can present figures the way an
 * accountant expects.
 */

export type AccountId =
  | "receivable"
  | "energy_revenue"
  | "flag_surcharge"
  | "tax_payable"
  | "adjustments";

export type AccountKind = "asset" | "revenue" | "liability";

export interface Account {
  readonly id: AccountId;
  readonly kind: AccountKind;
  readonly label: string;
  /** The side this account normally carries a balance on. */
  readonly normalBalance: "debit" | "credit";
}

export const CHART: Record<AccountId, Account> = {
  receivable: {
    id: "receivable",
    kind: "asset",
    label: "Contas a receber",
    normalBalance: "debit",
  },
  energy_revenue: {
    id: "energy_revenue",
    kind: "revenue",
    label: "Receita de energia",
    normalBalance: "credit",
  },
  flag_surcharge: {
    id: "flag_surcharge",
    kind: "revenue",
    label: "Receita de bandeira",
    normalBalance: "credit",
  },
  tax_payable: {
    id: "tax_payable",
    kind: "liability",
    label: "Tributos a recolher",
    normalBalance: "credit",
  },
  adjustments: {
    id: "adjustments",
    kind: "revenue",
    label: "Ajustes",
    normalBalance: "credit",
  },
};

export const ACCOUNT_IDS = Object.keys(CHART) as AccountId[];
