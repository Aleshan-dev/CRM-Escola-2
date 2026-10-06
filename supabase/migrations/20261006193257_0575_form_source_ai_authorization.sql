-- manifest: Autorização opcional por fonte de formulário, vinculada à captação completa com consentimento explícito e sem retomar atendimento humano.
alter table public.webhook_sources
  add column if not exists authorize_ai_on_capture boolean not null default false;

-- Só o ingresso no servidor chama esta operação. Nenhum backfill ou trigger.
-- SECURITY INVOKER: não aumenta os privilégios do chamador.
create or replace function public.fn_authorize_ai_form_capture(
  p_organization_id uuid, p_source_id uuid, p_lead_id uuid,
  p_contact_id uuid, p_request_id uuid
) returns boolean
language sql security invoker set search_path = ''
as $function$
  with capture as (
        select w.fields from public.webhook_sources s
        join public.crm_leads l on l.organization_id = s.organization_id
          and l.id = p_lead_id and l.contact_id = p_contact_id
          and l.pipeline_id = s.default_pipeline_id and l.source = 'webhook'
          and l.source_metadata ->> 'webhook_source_id' = s.id::text
        join public.crm_pipelines p on p.id = s.default_pipeline_id
          and p.organization_id = s.organization_id
        join public.webhook_lead_captures w on w.organization_id = s.organization_id
          and w.webhook_source_id = s.id and w.lead_id = l.id and w.contact_id = p_contact_id
        where s.id = p_source_id and s.organization_id = p_organization_id
          and s.is_active and s.kind = 'lead_capture' and s.authorize_ai_on_capture
          and s.secret_encrypted is not null
          and w.outcome = 'criado' and w.request_id = p_request_id
          and w.received_at > now() - interval '5 minutes'
          and w.fields ->> 'submission_status' = 'completed'
          and jsonb_typeof(w.fields -> 'ai_service_consent_version') = 'string'
          and length(trim(w.fields ->> 'ai_service_consent_version')) between 1 and 120
  ), revoked as (
    update public.contacts c
    set ai_authorized_at = null, ai_authorized_reason = null, force_human = true,
        consent = jsonb_set(coalesce(c.consent, '{}'::jsonb), '{automated_service}',
          coalesce(c.consent -> 'automated_service', '{}'::jsonb) ||
            jsonb_build_object('declined_at', now(), 'source', 'formulario:' || p_source_id::text))
    where c.id = p_contact_id and c.organization_id = p_organization_id
      and exists (select 1 from capture where fields -> 'ai_service_consent' = 'false'::jsonb)
    returning c.id
  ), authorized as (
    update public.contacts c
    set ai_authorized_at = now(),
        ai_authorized_reason = 'formulario:' || p_source_id::text || ':' || p_lead_id::text
    where c.id = p_contact_id and c.organization_id = p_organization_id
      and c.ai_authorized_at is null
      and not c.force_human and not c.is_blocked and not c.is_anonymized and not c.is_personal
      and c.blocked_at is null and c.anonymized_at is null
      and c.is_merged_into is null and c.merged_at is null
      and c.phone_number ~ '^\+[1-9][0-9]{7,14}$'
      and nullif(c.consent #>> '{marketing,declined_at}', '') is null
      and nullif(c.consent #>> '{automated_service,declined_at}', '') is null
      and not exists (
        select 1 from public.conversations v
        where v.organization_id = c.organization_id and v.contact_id = c.id
          and v.status <> 'closed'
          and (v.assigned_to_user_id is not null or v.assignee_kind = 'human'
            or v.last_handoff_at is not null or v.bot_silenced_until > now())
      )
      and exists (select 1 from capture where fields -> 'ai_service_consent' = 'true'::jsonb)
    returning c.id
  ) select exists(select 1 from authorized);
$function$;
revoke execute on function public.fn_authorize_ai_form_capture(uuid, uuid, uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.fn_authorize_ai_form_capture(uuid, uuid, uuid, uuid, uuid) to service_role;
