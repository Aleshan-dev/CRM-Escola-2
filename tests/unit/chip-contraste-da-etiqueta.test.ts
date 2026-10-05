/**
 * O CHIP DA ETIQUETA SOB A RÉGUA — o piso de TEXTO recalculado tom a tom e o
 * caminho ÚNICO de render (issue #2373: "fundo escuro com texto preto").
 *
 * ─── Por que este arquivo, já existindo `tags-cor-de-etiqueta.test.ts` ───────
 *
 * O irmão mede a PALETA contra a régua chamando a régua na mão
 * (`melhorFrenteSobre(tom)`). Medir a régua não prova o CHIP: sabotar o chip
 * (frente `#ffffff` fixa, texto herdando `text-text-muted`) deixa o irmão
 * inteiro verde e a tela continua ilegível — é o defeito que a issue descreve,
 * e ele vive no caminho de render, não na função. Aqui a frente sai de
 * `estiloDoChip`, é a mesma que `escolheAFrente` escolheria, e cada tom reprova
 * COM O PRÓPRIO NOME na mensagem.
 *
 * Três coisas que só este arquivo segura:
 *
 *  1. **O piso vale para QUALQUER cor gravada, não só para a paleta.**
 *     `organizations.settings.tags` é JSON editável à mão e a borda aceita
 *     qualquer `#rrggbb` de propósito ("a pertinência à paleta não é validada
 *     em lugar nenhum"). Quem tem cor fora da paleta — inclusive a da
 *     captura da #2373, medida pixel a pixel — precisa do mesmo piso.
 *  2. **O caminho único de render.** O chip aparece em oito arquivos; se um
 *     nono passar `style=` ao chip, ou pintar a cor da etiqueta fora de
 *     `estiloDoChip`, a frente volta a ser escolhida por alguém que não é a
 *     régua. O levantamento está LISTADO aqui de propósito: é ele que a issue
 *     pede ("levantar todos os pontos de render"), e um ponto novo reprova
 *     até que o levantamento seja atualizado.
 *  3. **O pior par é recalculado**, não lido do comentário da paleta: a olho nu
 *     (OKLab cru) e sob dicromacia, com o PAR NOMEADO quando reprova.
 *
 * Os tons saem com nome lido do `NOME_DO_TOM` do painel (texto, não import:
 * teste de lib não importa `@/app`), para que a falha diga "Âmbar" e não só
 * `#ffb224`.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  PISO_DE_SEPARACAO_SIMULADA,
  PISOS,
  deltaESimulado,
  escolheAFrente,
  razaoDeContraste,
} from "@/lib/branding/contraste";
import { deltaEOklab } from "@/lib/branding/rampa";
import { PALETA_DE_ETIQUETAS, estiloDoChip } from "@/lib/tags/cor-da-etiqueta";

const raiz = process.cwd();
/** O piso a olho nu, o dobro do de dicromacia — a mesma proporção do design system. */
const PISO_A_OLHO_NU = 0.1;

/**
 * Os cinco tons da captura da #2373, medidos no PNG (`user-attachments/
 * 4e3cf3b5…`): NÃO são os da paleta (a organização tem cor gravada fora dela,
 * que é o caso de uso que a borda aceita de propósito), e é sobre elas que o
 * autor da issue vê o defeito. Toda cor da captura passa hoje — este teste
 * transforma "passa" em contrato.
 */
const CORES_DA_CAPTURA_DA_ISSUE = ["#4b60d8", "#6f6f6f", "#1aa494", "#fcb540", "#e35537"];

/** `NOME_DO_TOM` lido como TEXTO do painel — teste de lib não importa `@/app`. */
function nomesDosTons(): Record<string, string> {
  const painel = readFileSync(join(raiz, "app/app/settings/tags/_painel.tsx"), "utf8");
  const bloco = painel.slice(painel.indexOf("const NOME_DO_TOM"));
  const mapa = bloco.slice(0, bloco.indexOf("};"));
  const saida: Record<string, string> = {};
  for (const m of mapa.matchAll(/"(#[0-9a-f]{6})":\s*"([^"]+)"/g)) saida[m[1]!] = m[2]!;
  return saida;
}

function arquivosDe(pasta: string, extensao: string): string[] {
  const saida: string[] = [];
  for (const entrada of readdirSync(pasta, { withFileTypes: true })) {
    if (entrada.name === "node_modules") continue;
    const caminho = join(pasta, entrada.name);
    if (entrada.isDirectory()) saida.push(...arquivosDe(caminho, extensao));
    else if (entrada.name.endsWith(extensao)) saida.push(caminho);
  }
  return saida;
}

/** Todo `.tsx` da UI, com o caminho relativo à raiz do repo. */
function arquivosDaUi(): string[] {
  return [...arquivosDe(join(raiz, "app"), ".tsx"), ...arquivosDe(join(raiz, "components"), ".tsx")].map(
    (c) => c.slice(raiz.length + 1),
  );
}

/** Varredura determinística de sRGB em passo 32 (9³ = 729 cores). */
function varreduraDeSrgb(): string[] {
  const passos = [0, 32, 64, 96, 128, 160, 192, 224, 255];
  const hex = (n: number) => n.toString(16).padStart(2, "0");
  const saida: string[] = [];
  for (const r of passos) for (const g of passos) for (const b of passos) saida.push(`#${hex(r)}${hex(g)}${hex(b)}`);
  return saida;
}

describe("a frente do texto do chip (issue #2373)", () => {
  it("⭐ cada tom tem NOME, e a frente do chip sai da régua com contraste >= 4,5", () => {
    const nomes = nomesDosTons();
    // Nome ausente = círculo mudo na fileira E falha sem nome na mensagem.
    expect(Object.keys(nomes).sort(), "NOME_DO_TOM saiu da paleta").toEqual([...PALETA_DE_ETIQUETAS].sort());

    // Acumula em vez de parar na primeira reprovação: a sabotagem precisa
    // contar TODOS os tons ruins de uma vez, pelo nome, não só o primeiro.
    const forasDoPiso: string[] = [];
    for (const tom of PALETA_DE_ETIQUETAS) {
      const nome = nomes[tom] ?? tom;
      const estilo = estiloDoChip(tom);
      const frente = estilo?.color;
      if (frente !== escolheAFrente(tom)) {
        forasDoPiso.push(`${nome} (${tom}): frente ${frente ?? "ausente"} não é a da régua (${escolheAFrente(tom)})`);
        continue;
      }
      const razao = razaoDeContraste(frente, tom);
      if (razao < PISOS.texto) {
        forasDoPiso.push(`${nome} (${tom}): frente ${frente} dá contraste ${razao.toFixed(3)}, abaixo do piso ${PISOS.texto}`);
      }
    }
    expect(forasDoPiso, `tons fora do piso (${forasDoPiso.length}): ${forasDoPiso.join(" | ")}`).toEqual([]);
  });

  it("⭐ verde e vermelha passam obrigatoriamente — os dois tons da reprodução", () => {
    const nomes = nomesDosTons();
    const daReproducao = PALETA_DE_ETIQUETAS.filter(
      (tom) => /^verde/i.test(nomes[tom] ?? "") || /^vermelh/i.test(nomes[tom] ?? ""),
    );
    expect(daReproducao.length, "paleta sem tom verde/vermelho — a reprodução da issue não existe mais").toBeGreaterThanOrEqual(2);

    const fora: string[] = [];
    for (const tom of daReproducao) {
      const nome = nomes[tom]!;
      const frente = estiloDoChip(tom)!.color!;
      const razao = razaoDeContraste(frente, tom);
      if (razao < PISOS.texto) {
        fora.push(`${nome} (${tom}): frente ${frente} dá contraste ${razao.toFixed(3)}, abaixo do piso ${PISOS.texto}`);
      }
    }
    expect(fora, `verde/vermelha fora do piso (${fora.length}): ${fora.join(" | ")}`).toEqual([]);
  });

  it("⭐ QUALQUER cor gravada também passa — o piso não é privilégio da paleta", () => {
    // A paleta é só a fileira da tela: o que está em `settings.tags` pode ser
    // qualquer hex, e é exatamente o caso da captura da issue. A amostra passa
    // pelo CHIP (não pela régua na mão) — sabotar o chip tem que reprovar aqui.
    const amostras = [...CORES_DA_CAPTURA_DA_ISSUE, ...varreduraDeSrgb()];
    const fora: string[] = [];
    let pior = Infinity;
    let piorCor = "";
    for (const cor of amostras) {
      const frente = estiloDoChip(cor)?.color;
      if (!frente) {
        fora.push(`${cor}: o chip não pintou frente`);
        continue;
      }
      const razao = razaoDeContraste(frente, cor);
      if (razao < pior) {
        pior = razao;
        piorCor = cor;
      }
      if (razao < PISOS.texto) fora.push(`${cor}: frente ${frente} dá contraste ${razao.toFixed(3)}`);
    }
    expect(
      fora,
      `${fora.length} de ${amostras.length} cores gravadas fora do piso (pior: ${piorCor} a ${pior.toFixed(3)}): ${fora.slice(0, 8).join(" | ")}`,
    ).toEqual([]);
    // O piso teórico de `max(branco, preto)`: 4,582671 em L = 0,17912.
    expect(pior, "o piso caiu abaixo do mínimo teórico — `escolheAFrente` deixou de escolher o melhor par").toBeGreaterThanOrEqual(4.58);
  });

  it("⭐ o pior par da paleta continua separável — recalculado, a olho nu E sob dicromacia", () => {
    let piorNormal = Infinity;
    let piorDicromacia = Infinity;
    let parNormal: [string, string] = ["", ""];
    let parDicromacia: [string, string] = ["", ""];
    for (let i = 0; i < PALETA_DE_ETIQUETAS.length; i++) {
      for (let j = i + 1; j < PALETA_DE_ETIQUETAS.length; j++) {
        const a = PALETA_DE_ETIQUETAS[i]!;
        const b = PALETA_DE_ETIQUETAS[j]!;
        const normal = deltaEOklab(a, b);
        const dicromacia = deltaESimulado(a, b);
        if (normal < piorNormal) {
          piorNormal = normal;
          parNormal = [a, b];
        }
        if (dicromacia < piorDicromacia) {
          piorDicromacia = dicromacia;
          parDicromacia = [a, b];
        }
      }
    }
    expect(
      piorNormal,
      `pior par a olho nu: ${parNormal[0]} × ${parNormal[1]} = ${piorNormal.toFixed(4)} (< ${PISO_A_OLHO_NU})`,
    ).toBeGreaterThanOrEqual(PISO_A_OLHO_NU);
    expect(
      piorDicromacia,
      `pior par sob dicromacia: ${parDicromacia[0]} × ${parDicromacia[1]} = ${piorDicromacia.toFixed(4)} (< ${PISO_DE_SEPARACAO_SIMULADA})`,
    ).toBeGreaterThanOrEqual(PISO_DE_SEPARACAO_SIMULADA);
  });
});

describe("o caminho único de render do chip", () => {
  /**
   * O LEVANTAMENTO PEDIDO PELA ISSUE. Oito arquivos, dez usos — todos pelo
   * componente; nenhum pinta cor sozinho. Somar aqui é legítimo (a tela nova
   * usa o chip), mas é decisão revisável: o teste falha até alguém ler o
   * caminho novo e declarar.
   */
  const LEVANTAMENTO = [
    "app/app/contacts/[id]/_client.tsx",
    "app/app/settings/tags/_painel.tsx",
    "components/contacts/ContactsTable.tsx",
    "components/inbox/CRMSidePanel.tsx",
    "components/inbox/ContactTagsEditor.tsx",
    "components/inbox/ConversationListItem.tsx",
    "components/inbox/ConversationTagsEditor.tsx",
    "components/inbox/InboxFilters.tsx",
  ].sort();

  it("todo render do chip é este levantamento — e nenhum passa `style` ao chip", () => {
    const comChip: string[] = [];
    for (const arquivo of arquivosDaUi()) {
      const texto = readFileSync(join(raiz, arquivo), "utf8");
      if (!texto.includes("<ChipDeEtiqueta")) continue;
      comChip.push(arquivo);
      // `<ChipDeEtiqueta ... >` com estilo próprio sobrescreveria a frente que a
      // régua calculou — é o defeito da #2373 pela porta dos fundos.
      for (const uso of texto.match(/<ChipDeEtiqueta[^>]*>/g) ?? []) {
        expect(uso, `${arquivo} passou estilo ao chip: a frente vem da régua, não de quem o usa`).not.toContain(
          "style=",
        );
        expect(uso, `${arquivo} apagou a frente com uma classe de cor`).not.toMatch(/\btext-(black|white|foreground|muted)/);
      }
    }
    expect(comChip.sort(), "o levantamento dos pontos de render mudou (issue #2373)").toEqual(LEVANTAMENTO);
  });

  it("`estiloDoChip` é importado só pelo chip — ninguém mais pinta cor de etiqueta", () => {
    const importadores: string[] = [];
    for (const arquivo of arquivosDaUi()) {
      const texto = readFileSync(join(raiz, arquivo), "utf8");
      if (texto.includes("estiloDoChip")) importadores.push(arquivo);
    }
    expect(importadores.sort()).toEqual(["components/tags/ChipDeEtiqueta.tsx"]);
  });
});
