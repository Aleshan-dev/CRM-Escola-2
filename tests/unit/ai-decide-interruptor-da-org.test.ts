/**
 * O interruptor POR EMPRESA do `ai_decide` (#2367) — o freio que o #2228 não
 * trouxe, por decisão do mantenedor.
 *
 * Três provas, na ordem dos critérios de pronto da issue:
 *
 *  1. DESLIGADO: a regra NÃO consulta o modelo — o spy de `decidirAcao` fica em
 *     ZERO chamadas — e o run grava o motivo, com FRASE na aba Atividade (a
 *     frase é lida do próprio mapa da tela, não de memória).
 *  2. LIGADO (controle positivo): o modelo É consultado. Sem este caso, um
 *     teste que só afirma "não chamou" passaria para qualquer defeito que
 *     impedisse a chamada — inclusive a falha de leitura que o leitor
 *     converte em "segue ligado".
 *  3. PADRÃO: sem a chave gravada, LIGADO — é o estado de uma empresa que
 *     nunca mexeu no interruptor depois do #2228 (critério 4).
 *
 * A chamada de modelo é mockada (`decisao-de-acao`), mesmo desenho do irmão
 * `lib/automation/actions/ai-decide.test.ts`: o que se testa aqui é o
 * CONTRATO do freio, não a conversa com o provedor.
 */
import { join } from "node:path";

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/agent-engine/agent/decisao-de-acao", () => ({ decidirAcao: vi.fn() }));

import { getAction } from "@/lib/automation/actions";
import type { ActionCtx } from "@/lib/automation/types";
import { decidirAcao } from "@/lib/agent-engine/agent/decisao-de-acao";
import { DICIONARIO } from "@/lib/i18n/dicionario";

import "@/lib/automation/actions/ai-decide";

import { lerMapaDeMotivos } from "./helpers/motivos-de-parada";

const decidir = vi.mocked(decidirAcao);

const ORG = "11111111-1111-4111-8111-111111111111";
const REGRA = "22222222-2222-4222-8222-222222222222";
const MOTIVO = "ai_decide_desligado_na_empresa";

const CONFIG = {
  custo_de_token: true,
  instrucao: "Se demonstrou interesse em parcelamento, marque como quente.",
  opcoes: [
    {
      id: "quente",
      rotulo: "Marcar como quente",
      acao: { type: "add_tag", config: { tags: ["quente"] } },
    },
    {
      id: "retorno",
      rotulo: "Criar tarefa de retorno",
      acao: { type: "add_tag", config: { tags: ["retorno"] } },
    },
  ],
};

/**
 * O client só precisa da leitura que o freio faz:
 * `from("organizations").select("settings").eq(...).maybeSingle()`.
 */
function adminComSettings(settings: unknown): ActionCtx["admin"] {
  return {
    from(table: string) {
      const b: Record<string, unknown> = {};
      b.select = () => b;
      b.eq = () => b;
      b.maybeSingle = async () =>
        table === "organizations"
          ? { data: settings === undefined ? null : { settings }, error: null }
          : { data: null, error: null };
      return b;
    },
  } as unknown as ActionCtx["admin"];
}

function ctx(admin: ActionCtx["admin"]): ActionCtx {
  return {
    admin,
    organizationId: ORG,
    ruleId: REGRA,
    ruleName: "Regra de teste",
    requestId: "evt-1",
    event: {
      id: "evt-1",
      organization_id: ORG,
      event_type: "message.received",
      entity_kind: "crm_lead",
      entity_id: "33333333-3333-4333-8333-333333333333",
      payload: {},
      metadata: {},
      consumed_by: [],
      attempts: 0,
    },
    context: {},
  } as ActionCtx;
}

const executor = () => getAction("ai_decide")!;

/** O settings de uma empresa que DESLIGOU o freio. */
const SETTINGS_DESLIGADO = { automacoes: { ai_decide: false } };

beforeEach(() => {
  decidir.mockReset();
  // Se o freio falhar e a chamada acontecer, é isto que o teste precisa ver.
  decidir.mockResolvedValue({ ok: false, motivo: "resposta_vazia" });
});

describe("interruptor da empresa DESLIGADO: o modelo não é consultado", () => {
  it("não chama o modelo nenhuma vez e o run grava o motivo do freio", async () => {
    const resultado = await executor().execute(
      ctx(adminComSettings(SETTINGS_DESLIGADO)),
      structuredClone(CONFIG),
    );

    expect(
      decidir,
      "o modelo foi consultado com o interruptor da empresa desligado",
    ).not.toHaveBeenCalled();
    expect(resultado).toEqual({
      type: "ai_decide",
      status: "skipped",
      detail: { reason: MOTIVO },
    });
  });

  it("o motivo tem FRASE na aba Atividade e essa frase tem espanhol", () => {
    const mapa = lerMapaDeMotivos(
      join(__dirname, "..", ".."),
      "app/app/webhooks/_components/ActivityTab.tsx",
    );
    const frase = mapa.get(MOTIVO);
    expect(frase, `o motivo ${MOTIVO} não tem frase no mapa MOTIVO_DA_PARADA`).toBeTruthy();
    expect(frase!.trim().length, "frase curta demais: a tela mostraria nada").toBeGreaterThan(10);
    expect(
      DICIONARIO[frase!]?.es,
      "a frase da aba Atividade não tem coluna es no dicionário",
    ).toBeTruthy();
  });
});

describe("interruptor da empresa LIGADO (controle positivo)", () => {
  it("chama o modelo — sem este caso, o vermelho de cima não provaria nada", async () => {
    const resultado = await executor().execute(
      ctx(adminComSettings({ automacoes: { ai_decide: true } })),
      structuredClone(CONFIG),
    );

    expect(decidir, "com o interruptor ligado o modelo tem de ser consultado").toHaveBeenCalledTimes(1);
    // O mock devolveu resposta inválida de propósito: nada além da chamada é
    // medido aqui, e a ação-alvo não roda sem escolha.
    expect(resultado.status).toBe("failed");
    expect(resultado.detail).toEqual({ reason: "resposta_vazia" });
  });

  it("sem a chave gravada, o padrão é LIGADO — regra do #2228 segue decidindo", async () => {
    await executor().execute(ctx(adminComSettings({})), structuredClone(CONFIG));

    expect(decidir, "settings sem a chave tem de manter o padrão ligado").toHaveBeenCalledTimes(1);
  });

  it("falha de leitura não desliga: segue consultando o modelo", async () => {
    const comErro = {
      from() {
        const b: Record<string, unknown> = {};
        b.select = () => b;
        b.eq = () => b;
        b.maybeSingle = async () => ({ data: null, error: { message: "rede" } });
        return b;
      },
    } as unknown as ActionCtx["admin"];

    await executor().execute(ctx(comErro), structuredClone(CONFIG));

    expect(
      decidir,
      "erro de leitura não pode virar freio — o default é ligado",
    ).toHaveBeenCalledTimes(1);
  });
});
