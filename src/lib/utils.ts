import { clsx, type ClassValue } from "clsx";

export function cn(...inputs: ClassValue[]): string {
  return clsx(inputs);
}

/** Energy with sensible precision, Brazilian formatting. */
export function formatKwh(kwh: number): string {
  return `${kwh.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} kWh`;
}

const DATETIME = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "America/Sao_Paulo",
});

const DATE = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "medium",
  timeZone: "America/Sao_Paulo",
});

export function formatDateTime(t: number): string {
  return DATETIME.format(new Date(t));
}

export function formatDate(t: number): string {
  return DATE.format(new Date(t));
}

export function clamp(value: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, value));
}
