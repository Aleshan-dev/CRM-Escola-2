/**
 * Configurações → Automações (issue #2367).
 *
 * A PORTA do interruptor por empresa do passo `ai_decide`. O #2228 criou o
 * passo, opcional POR REGRA; o freio que desliga, de uma vez, todos os
 * `ai_decide` de uma organização ficou de fora por decisão do mantenedor — e
 * sem tela ele só existiria como `UPDATE` à mão no `organizations.settings`,
 * que é o anti-exemplo literal de "toda configuração tem superfície"
 * (`docs/doctrine/restricao-de-canal.md`).
 *
 * Gate = manager+, o mesmo da "Distribuição de atendimento": quem monta a
 * regra é quem decide se ela consulta o modelo.
 */
import { redirect } from "next/navigation";

import { requireAuth, resolveActiveOrg } from "@/lib/auth/server";
import { ROLE_RANK } from "@/lib/auth/types";
import { AI_DECIDE_PADRAO, CHAVE_DAS_AUTOMACOES } from "@/lib/automation/ai-decide-da-org";
import { traduzir } from "@/lib/i18n/dicionario";
import { createClient } from "@/lib/supabase/server";

import { InterruptorAiDecide } from "./_interruptor";

export const dynamic = "force-dynamic";

const DESCRICAO = "O freio único do passo em que a IA escolhe entre as opções de uma regra, para a empresa inteira.";

export default async function AutomacoesSettingsPage() {
  const user = await requireAuth();
  const activeOrg = await resolveActiveOrg(user);
  if (!activeOrg) redirect("/app");
  if (!(user.is_platform_admin && !user.support) && ROLE_RANK[activeOrg.role] < ROLE_RANK.manager) {
    redirect("/403");
  }

  const supabase = await createClient();
  const { data } = await supabase
    .from("organizations")
    .select("settings")
    .eq("id", activeOrg.orgId)
    .maybeSingle();

  const settings = (data?.settings ?? null) as Record<string, unknown> | null;
  const automacoes = (settings?.[CHAVE_DAS_AUTOMACOES] ?? null) as Record<string, unknown> | null;
  const bruto = automacoes?.ai_decide;
  // A mesma régua do leitor de runtime: só um `false` gravado desliga. Ausente
  // ou ilegível mostra LIGADO, que é o estado em que a tela abre para quem
  // nunca mexeu aqui — a tela não pode mentir sobre o que o motor vai fazer.
  const ligado = typeof bruto === "boolean" ? bruto : AI_DECIDE_PADRAO;
  const idioma = user.idioma;

  return (
    <div className="flex h-full flex-col gap-6 overflow-y-auto p-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">{traduzir("Automações", idioma)}</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">{traduzir(DESCRICAO, idioma)}</p>
      </header>

      <InterruptorAiDecide ligado={ligado} idioma={idioma} />
    </div>
  );
}
