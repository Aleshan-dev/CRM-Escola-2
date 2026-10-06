"use client";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useSendMessage } from "@/hooks/inbox/useSendMessage";
import { useT } from "@/hooks/i18n/useT";
import { VideoCamera } from "@/lib/ui/icons";
import { salaDeVideo, servidorDeVideo, urlDaSala } from "@/lib/video/jitsi";

interface Props {
  /** A conversa que vira a sala: `deskcomm-<conversationId>`. */
  conversationId: string;
}

/**
 * Botão "Vídeo" do header da conversa (#2440) — videochamada por Jitsi Meet.
 *
 * A feature é OPT-IN: sem `JITSI_SERVER_URL` no `.env`, `servidorDeVideo()`
 * devolve `null` e este componente NÃO RENDERIZA (padrão `DialButton` para a
 * voz: esconde, nunca erro).
 *
 * Duas saídas da sala, e as duas são propositalmente o mesmo link:
 *
 *  - **Copiar link** — para quem vai colar em outro lugar (e-mail, outro chat).
 *  - **Enviar link na conversa** — o caminho normal: o link chega pelo
 *    WhatsApp do contato e ele entra pelo celular. Passa por `useSendMessage`,
 *    então herda janela fechada, suporte somente leitura e conversa
 *    encerrada — as mesmas travas de qualquer mensagem.
 *
 * O iframe leva `allow` de câmera/microfone/tela cheia: sem ele o navegador
 * nega o pedido de mídia do Jitsi e a sala abre muda e às cegas.
 */
export function VideoCallButton({ conversationId }: Props) {
  const t = useT();
  const servidor = useMemo(() => servidorDeVideo(), []);
  const [aberto, setAberto] = useState(false);
  const enviar = useSendMessage();

  const url = urlDaSala(servidor, conversationId);

  const copiar = useCallback(async () => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      toast.success(t("Link da videochamada copiado."));
    } catch {
      toast.error(t("Não consegui copiar o link. Selecione e copie da barra de endereço."));
    }
  }, [url, t]);

  const enviarLink = useCallback(() => {
    if (!url) return;
    enviar.mutate(
      { conversation_id: conversationId, body: url },
      {
        onSuccess: () => {
          toast.success(t("Link da videochamada enviado na conversa."));
          setAberto(false);
        },
        onError: () => {
          // O erro detalhado já vem do showApiError; aqui só o convite a
          // copiar o link, que é a saída que não depende do canal.
          toast.error(t("Não consegui enviar o link. Copie e cole na conversa."));
        },
      },
    );
  }, [url, conversationId, enviar, t]);

  if (!url) return null;

  return (
    <>
      <Button
        variant="outline"
        className="shrink-0"
        onClick={() => setAberto(true)}
        data-testid="btn-videochamada"
      >
        <VideoCamera size={16} weight="bold" aria-hidden />
        <span>{t("Vídeo")}</span>
      </Button>

      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent className="flex max-h-[90vh] max-w-3xl flex-col gap-4">
          <DialogHeader>
            <DialogTitle>{t("Videochamada")}</DialogTitle>
            <DialogDescription>
              {t(
                "A sala é esta conversa: envie o link pelo chat e o contato entra pelo celular, sem instalar nada.",
              )}
            </DialogDescription>
          </DialogHeader>

          <iframe
            title={t("Sala de videochamada")}
            src={url}
            allow="camera; microphone; display-capture; fullscreen; picture-in-picture"
            className="h-[60vh] w-full rounded-md border"
            data-testid="iframe-videochamada"
          />

          <DialogFooter className="gap-2 sm:justify-between">
            <Button variant="ghost" onClick={() => setAberto(false)}>
              {t("Fechar")}
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={copiar} data-testid="btn-copiar-link-video">
                {t("Copiar link")}
              </Button>
              <Button
                onClick={enviarLink}
                disabled={enviar.isPending}
                data-testid="btn-enviar-link-video"
              >
                {enviar.isPending ? t("Enviando…") : t("Enviar link na conversa")}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
