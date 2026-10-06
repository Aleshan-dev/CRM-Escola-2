import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { VideoCallButton } from "@/components/inbox/VideoCallButton";

/**
 * O BOTÃO DE VÍDEO SÓ EXISTE QUANDO A INSTALAÇÃO OFERECE VIDEOCHAMADA (#2440).
 *
 * Cenário medido: self-hoster que NÃO configurou `JITSI_SERVER_URL` (hoje,
 * todas as instalações). Se o botão aparecesse mesmo assim, ele abriria um
 * dialog vazio — o padrão da casa (`WACALLS_API_BASE_URL`) é esconder, nunca
 * erro. Aqui estão os dois lados: sem servidor o componente devolve `null`,
 * com servidor ele renderiza o botão e a sala é o link que vai pelo chat.
 */

const sendMock = vi.hoisted(() => vi.fn());
const copiarMock = vi.hoisted(() => vi.fn());
vi.mock("@/hooks/inbox/useSendMessage", () => ({
  useSendMessage: () => ({ mutate: sendMock, isPending: false }),
}));
// O componente usa o helper (regra do repo: cliente nunca chama
// navigator.clipboard na mão — em http://IP não existe isSecureContext).
vi.mock("@/lib/clipboard", () => ({
  copyToClipboard: (texto: string) => copiarMock(texto) as Promise<boolean>,
}));

const CONVERSA = "3f1d2b7c-9a44-4e11-8f21-5b6c7d8e9f00";

function injetaServidor(valor: string | undefined) {
  if (typeof window !== "undefined") {
    window.__PUBLIC_ENV__ = { ...(window.__PUBLIC_ENV__ ?? {}), JITSI_SERVER_URL: valor };
  }
}

describe("VideoCallButton", () => {
  beforeEach(() => {
    sendMock.mockReset();
    copiarMock.mockReset();
    copiarMock.mockResolvedValue(true);
    sendMock.mockImplementation((_args: unknown, cb?: { onSuccess?: () => void }) => {
      cb?.onSuccess?.();
    });
    injetaServidor(undefined);
  });

  it("sem JITSI_SERVER_URL o botão não renderiza (esconde, nunca erro)", () => {
    const { container } = render(<VideoCallButton conversationId={CONVERSA} />);
    expect(screen.queryByTestId("btn-videochamada")).toBeNull();
    expect(container).toBeEmptyDOMElement();
  });

  it("com servidor: botão abre a dialog com a sala da própria conversa", async () => {
    injetaServidor("https://meet.jit.si");
    const user = userEvent.setup();
    render(<VideoCallButton conversationId={CONVERSA} />);

    await user.click(screen.getByTestId("btn-videochamada"));

    const iframe = await screen.findByTestId("iframe-videochamada");
    expect(iframe.getAttribute("src")).toBe(
      `https://meet.jit.si/deskcomm-${CONVERSA}`,
    );
    // Sem estes permissões o navegador nega câmera/microfone e a sala abre
    // muda e às cegas — é a diferença entre "abriu" e "funcionou".
    const allow = iframe.getAttribute("allow") ?? "";
    expect(allow).toContain("camera");
    expect(allow).toContain("microphone");
    expect(allow).toContain("fullscreen");
  });

  it("'Enviar link na conversa' manda a URL como mensagem desta conversa", async () => {
    injetaServidor("https://meet.jit.si");
    const user = userEvent.setup();
    render(<VideoCallButton conversationId={CONVERSA} />);

    await user.click(screen.getByTestId("btn-videochamada"));
    await user.click(await screen.findByTestId("btn-enviar-link-video"));

    await waitFor(() => {
      expect(sendMock).toHaveBeenCalledWith(
        {
          conversation_id: CONVERSA,
          body: `https://meet.jit.si/deskcomm-${CONVERSA}`,
        },
        expect.anything(),
      );
    });
    // O link é dado sensível: em envio com falha, o operador recebe convite de
    // copiar — não uma tela morta.
    expect(sendMock.mock.calls.length).toBe(1);
  });

  it("'Copiar link' não toca na API: é só clipboard", async () => {
    injetaServidor("https://meet.jit.si");
    copiarMock.mockReset();
    copiarMock.mockResolvedValue(true);
    const user = userEvent.setup();

    render(<VideoCallButton conversationId={CONVERSA} />);
    await user.click(screen.getByTestId("btn-videochamada"));
    await user.click(await screen.findByTestId("btn-copiar-link-video"));

    await waitFor(() =>
      expect(copiarMock).toHaveBeenCalledWith(
        `https://meet.jit.si/deskcomm-${CONVERSA}`,
      ),
    );
    expect(sendMock).not.toHaveBeenCalled();
  });
});
