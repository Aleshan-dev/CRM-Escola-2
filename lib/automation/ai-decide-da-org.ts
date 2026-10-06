/**
 * "ESTA ORG DEIXOU O PASSO `ai_decide` LIGADO?" — uma pergunta, um lugar (#2367).
 *
 * Mesmo desenho de `lib/ai/agents/org-tem-automatico.ts`: o fato é ORG-WIDE,
 * mora numa coluna que o banco responde sozinho (`organizations.settings`), e o
 * resultado entra na execução da ação. Aqui o leitor é um e o consumidor é um —
 * `lib/automation/actions/ai-decide.ts` —, mas o arquivo existe pelo mesmo
 * motivo: sem ele a chave espalhava leitura de jsonb por mais de um lugar e o
 * default passava a ser opinião de quem escrevesse cada linha.
 *
 * ─── O default ──────────────────────────────────────────────────────────────
 *
 * **LIGADO.** O #2228 publicou o passo e as regras gravadas depois dele decidem
 * sem ninguém precisar ligar nada; desligar a empresa inteira por omissão
 * seria quebrar regra que já existe (critério 4 da issue).
 *
 * **`undefined` = não deu para saber**, e quem chama trata como LIGADO. Dizer
 * "esta empresa tem o passo desligado" por causa de um erro de leitura faria
 * toda regra parar no primeiro empecilho de rede — a mentira cara, ao contrário.
 * `aiDecideLigado` só devolve `false` para um `false` gravado.
 *
 * **Nunca lança.** Mesma regra das leituras de estado de
 * `lib/recursos-opcionais/estado.ts`: uma fonte que falha (cliente sem
 * `from`, rede, permissão) vira `undefined`, não exceção no meio da execução
 * da regra.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import { logger } from "@/lib/logger";

/** Chave de `organizations.settings` — um namespace por assunto, como `conversions`. */
export const CHAVE_DAS_AUTOMACOES = "automacoes";

/** O padrão escrito (issue #2367): ligado, para não quebrar regra já gravada. */
export const AI_DECIDE_PADRAO = true;

export async function aiDecideLigado(
  supabase: SupabaseClient,
  organizationId: string,
): Promise<boolean | undefined> {
  try {
    const { data, error } = await supabase
      .from("organizations")
      .select("settings")
      .eq("id", organizationId)
      .maybeSingle();

    if (error) return undefined;

    const settings = (data as { settings?: unknown } | null)?.settings;
    if (!settings || typeof settings !== "object" || Array.isArray(settings)) return AI_DECIDE_PADRAO;
    const automacoes = (settings as Record<string, unknown>)[CHAVE_DAS_AUTOMACOES];
    if (!automacoes || typeof automacoes !== "object" || Array.isArray(automacoes)) return AI_DECIDE_PADRAO;
    const bruto = (automacoes as Record<string, unknown>).ai_decide;
    // Ausente, `null` ou lixo vindo de SQL/import: LIGADO. O interruptor desliga
    // quando o operador DESLIGA — nunca por omissão nem por valor ilegível.
    return typeof bruto === "boolean" ? bruto : AI_DECIDE_PADRAO;
  } catch (erro) {
    logger.warn("ai_decide: não deu para ler o interruptor da empresa — segue ligado", {
      organizationId,
      detalhe: erro instanceof Error ? erro.message : String(erro),
    });
    return undefined;
  }
}
