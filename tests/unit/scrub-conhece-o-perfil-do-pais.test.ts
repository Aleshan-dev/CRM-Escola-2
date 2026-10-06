// @vitest-environment node
/**
 * O SCRUB DA TELEMETRIA CONHECE O PERFIL DO PAÍS (#2418).
 *
 * O scrub (`lib/sentry/scrub.ts`) é o que o Sentry e o Jev usam; a máscara de
 * ingestão para a IA já conhecia o perfil desde o #2416 e este não. Medido na
 * main, com a ingestão já corrigida: o NIF com prefixo `PT123456789` saía
 * inteiro, o IBAN saía `PT50 [PHONE] [PHONE] 9015 4` (a cadeia de telefone
 * comia os blocos de 4 dígitos por dentro), o código postal `1000-001` não caía
 * e, no Brasil, `+55-11-98765-4321` saía inteiro enquanto `+55.11.98765.4321`
 * saía `+55.[PHONE]` — o separador depois do `55` era só espaço.
 *
 * Todos os resultados são EXATOS de propósito (a régua do #2416): um `toContain`
 * passaria com o dado pela metade apagado, que é justamente o defeito.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { scrubMessage } from "@/lib/sentry/scrub";

describe("scrub da telemetria com os padrões do perfil do país", () => {
  it("NIF português com prefixo sai inteiro — agora, apagado por inteiro", () => {
    expect(scrubMessage("nif PT123456789 ok")).toBe("nif [NIF] ok");
  });

  it("IBAN português sai inteiro — a cadeia de telefone não o parte mais", () => {
    expect(scrubMessage("pagamento PT50 0002 0123 1234 5678 9015 4 ok")).toBe(
      "pagamento [IBAN] ok",
    );
  });

  it("código postal português, com hífen e com espaço", () => {
    expect(scrubMessage("morada 1000-001 Lisboa")).toBe("morada [CODIGO_POSTAL] Lisboa");
    expect(scrubMessage("morada 1000 001 Lisboa")).toBe("morada [CODIGO_POSTAL] Lisboa");
  });

  it("celular brasileiro com hífen e com ponto depois do +55", () => {
    expect(scrubMessage("zap +55-11-98765-4321 ok")).toBe("zap [PHONE] ok");
    expect(scrubMessage("zap +55.11.98765.4321 ok")).toBe("zap [PHONE] ok");
    expect(scrubMessage("zap +55 (11) 98765-4321 ok")).toBe("zap [PHONE] ok");
  });

  // O perfil entra COMPLEMENTANDO a cadeia, não no lugar dela: o que já saía
  // apagado tem de sair no mesmo formato de antes, senão este fix trocaria um
  // vazamento por outra regressão (#2345, #2416).
  it("o que já saía apagado continua com o mesmo resultado exato de antes", () => {
    expect(scrubMessage("zap +55 11 98765-4321 ok")).toBe("zap [PHONE] ok");
    expect(scrubMessage("nif 123 456 789 ok")).toBe("nif [PHONE] ok");
    expect(scrubMessage("zap +351 912 345 678 ok")).toBe("zap [PHONE] ok");
    expect(scrubMessage("zap +351912345678 ok")).toBe("zap [PHONE] ok");
    expect(scrubMessage("doc 123.456.789-09 ok")).toBe("doc [CPF] ok");
    expect(scrubMessage("zap +49 30 12345678 ok")).toBe("zap [PHONE] ok");
    expect(scrubMessage("em 2026-09-23T18:46:39Z")).toBe("em 2026-09-23T18:46:39Z");

    // Efeito NOVO e declarado: o CEP brasileiro tambem e padrao do perfil, e
    // aplicar todos os perfis faz o scrub apaga-lo. Antes saia inteiro — e sair
    // apagado aqui e menos vazamento, nao mais.
    expect(scrubMessage("cep 01310-100 ok")).toBe("cep [CEP] ok");
  });

  // Sem esta linha o scrub poderia voltar a ter três regex copiadas de cabeça
  // e este teste continuaria verde — a mesma armadilha do #100 que o próprio
  // arquivo documenta.
  it("o scrub lê o registro de perfis, e não regex escrita à mão aqui", () => {
    const fonte = readFileSync(join(__dirname, "..", "..", "lib", "sentry", "scrub.ts"), "utf8");
    expect(fonte).toMatch(/from "@\/lib\/legal\/perfil-do-pais"/);
    expect(fonte).toMatch(/PERFIS_DO_PAIS/);
    expect(fonte).toMatch(/aplicarPadroesDoPerfil\(/);
  });
});
