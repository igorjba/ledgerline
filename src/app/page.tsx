import { Clock, Database, Layers, Radio, Scale, Sigma } from "lucide-react";
import { Console } from "@/components/console/Console";
import { Panel } from "@/components/ui/Panel";

export default function Home() {
  return (
    <main className="mx-auto flex max-w-[1400px] flex-col gap-10 px-4 py-8 md:px-8 md:py-12">
      <Hero />
      <Console />
      <Pillars />
      <Proof />
      <Footer />
    </main>
  );
}

function Hero() {
  return (
    <header className="flex flex-col gap-5">
      <div className="flex items-center gap-2 font-mono text-[0.7rem] uppercase tracking-[0.2em] text-ink-faint">
        <span className="h-1.5 w-1.5 rounded-full bg-amber" aria-hidden />
        motor de faturamento de energia bitemporal
      </div>
      <h1 className="max-w-3xl text-balance text-3xl font-semibold leading-tight tracking-tight md:text-5xl">
        Ele cobra pela leitura que um medidor produz —{" "}
        <span className="text-amber">com exatidão e reprodutibilidade, mesmo com dado sujo.</span>
      </h1>
      <p className="max-w-2xl text-pretty text-[0.95rem] leading-relaxed text-ink-dim md:text-base">
        O Ledgerline recebe as leituras do medidor sem se importar com a ordem ou com repetições, calcula o preço por uma
        tarifa ANEEL versionada (posto de horário, bandeira, feriado), lança tudo num livro-razão de partida dobrada que
        sempre soma zero, e guarda um histórico bitemporal que o próprio banco de dados garante — de modo que qualquer
        conta antiga pode ser reproduzida exatamente como era conhecida em qualquer data, e uma mudança retroativa gera
        uma nota de ajuste em vez de reescrever a conta original.
      </p>
      <div className="flex flex-wrap gap-2 font-mono text-[0.7rem] text-ink-faint">
        {["Next 16", "TypeScript", "Postgres · EXCLUDE gist", "Outbox transacional · QStash", "fast-check", "Vercel"].map(
          (tag) => (
            <span key={tag} className="rounded-md border border-edge bg-panel px-2 py-1">
              {tag}
            </span>
          ),
        )}
      </div>
      <blockquote className="max-w-2xl border-l-2 border-amber/40 pl-3 text-[0.9rem] italic text-ink-dim">
        Provar com um número, não afirmar. A invariante de soma-zero do livro é verificada por propriedade, sobre
        milhares de sequências embaralhadas — na integração contínua e, abaixo, ao vivo no seu navegador.
      </blockquote>
      <p className="max-w-2xl rounded-lg border border-edge/60 bg-panel/50 px-3.5 py-2.5 text-[0.8rem] leading-relaxed text-ink-dim">
        <span className="text-ink">Em termos simples:</span> é o sistema que transforma o consumo medido em uma conta de
        luz correta — e que, se algo for corrigido depois, sabe recontar a história sem apagar o que já havia registrado.
        Tudo o que está no console abaixo é interativo: mexa à vontade.
      </p>
    </header>
  );
}

const PILLARS = [
  {
    icon: <Clock size={16} />,
    title: "Bitemporal, imposto pelo banco",
    body: "Dois tempos para cada fato: quando o consumo aconteceu e quando o sistema ficou sabendo dele. Isso permite reconstruir qualquer conta como ela era numa data passada. No Postgres, uma restrição de exclusão (EXCLUDE gist) sobre intervalos de tempo torna impossível haver duas versões conflitantes — a garantia é o próprio banco, não uma linha de código.",
  },
  {
    icon: <Layers size={16} />,
    title: "Tarifa versionada — a regra é dado",
    body: "Posto de horário (ponta/intermediário/fora-ponta), bandeira (verde/amarela/vermelha) e feriados móveis calculados a partir da Páscoa são dados versionados, não condicionais no código. Mudar a tarifa de um mês já faturado não altera a conta antiga: emite uma nota de ajuste com a diferença. A original é imutável.",
  },
  {
    icon: <Scale size={16} />,
    title: "Livro-razão de partida dobrada, soma zero",
    body: "Todo valor entra em duas contas ao mesmo tempo (débito e crédito), em centavos inteiros. A soma tem de dar sempre zero — e uma transação desequilibrada é impossível de existir: o construtor a recusa. Somar inteiros é exato e independente da ordem, e é isso que torna a convergência um teorema, não uma esperança.",
  },
  {
    icon: <Radio size={16} />,
    title: "Outbox transacional",
    body: "Cada mudança grava seu evento na mesma transação do dado; depois, um processo o envia adiante (para o QStash), com o cron diário da Vercel como rede de segurança. Uma função sem servidor pode morrer entre gravar e enviar, e ainda assim nenhum evento se perde.",
  },
];

function Pillars() {
  return (
    <section className="flex flex-col gap-4">
      <SectionHeading>As quatro partes difíceis</SectionHeading>
      <div className="grid gap-3 md:grid-cols-2">
        {PILLARS.map((p) => (
          <Panel key={p.title} title={p.title} icon={p.icon} bodyClassName="p-4">
            <p className="text-[0.85rem] leading-relaxed text-ink-dim">{p.body}</p>
          </Panel>
        ))}
      </div>
    </section>
  );
}

function Proof() {
  return (
    <section className="flex flex-col gap-4">
      <SectionHeading>Como é provado, não afirmado</SectionHeading>
      <div className="grid gap-3 md:grid-cols-3">
        <ProofCard icon={<Sigma size={16} />} title="Testes de propriedade">
          O fast-check gera milhares de sequências fora de ordem, duplicadas e corrigidas, e prova a convergência, a
          idempotência e a invariante de soma-zero — a mesma bateria que o console roda ao vivo.
        </ProofCard>
        <ProofCard icon={<Database size={16} />} title="O banco impõe a regra">
          Uma suíte de integração aplica a migração real a um Postgres e prova que a restrição EXCLUDE gist rejeita uma
          versão bitemporal sobreposta — quem sustenta a regra é o banco, não a aplicação.
        </ProofCard>
        <ProofCard icon={<Clock size={16} />} title="Núcleo determinístico">
          O motor é uma função pura das suas entradas — sem relógio nem sorteio lido por dentro. Repetir os mesmos
          comandos produz um estado idêntico, e é isso que torna tudo acima reproduzível.
        </ProofCard>
      </div>
    </section>
  );
}

function ProofCard({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <Panel title={title} icon={icon} bodyClassName="p-4">
      <p className="text-[0.85rem] leading-relaxed text-ink-dim">{children}</p>
    </Panel>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return <h2 className="text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-ink-faint">{children}</h2>;
}

function Footer() {
  return (
    <footer className="flex flex-col gap-1 border-t border-edge/60 pt-6 text-[0.72rem] text-ink-faint">
      <p>
        A demonstração acima roda o motor de faturamento inteiro no seu navegador. Com uma DATABASE_URL e um token do
        QStash configurados, o mesmo código roda no Neon e no Upstash — o histórico de leituras e o outbox passam para o
        Postgres, sem mudar uma linha.
      </p>
      <p className="font-mono">Ledgerline · © 2026 Igor Bahia · América/São_Paulo (BRT, UTC−3)</p>
    </footer>
  );
}
