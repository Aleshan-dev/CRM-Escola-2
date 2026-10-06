/**
 * Servidor de videochamada (Jitsi Meet, #2440) — resolução em runtime.
 *
 * Por que existe: o produto já liga para o contato (chamada de voz, spec 18),
 * mas não tem como ver a cara de quem atende. O Jitsi é a rota curta: sala por
 * URL, sem conta, sem instalação do lado do contato — o link chega pelo
 * WhatsApp e abre no navegador do celular.
 *
 * Por que a URL vem de `window.__PUBLIC_ENV__` e não de `NEXT_PUBLIC_*`: é a
 * mesma razão da marca e do DSN do Sentry (`lib/branding.ts`, `lib/sentry/dsn.ts`).
 * O self-hoster roda uma imagem PRÉ-BUILDADA; `NEXT_PUBLIC_*` é queimada no
 * `next build` e ele nunca conseguiria apontar para o próprio servidor. Ver o
 * cabeçalho de `app/public-env-script.tsx` — lá dentro está o bug de produção
 * que ensinou a regra.
 *
 * Vazio = a instalação não oferece videochamada. É esse "não tem" que o
 * botão do header lê para se esconder (padrão `WACALLS_API_BASE_URL`:
 * esconde, nunca erro).
 */

/** Valor da env já normalizado: `null` quando a instalação não oferece video. */
export function resolveServidorDeVideo(
  valor: string | undefined | null,
): string | null {
  const url = (valor ?? "").trim().replace(/\/+$/, "");
  if (url.length === 0) return null;
  return url;
}

/**
 * URL do servidor de videochamada para quem estiver rodando.
 *
 * No navegador lê `window.__PUBLIC_ENV__` (injetado em runtime); no servidor
 * cai em `process.env` — mesmo caminho de `branding()`. `process.env` inteiro
 * (não o acesso estático) para o Next não substituir o valor pelo do build.
 */
export function servidorDeVideo(): string | null {
  if (typeof window !== "undefined") {
    return resolveServidorDeVideo(window.__PUBLIC_ENV__?.JITSI_SERVER_URL);
  }
  return resolveServidorDeVideo(process.env.JITSI_SERVER_URL);
}

/**
 * Nome da sala: `deskcomm-<conversationId>`.
 *
 * O UUID da conversa é a sala. Ele já é não-avinhável e já existe — nada de
 * inventar um token a mais para armazenar. Consequência assumida e documentada
 * (`docs/features/videochamada.md`): quem tem o link entra, então o link é
 * tratado como dado sensível (mesma régua do link de reset de senha).
 */
export function salaDeVideo(conversationId: string): string {
  return `deskcomm-${conversationId}`;
}

/** URL completa da sala a partir do servidor configurado. */
export function urlDaSala(
  servidor: string | null,
  conversationId: string,
): string | null {
  if (!servidor) return null;
  return `${servidor}/${salaDeVideo(conversationId)}`;
}
