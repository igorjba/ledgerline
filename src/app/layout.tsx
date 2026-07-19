import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Ledgerline — Motor de Faturamento de Energia Bitemporal",
    template: "%s · Ledgerline",
  },
  description:
    "Um motor de faturamento de energia bitemporal: ingestão idempotente de leituras, tarifa versionada, um livro-razão de partida dobrada que sempre soma zero, e um histórico que o banco impõe — reproduza qualquer fatura passada como ela era em qualquer data.",
  applicationName: "Ledgerline",
  authors: [{ name: "Igor" }],
  keywords: [
    "faturamento",
    "bitemporal",
    "partida dobrada",
    "energia",
    "ANEEL",
    "idempotencia",
    "outbox transacional",
    "teste de propriedade",
  ],
  openGraph: {
    title: "Ledgerline — Motor de Faturamento de Energia Bitemporal",
    description:
      "Ingira leituras fora de ordem, versione a tarifa, lance num livro-razão de partida dobrada, e reproduza qualquer fatura como ela era em qualquer data passada — com o histórico bitemporal imposto pelo banco.",
    type: "website",
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: "#08090c",
  colorScheme: "dark",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" className={`${GeistSans.variable} ${GeistMono.variable}`} suppressHydrationWarning>
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
