/**
 * A consulta de CNPJ precisa MANDAR UM `User-Agent`.
 *
 * Não é preferência de estilo: a borda que serve a BrasilAPI responde **403** a
 * request sem esse cabeçalho, e o `fetch` do Node não manda um sozinho. Medido
 * contra o mesmo CNPJ, da mesma máquina e no mesmo minuto — 403 com apenas
 * `Accept`, 403 sem header nenhum, 200 com qualquer `User-Agent`.
 *
 * O sintoma que isso produzia na tela não dizia nada disso: "Não foi possível
 * consultar o CNPJ", o texto de reserva de `app/app/companies/_client.tsx`, mais
 * uma dica de que seria "bloqueio temporário". Quem a lesse esperaria — e nunca
 * ia funcionar, em instalação nenhuma.
 *
 * Por isso a asserção é sobre a EXISTÊNCIA e o não-vazio do cabeçalho, nunca
 * sobre o texto dele: trocar o valor é livre, apagá-lo quebra a funcionalidade
 * de novo e tem de reprovar aqui.
 */
import { describe, expect, it } from "vitest";

import { createBrasilApiClient } from "./client";

const CNPJ = "00000000000191";

/** Captura o `init` do fetch e devolve uma resposta mínima que o Zod aceita. */
function espiao() {
  const chamadas: Array<{ url: string; headers: Headers }> = [];
  const fetchFn = (async (url: string | URL | Request, init?: RequestInit) => {
    chamadas.push({ url: String(url), headers: new Headers(init?.headers) });
    return new Response(JSON.stringify({ cnpj: CNPJ, razao_social: "BANCO DO BRASIL SA" }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }) as unknown as typeof fetch;
  return { chamadas, fetchFn };
}

describe("cliente da BrasilAPI", () => {
  it("manda um User-Agent não-vazio — sem ele a BrasilAPI responde 403", async () => {
    const { chamadas, fetchFn } = espiao();

    const r = await createBrasilApiClient({ fetchFn }).lookupCnpj(CNPJ);

    expect(r.ok).toBe(true);
    expect(chamadas).toHaveLength(1);

    const ua = chamadas[0]!.headers.get("user-agent");
    expect(ua, "a BrasilAPI responde 403 quando o User-Agent está ausente").toBeTruthy();
    expect(ua!.trim().length).toBeGreaterThan(0);
  });

  /*
   * NÃO HÁ CASO AQUI PARA "o User-Agent não leva a marca", E É DE PROPÓSITO.
   *
   * O cabeçalho sai para um terceiro, e uma instalação de marca própria não
   * pode entregar o nome de quem a revende à BrasilAPI — mas quem já vigia isso
   * é `tests/unit/branding.test.ts`, que varre `lib/` inteiro atrás do nome do
   * produto e exige linha escrita em `MARCA_CONGELADA` para cada exceção. Ele
   * cobre `lib/brasil-api/client.ts` sem que ninguém precise lembrar.
   *
   * A primeira versão deste arquivo tinha o caso, e ele REPROVOU aquele gate: a
   * asserção `not.toContain("<marca>")` escrevia a marca no próprio teste, em
   * `lib/`. A cerca funcionou contra quem tentava reforçá-la — e a lição é que
   * o caso era redundante, não que o gate estava errado.
   */

  it("ainda distingue 404 de erro de upstream", async () => {
    // Controle de que o espião não está mascarando o tratamento de status: a
    // tela precisa separar "CNPJ não existe" de "não consegui consultar".
    const naoEncontrado = (async () =>
      new Response("", { status: 404 })) as unknown as typeof fetch;
    const recusado = (async () => new Response("", { status: 403 })) as unknown as typeof fetch;

    const a = await createBrasilApiClient({ fetchFn: naoEncontrado }).lookupCnpj(CNPJ);
    const b = await createBrasilApiClient({ fetchFn: recusado }).lookupCnpj(CNPJ);

    expect(a).toMatchObject({ ok: false, code: "not_found" });
    expect(b).toMatchObject({ ok: false, code: "upstream_error", status: 403 });
  });
});
