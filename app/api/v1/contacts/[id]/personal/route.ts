import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { audit } from "@/lib/audit";
import { fail, ok } from "@/lib/api/wrappers";
import { requireRole } from "@/lib/auth/require-role";
import { traduzir } from "@/lib/i18n/dicionario";
import { requireSupportWrite } from "@/lib/impersonate/support";
import { createAdminClient } from "@/lib/supabase/admin";
import type { SupabaseClient } from "@supabase/supabase-js";
import { emitLeadActivity } from "@/lib/leads/activity-emitter";
import { registraFalhaDeAtividade } from "@/lib/leads/activity-write-failure";
import { resolveActiveLeadForContact, type LeadCandidate } from "@/lib/leads/active-lead";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

/**
 * CONTATO PESSOAL — marcar e desmarcar (spec 21, fatia 1).
 *
 * ## Por que esta rota existe
 *
 * Quem usa o mesmo número para vender e para a vida entrega os dois mundos
 * para a mesma operação: a IA assume conversa que era de gente, o inbox
 * mistura trabalho com vida, e o funil ganha card que nunca foi oportunidade.
 * A marca `contacts.is_personal` (migration 0544) tira o contato da operação —
 * e é esta rota que a liga e desliga.
 *
 * ## Por que `manager`, e não `admin`
 *
 * Diferença medida e proposital contra o desbloqueio (`unblock/route.ts`
 * exige `admin`): desfazer descadastro reabre um canal que o cliente fechou
 * (direito do titular, LGPD). Pessoal é decisão operacional — esconder uma
 * conversa da operação — e gerente pode (spec decisão 1, D3 do plano).
 *
 * ## Por que SEM exceção para gerente no envio
 *
 * Gerente marca e desmarca, mas não envia para marcado — o veto de envio
 * (`sendMessageHandler`, fatia 2) recusa em todo papel, sem exceção.
 *
 * ## O que a rota NÃO faz
 *
 * Não apaga nada: marcar esconde, tudo continua no banco, e desmarcar relista
 * (spec decisão 2). Desmarcar NÃO reativa follow-up, campanha nem prospecção
 * (D8 — espelha o desbloqueio, que também não reativa o que o bloqueio
 * cancelou). Quem marcou e quando fica só em auditoria + timeline, sem coluna
 * extra no contato (spec §3.6).
 *
 * ## Ordem dos efeitos do marcar (fixa, toda nesta rota)
 *
 * 1) `update contacts is_personal=true`; 2) cancela follow-ups (parada total,
 * como o bloqueio); 3) cancela retornos avulsos; 4) saída de campanha com
 * status/motivo próprios (nunca `opted_out`); 5) prospecção vira pulada com
 * motivo próprio; 6) fecha conversas + tira do atendente; 7) auditoria +
 * timeline. Sem negócio aberto, a timeline é pulada em silêncio e a auditoria
 * continua valendo como prova (D6).
 */

interface EfeitosDoMarcar {
  followups_cancelados: number;
  retornos_cancelados: number;
  campanha_saidas: number;
  prospeccao_pulada: number;
  conversas_fechadas: number;
}

const SEM_EFEITO: EfeitosDoMarcar = {
  followups_cancelados: 0,
  retornos_cancelados: 0,
  campanha_saidas: 0,
  prospeccao_pulada: 0,
  conversas_fechadas: 0,
};

/**
 * O negócio aberto do contato, para ancorar a timeline.
 *
 * `crm_lead_activities.lead_id` é NOT NULL: sem negócio aberto não há linha
 * possível — e aí não há nem tentativa (D6), só auditoria. Quando o alvo é
 * ambíguo, NÃO adivinha: o mesmo `resolveActiveLeadForContact` que o motor usa.
 */
async function negocioAbertoDoContato(
  admin: SupabaseClient,
  orgId: string,
  contactId: string,
): Promise<string | null> {
  const { data: candidatos } = await admin
    .from("crm_leads")
    .select("id, organization_id, pipeline_id, status, last_activity_at, created_at")
    .eq("organization_id", orgId)
    .eq("contact_id", contactId);
  const { data: padrao } = await admin
    .from("crm_pipelines")
    .select("id")
    .eq("organization_id", orgId)
    .eq("is_default", true)
    .eq("is_archived", false)
    .limit(1)
    .maybeSingle();
  const rota = resolveActiveLeadForContact((candidatos ?? []) as LeadCandidate[], {
    defaultPipelineId: (padrao as { id: string } | null)?.id ?? null,
  });
  return rota.routed ? rota.leadId : null;
}

/**
 * A linha na timeline — falha BAIXO, mas falha CONTADA.
 *
 * A mutação (marcar/desmarcar) já aconteceu quando chegamos aqui: bloquear a
 * operação porque a timeline caiu deixaria o contato refém do registro. Mas a
 * perda vira `event_log` via `registraFalhaDeAtividade` — nunca silêncio.
 * Sem negócio aberto, nem tenta (D6): a auditoria é a prova.
 */
async function registraNaTimeline(
  admin: SupabaseClient,
  entrada: {
    orgId: string;
    contactId: string;
    leadId: string;
    tipo: "contact_marked_personal" | "contact_unmarked_personal";
    motivo: string;
    atorUserId: string;
    requestId: string;
    origem: string;
  },
): Promise<void> {
  const atividade = await emitLeadActivity(admin, {
    organizationId: entrada.orgId,
    leadId: entrada.leadId,
    contactId: entrada.contactId,
    type: entrada.tipo,
    sourceModule: "crm",
    sourceId: entrada.leadId,
    actor: { type: "user", id: entrada.atorUserId },
    reason: entrada.motivo,
    payload: { origem: entrada.origem },
  });
  if (!atividade.ok) {
    await registraFalhaDeAtividade(admin, {
      organizationId: entrada.orgId,
      leadId: entrada.leadId,
      tipo: entrada.tipo,
      origem: entrada.origem,
      erro: atividade.error,
      requestId: entrada.requestId,
    });
  }
}

export async function POST(_req: NextRequest, ctx: Context): Promise<Response> {
  const supportDenied = await requireSupportWrite();
  if (supportDenied) return supportDenied;

  const requestId = randomUUID();
  const { id } = await ctx.params;

  // Só gerente e dono marcam (spec decisão 1). Atendente recebe 403 — é ele
  // quem NÃO pode esconder conversa da operação.
  const authz = await requireRole("manager", { requestId, resource: "contacts" });
  if (!authz.ok) return authz.response;
  const t = (texto: string) => traduzir(texto, authz.user.idioma);

  if (!z.uuid().safeParse(id).success) {
    return fail("validation_failed", t("Contato inválido."), 422, { requestId });
  }

  const admin = createAdminClient();
  // Admin client bypassa RLS: o filtro por organização é PROGRAMÁTICO e
  // obrigatório (CLAUDE.md, anti-pattern 10).
  const { data: contato, error: leituraErro } = await admin
    .from("contacts")
    .select("id, display_name, is_personal")
    .eq("organization_id", authz.org.orgId)
    .eq("id", id)
    .maybeSingle();
  if (leituraErro) {
    return fail("internal_error", t("Não foi possível marcar o contato como pessoal."), 500, {
      requestId,
    });
  }
  if (!contato) return fail("not_found", t("Contato não encontrado."), 404, { requestId });

  // Idempotente: já pessoal, nada a fazer — e nada a auditar. Recontar a
  // história a cada clique duplicaria a prova sem fato novo.
  if ((contato as { is_personal?: boolean }).is_personal === true) {
    return ok({ contact: contato, effects: { ...SEM_EFEITO } }, { requestId });
  }

  const { data: marcado, error: updateErro } = await admin
    .from("contacts")
    .update({ is_personal: true })
    .eq("organization_id", authz.org.orgId)
    .eq("id", id)
    .select("id, display_name, is_personal")
    .maybeSingle();
  if (updateErro || !marcado) {
    return fail("internal_error", t("Não foi possível marcar o contato como pessoal."), 500, {
      requestId,
    });
  }

  const efeitos: EfeitosDoMarcar = { ...SEM_EFEITO };
  // Os efeitos 2–6 (follow-up, retorno avulso, campanha, prospecção, conversas)
  // entram na etapa 4, nesta ordem fixa — ver o cabeçalho do arquivo.

  // Espelha o registro do desbloqueio (`unblock/route.ts`): mesmo
  // `resourceType`, mesmo `contact_id` no metadata. O telefone NÃO entra —
  // auditoria não é lugar de dado pessoal, e o `contact_id` já identifica.
  // Os contadores de efeitos entram para a prova dizer O QUE foi desarmado.
  await audit({
    action: "contact.marked_personal",
    actorUserId: authz.user.id,
    organizationId: authz.org.orgId,
    resourceType: "contact",
    resourceId: id,
    requestId,
    metadata: { contact_id: id, origem: "tela_do_contato", ...efeitos },
  });

  const leadId = await negocioAbertoDoContato(admin, authz.org.orgId, id);
  if (leadId) {
    await registraNaTimeline(admin, {
      orgId: authz.org.orgId,
      contactId: id,
      leadId,
      tipo: "contact_marked_personal",
      motivo: "Contato marcado como pessoal pela equipe",
      atorUserId: authz.user.id,
      requestId,
      origem: "contacts/[id]/personal.POST",
    });
  }
  // Sem negócio aberto: só auditoria (D6). A conversa some do inbox pela
  // leitura filtrada (fatia 2); o histórico continua no banco.

  return ok({ contact: marcado, effects: efeitos }, { requestId });
}
