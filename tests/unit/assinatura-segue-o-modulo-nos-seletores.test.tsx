/**
 * A assinatura do ChatGPT (#1639) só aparece nos seletores de provedor com o
 * módulo `login_codex` ligado — o editor do agente e o passo "O cérebro dele"
 * do onboarding.
 *
 * Quem decide é o SERVIDOR (`idsDosProvedoresOferecidos`), e a tela só desenha
 * a lista que recebe. Sem a lista, a tela fica sem a assinatura (falha fechada).
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";

window.HTMLElement.prototype.scrollIntoView = vi.fn();
window.HTMLElement.prototype.hasPointerCapture = vi.fn(() => false);
window.HTMLElement.prototype.setPointerCapture = vi.fn();
window.HTMLElement.prototype.releasePointerCapture = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/app/ai/agents/new",
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), message: vi.fn() } }));
vi.mock("@/app/actions/onboarding/chaveDaIa", () => ({ salvarChaveDaIa: vi.fn() }));

import { AgentForm, provedorInicial } from "@/app/app/ai/agents/[id]/_components/AgentForm";
import { InteligenciaDele } from "@/app/onboarding/setup-ai/_inteligencia";
import { IDS_DE_PROVEDOR, PROVEDOR_POR_ASSINATURA } from "@/lib/ai/pontos/provedores";

const ROTULO = "OpenAI pela assinatura (ChatGPT)";
const COM_ELA: readonly string[] = IDS_DE_PROVEDOR;
const SEM_ELA: readonly string[] = IDS_DE_PROVEDOR.filter((id) => id !== PROVEDOR_POR_ASSINATURA);

async function opcoesDoEditor(provedoresOferecidos?: readonly string[]) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const { container } = render(
    <QueryClientProvider client={qc}>
      <AgentForm
        mode="create"
        credentials={[] as never}
        channelSessions={[] as never}
        provedoresOferecidos={provedoresOferecidos}
      />
    </QueryClientProvider>,
  );
  const user = userEvent.setup();
  await user.click(container.querySelector("#provider") as HTMLElement);
  const lista = await screen.findByRole("listbox");
  return within(lista)
    .getAllByRole("option")
    .map((o) => o.textContent);
}

function opcoesDoOnboarding(provedoresOferecidos?: readonly string[]) {
  const { container } = render(
    <InteligenciaDele
      inicial={{ origem: "nenhuma", provedor: "anthropic", rotulo: "Anthropic (Claude)", final: null }}
      provedoresOferecidos={provedoresOferecidos}
    />,
  );
  const select = container.querySelector("#provedor_da_ia") as HTMLSelectElement;
  return Array.from(select.options).map((o) => o.textContent);
}

describe("editor do agente", () => {
  it("módulo desligado: a assinatura não é oferecida, os outros sim", async () => {
    const opcoes = await opcoesDoEditor(SEM_ELA);
    expect(opcoes).not.toContain(ROTULO);
    expect(opcoes).toContain("Anthropic (Claude)");
  });

  it("sem a lista do servidor: falha fechada, sem a assinatura", async () => {
    expect(await opcoesDoEditor(undefined)).not.toContain(ROTULO);
  });

  it("módulo ligado: a assinatura aparece, como antes", async () => {
    expect(await opcoesDoEditor(COM_ELA)).toContain(ROTULO);
  });

  it("o agente novo não herda a assinatura como padrão com o módulo desligado", () => {
    expect(provedorInicial(PROVEDOR_POR_ASSINATURA, SEM_ELA)).toBe("anthropic");
    expect(provedorInicial(PROVEDOR_POR_ASSINATURA)).toBe("anthropic");
    expect(provedorInicial(PROVEDOR_POR_ASSINATURA, COM_ELA)).toBe(PROVEDOR_POR_ASSINATURA);
  });
});

describe("onboarding — o cérebro dele", () => {
  it("módulo desligado: a assinatura não é oferecida, os outros sim", () => {
    const opcoes = opcoesDoOnboarding(SEM_ELA);
    expect(opcoes).not.toContain(ROTULO);
    expect(opcoes).toContain("Anthropic (Claude)");
  });

  it("sem a lista do servidor: falha fechada, sem a assinatura", () => {
    expect(opcoesDoOnboarding(undefined)).not.toContain(ROTULO);
  });

  it("módulo ligado: a assinatura aparece, como antes", () => {
    expect(opcoesDoOnboarding(COM_ELA)).toContain(ROTULO);
  });
});
