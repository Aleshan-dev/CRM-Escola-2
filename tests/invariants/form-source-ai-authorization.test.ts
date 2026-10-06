import { execFile, execFileSync } from "node:child_process";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

const container = process.env.TEST_DB_CONTAINER;
if (!container) throw new Error("Run via pnpm test:db");
function sql(query: string) {
  return execFileSync(
    "docker",
    [
      "exec",
      "-i",
      container!,
      "psql",
      "-U",
      "postgres",
      "-d",
      "postgres",
      "-v",
      "ON_ERROR_STOP=1",
      "-tA",
      "-f",
      "-",
    ],
    { input: query, encoding: "utf8" },
  ).trim();
}
const org = "fa000000-0000-4000-8000-000000000001";
const other = "fa000000-0000-4000-8000-000000000002";
const source = "fa000000-0000-4000-8000-000000000003";
const pipeline = "fa000000-0000-4000-8000-000000000004";
const stage = "fa000000-0000-4000-8000-000000000005";
const contact = "fa000000-0000-4000-8000-000000000006";
const lead = "fa000000-0000-4000-8000-000000000007";
const request = "fa000000-0000-4000-8000-000000000008";
const session = "fa000000-0000-4000-8000-000000000009";
const valid =
  '{"ai_service_consent":true,"submission_status":"completed","ai_service_consent_version":"synthetic-v1"}';
function authorize(organizationId = org) {
  return sql(
    `select public.fn_authorize_ai_form_capture('${organizationId}','${source}','${lead}','${contact}','${request}');`,
  );
}
beforeAll(() => {
  sql(`
    insert into public.organizations(id,slug,legal_name,display_name) values
      ('${org}','form-ai-test','Synthetic form','Synthetic form'),
      ('${other}','form-ai-other','Synthetic other','Synthetic other');
    insert into public.crm_pipelines(id,organization_id,name,slug) values ('${pipeline}','${org}','Synthetic','synthetic');
    insert into public.crm_stages(id,organization_id,pipeline_id,name,slug,position) values ('${stage}','${org}','${pipeline}','Synthetic','synthetic',0);
    insert into public.contacts(id,organization_id,name,phone_number) values ('${contact}','${org}','Synthetic','+5511999990000');
    insert into public.webhook_sources(id,organization_id,name,path_token,default_pipeline_id,default_stage_id)
      values ('${source}','${org}','Synthetic','synthetic-form-source-test','${pipeline}','${stage}');
    insert into public.crm_leads(id,organization_id,pipeline_id,stage_id,title,source,source_metadata,contact_id)
      values ('${lead}','${org}','${pipeline}','${stage}','Synthetic','webhook','{"webhook_source_id":"${source}"}','${contact}');
    insert into public.webhook_lead_captures(organization_id,webhook_source_id,source_name,lead_id,contact_id,outcome,request_id,fields)
      values ('${org}','${source}','Synthetic','${lead}','${contact}','criado','${request}','${valid}');
    insert into public.channel_sessions(id,organization_id,waha_session_name,webhook_secret_encrypted)
      values ('${session}','${org}','synthetic-form-ai','\\x00'::bytea);
  `);
});
beforeEach(() => {
  sql(`delete from public.conversations where organization_id='${org}';
    update public.webhook_sources set authorize_ai_on_capture=true,is_active=true where id='${source}';
    update public.contacts set ai_authorized_at=null,ai_authorized_reason=null,force_human=false,is_blocked=false,is_anonymized=false,is_personal=false,
      blocked_at=null,anonymized_at=null,is_merged_into=null,merged_at=null,phone_number='+5511999990000',consent='{}' where id='${contact}';
    update public.crm_leads set source='webhook',source_metadata='{"webhook_source_id":"${source}"}',organization_id='${org}',contact_id='${contact}' where id='${lead}';
    update public.webhook_lead_captures set outcome='criado',fields='${valid}',received_at=now(),request_id='${request}' where request_id='${request}';`);
});
describe("form origin authorization", () => {
  it("defaults off, grants once and keeps source evidence without creating messages", () => {
    expect(
      sql(
        `select column_default from information_schema.columns where table_name='webhook_sources' and column_name='authorize_ai_on_capture';`,
      ),
    ).toBe("false");
    expect(authorize()).toBe("t");
    const stamp = sql(
      `select ai_authorized_at::text || '|' || ai_authorized_reason from public.contacts where id='${contact}';`,
    );
    expect(stamp).toContain(`formulario:${source}:${lead}`);
    expect(authorize()).toBe("f");
    expect(
      sql(
        `select ai_authorized_at::text || '|' || ai_authorized_reason from public.contacts where id='${contact}';`,
      ),
    ).toBe(stamp);
    expect(sql(`select count(*) from public.messages where organization_id='${org}';`)).toBe("0");
  });
  it.each([
    "update public.webhook_sources set authorize_ai_on_capture=false",
    "update public.webhook_sources set is_active=false",
    "update public.contacts set force_human=true",
    "update public.contacts set is_blocked=true",
    "update public.contacts set is_personal=true",
    "update public.contacts set blocked_at=now()",
    "update public.contacts set is_anonymized=true,anonymized_at=now()",
    "update public.contacts set anonymized_at=now()",
    "update public.contacts set merged_at=now()",
    "update public.contacts set phone_number=null",
    'update public.contacts set consent=\'{"marketing":{"declined_at":"2026-01-01"}}\'',
    'update public.contacts set consent=\'{"automated_service":{"declined_at":"2026-01-01"}}\'',
    "update public.crm_leads set source='manual'",
    "update public.crm_leads set source_metadata='{}'",
    "update public.webhook_lead_captures set outcome='duplicado'",
    "update public.webhook_lead_captures set received_at=now()-interval '1 day'",
    "update public.webhook_lead_captures set fields='{}'",
    'update public.webhook_lead_captures set fields=\'{"consentimento":true,"privacy_accepted_at":"2026-01-01"}\'',
    "update public.webhook_lead_captures set fields=fields || '{\"ai_service_consent\":false}'",
    'update public.webhook_lead_captures set fields=fields || \'{"ai_service_consent":"true"}\'',
    'update public.webhook_lead_captures set fields=fields || \'{"submission_status":"partial"}\'',
    'update public.webhook_lead_captures set fields=fields || \'{"ai_service_consent_version":" "}\'',
    "update public.webhook_lead_captures set fields=fields || '{\"ai_service_consent_version\":1}'",
  ])("denies unsafe or incomplete input: %s", (change) => {
    // Isolated database, only this suite's synthetic records.
    sql(change + ";");
    expect(authorize()).toBe("f");
    expect(sql(`select ai_authorized_at is null from public.contacts where id='${contact}';`)).toBe(
      "t",
    );
  });
  it("revokes existing authorization on explicit refusal and cannot resume it on resubmission", () => {
    expect(authorize()).toBe("t");
    sql(
      `update public.webhook_lead_captures set fields=fields || '{"ai_service_consent":false}' where request_id='${request}';`,
    );
    expect(authorize()).toBe("f");
    expect(
      sql(
        `select force_human and ai_authorized_at is null and consent #>> '{automated_service,declined_at}' is not null from public.contacts where id='${contact}';`,
      ),
    ).toBe("t");
    sql(`update public.webhook_lead_captures set fields='${valid}' where request_id='${request}';`);
    expect(authorize()).toBe("f");
  });
  it("rejects a different tenant and a capture with the wrong request", () => {
    expect(authorize(other)).toBe("f");
    expect(
      sql(
        `select public.fn_authorize_ai_form_capture('${org}','${source}','${lead}','${contact}','${other}');`,
      ),
    ).toBe("f");
  });
  it("concurrent attempts grant once without renewing the timestamp", async () => {
    const call = () =>
      new Promise<string>((resolve, reject) => {
        execFile(
          "docker",
          [
            "exec",
            container!,
            "psql",
            "-U",
            "postgres",
            "-d",
            "postgres",
            "-tA",
            "-c",
            `select public.fn_authorize_ai_form_capture('${org}','${source}','${lead}','${contact}','${request}');`,
          ],
          (error, stdout) => (error ? reject(error) : resolve(stdout.trim())),
        );
      });
    expect((await Promise.all([call(), call()])).sort()).toEqual(["f", "t"]);
  });
  it("service role can authorize with invoker privileges", () => {
    expect(
      sql(
        `set role service_role; select public.fn_authorize_ai_form_capture('${org}','${source}','${lead}','${contact}','${request}');`,
      )
        .split("\n")
        .at(-1),
    ).toBe("t");
  });
  it("preserves an active human assignment", () => {
    sql(`insert into auth.users(id,email) values ('${other}','synthetic-form-ai@invariant.test') on conflict do nothing;
      insert into public.conversations(organization_id,channel_session_id,contact_id,assigned_to_user_id,status)
      values ('${org}','${session}','${contact}','${other}','open');`);
    expect(authorize()).toBe("f");
  });
  it("does not expose the operation to public API roles", () => {
    expect(
      sql(
        `select has_function_privilege('anon','public.fn_authorize_ai_form_capture(uuid,uuid,uuid,uuid,uuid)','EXECUTE');`,
      ),
    ).toBe("f");
    expect(
      sql(
        `select has_function_privilege('authenticated','public.fn_authorize_ai_form_capture(uuid,uuid,uuid,uuid,uuid)','EXECUTE');`,
      ),
    ).toBe("f");
    expect(
      sql(
        `select has_function_privilege('service_role','public.fn_authorize_ai_form_capture(uuid,uuid,uuid,uuid,uuid)','EXECUTE');`,
      ),
    ).toBe("t");
  });
});
