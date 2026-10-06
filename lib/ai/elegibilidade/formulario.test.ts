import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { limitarCampos } from "@/lib/webhooks/captacao";
import { autorizarCaptacaoParaIA, camposDaCaptacao, camposDeAutorizacaoDoFormulario } from "./formulario";
const input = {
  organizationId: "org",
  sourceId: "source",
  leadId: "lead",
  contactId: "contact",
  requestId: "request",
};
describe("form authorization adapter", () => {
  it.each([
    {},
    { consentimento: true },
    { ai_service_consent: "true" },
    { privacy_accepted_at: "now" },
  ])("does not infer explicit AI consent from %j", (payload) => {
    expect(camposDeAutorizacaoDoFormulario(payload).ai_service_consent).toBeNull();
  });
  it("keeps strict completion and explicit consent evidence", () => {
    expect(
      camposDeAutorizacaoDoFormulario({
        ai_service_consent: true,
        submission_status: "partial",
        ai_service_consent_version: "v1",
      }),
    ).toEqual({
      ai_service_consent: true,
      submission_status: "incomplete",
      ai_service_consent_version: "v1",
    });
  });
  // O histórico guarda só os 60 primeiros campos. Recusa cortada = revogação
  // que não acontece; consentimento cortado = autorização que não acontece.
  it.each([true, false])("keeps ai_service_consent=%s through the 60-field cap", (consent) => {
    const proprios = Object.fromEntries(Array.from({ length: 70 }, (_, i) => [`campo_${i}`, "x"]));
    const guardado = limitarCampos(
      camposDaCaptacao(
        proprios,
        { ai_service_consent: consent, submission_status: "completed", ai_service_consent_version: "v1" },
        true,
      ),
    );
    expect(guardado.ai_service_consent).toBe(consent);
    expect(guardado.submission_status).toBe("completed");
    expect(guardado.ai_service_consent_version).toBe("v1");
  });
  it("adds no authorization evidence when the source option is off", () => {
    expect(camposDaCaptacao({ a: 1 }, { ai_service_consent: true }, false)).toEqual({ a: 1 });
  });
  it("passes server resolved identities to atomic authorization", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: true, error: null });
    expect(await autorizarCaptacaoParaIA({ rpc } as unknown as SupabaseClient, input)).toBe(true);
    expect(rpc).toHaveBeenCalledWith("fn_authorize_ai_form_capture", {
      p_organization_id: "org",
      p_source_id: "source",
      p_lead_id: "lead",
      p_contact_id: "contact",
      p_request_id: "request",
    });
  });
  it("keeps the lead available for human care on database failure", async () => {
    const rpc = vi.fn().mockRejectedValue(new Error("database unavailable"));
    expect(await autorizarCaptacaoParaIA({ rpc } as unknown as SupabaseClient, input)).toBe(false);
  });
});
