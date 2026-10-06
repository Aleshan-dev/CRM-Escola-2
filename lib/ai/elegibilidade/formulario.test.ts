import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { autorizarCaptacaoParaIA, camposDeAutorizacaoDoFormulario } from "./formulario";
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
