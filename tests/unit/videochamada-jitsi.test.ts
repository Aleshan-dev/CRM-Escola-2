// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
  resolveServidorDeVideo,
  salaDeVideo,
  servidorDeVideo,
  urlDaSala,
} from "@/lib/video/jitsi";

/**
 * A VIDEOCHAMADA NASCE DESESLIGADA E NUNCA ERRA POR ISSO (#2440).
 *
 * Duas coisas aqui são contrato, não detalhe:
 *
 *  1. Vazio (o caso de TODA instalação que não configurou `JITSI_SERVER_URL`)
 *     devolve `null`, e é esse `null` que esconde o botão. Padrão de
 *     `WACALLS_API_BASE_URL`: esconde, nunca erro.
 *  2. Barra no fim é aparada — `.env` escrito à mão traz `https://meet.jit.si/`
 *     e a sala viraria `...si//deskcomm-...`, que é uma sala DIFERENTE no Jitsi
 *     (a parte depois do host muda o nome). Medido no processo de escrita deste
 *     teste, não deduzido.
 */
describe("servidor de videochamada (Jitsi)", () => {
  it("vazio, só espaço ou ausente = a instalação não oferece videochamada", () => {
    expect(resolveServidorDeVideo(undefined)).toBeNull();
    expect(resolveServidorDeVideo(null)).toBeNull();
    expect(resolveServidorDeVideo("")).toBeNull();
    expect(resolveServidorDeVideo("   ")).toBeNull();
    expect(resolveServidorDeVideo("   /  ")).toBeNull();
  });

  it("apara espaço e barra(s) do fim — uma sala só, não duas", () => {
    expect(resolveServidorDeVideo("  https://meet.jit.si ")).toBe(
      "https://meet.jit.si",
    );
    expect(resolveServidorDeVideo("https://meet.jit.si///")).toBe(
      "https://meet.jit.si",
    );
    expect(resolveServidorDeVideo("https://video.empresa.com.br/")).toBe(
      "https://video.empresa.com.br",
    );
  });

  it("mantém caminho interno (instalação com Jitsi atrás de subdiretório)", () => {
    expect(resolveServidorDeVideo("https://empresa.com/jitsi")).toBe(
      "https://empresa.com/jitsi",
    );
  });

  it("no servidor lê process.env, sem janela", () => {
    // Ambiente de teste não tem `window`; é o ramo do servidor que roda.
    const antes = process.env.JITSI_SERVER_URL;
    process.env.JITSI_SERVER_URL = "https://meet.jit.si/";
    expect(servidorDeVideo()).toBe("https://meet.jit.si");
    process.env.JITSI_SERVER_URL = "";
    expect(servidorDeVideo()).toBeNull();
    if (antes === undefined) delete process.env.JITSI_SERVER_URL;
    else process.env.JITSI_SERVER_URL = antes;
  });
});

describe("a sala é a própria conversa", () => {
  it("prefixa o UUID da conversa e não inventa mais nada", () => {
    const id = "3f1d2b7c-9a44-4e11-8f21-5b6c7d8e9f00";
    expect(salaDeVideo(id)).toBe(`deskcomm-${id}`);
    // Duas abas abrindo a MESMA conversa caem na mesma sala — é o que faz o
    // reenvio de link funcionar (o contato entra no que já está aberto).
    expect(salaDeVideo(id)).toBe(salaDeVideo(id));
  });

  it("URL completa só quando há servidor; sem servidor, nada de sala órfã", () => {
    const id = "3f1d2b7c-9a44-4e11-8f21-5b6c7d8e9f00";
    expect(urlDaSala("https://meet.jit.si", id)).toBe(
      `https://meet.jit.si/deskcomm-${id}`,
    );
    expect(urlDaSala(null, id)).toBeNull();
    expect(urlDaSala(resolveServidorDeVideo(""), id)).toBeNull();
  });

  it("conversas diferentes nunca dividem sala", () => {
    const a = urlDaSala("https://meet.jit.si", "aaaaaaaa-0000-0000-0000-000000000000");
    const b = urlDaSala("https://meet.jit.si", "bbbbbbbb-0000-0000-0000-000000000000");
    expect(a).not.toBe(b);
  });
});
