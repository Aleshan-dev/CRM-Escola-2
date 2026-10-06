import type { SupabaseClient } from "@supabase/supabase-js";
import { logger } from "@/lib/logger";

/** Reservados: preserva os tipos do envio, sem converter privacidade em consentimento. */
export function camposDeAutorizacaoDoFormulario(payload: Record<string, unknown>) {
  return {
    ai_service_consent:
      typeof payload.ai_service_consent === "boolean" ? payload.ai_service_consent : null,
    submission_status: payload.submission_status === "completed" ? "completed" : "incomplete",
    ai_service_consent_version:
      typeof payload.ai_service_consent_version === "string" &&
      payload.ai_service_consent_version.length <= 120
        ? payload.ai_service_consent_version
        : "",
  };
}

/** A decisão e a escrita são atômicas no banco; falha deixa a captação para humano. */
export async function autorizarCaptacaoParaIA(
  admin: SupabaseClient,
  input: {
    organizationId: string;
    sourceId: string;
    leadId: string;
    contactId: string;
    requestId: string;
  },
): Promise<boolean> {
  try {
    const { data, error } = await admin.rpc("fn_authorize_ai_form_capture", {
      p_organization_id: input.organizationId,
      p_source_id: input.sourceId,
      p_lead_id: input.leadId,
      p_contact_id: input.contactId,
      p_request_id: input.requestId,
    });
    if (error) throw error;
    return data === true;
  } catch {
    logger.warn("[elegibilidade] autorização por formulário não gravada", {
      organization_id: input.organizationId,
      source_id: input.sourceId,
      request_id: input.requestId,
    });
    return false;
  }
}
