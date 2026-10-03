# Spec 21 — Contato pessoal: esconder e inutilizar

> Doutrina: [`sistema-vivo.md`](../doctrine/sistema-vivo.md) (invariantes 3, 4 e 7: log visível, nada fora do radar, todo laço se fecha).
>
> Base medida: leitura direta dos arquivos citados, em 03/10/2026.
> Revisão cega da v2: 14 pontos confirmados, 5 endereços corrigidos (ver rodapé). Regra do dono: nunca se responde contato pessoal por dentro do CRM.

---

## 1. O problema é UM só

Quem usa o mesmo número para vender e para a vida — família, fornecedor, amigo — entrega os dois mundos para a mesma operação. A IA assume conversa que era de gente, o inbox mistura trabalho com vida, e o funil ganha card que nunca foi oportunidade. Inbox poluído, IA intrometida e funil sujo são **sintomas disso**, não problemas separados.

### Medido no código

| fato | onde |
|---|---|
| marca de pessoal **não existe** em contato nenhum | o select da lista (`app/api/v1/contacts/_handler.ts`) lista as colunas sem nenhuma marca de pessoal |
| o inbox lista por organização e não sabe esconder ninguém | `app/api/v1/conversations/_handler.ts` fixa `organization_id`; o filtro de não-lidas é `unread_count_for_assignee` |
| a busca casa por nome, telefone e prévia, via ids de contato | `app/api/v1/conversations/_handler.ts` (termo seguro, `ilike`, teto de ids) |
| a contagem **ignora a busca de propósito** | `app/api/v1/conversations/counts/route.ts` (repetir a busca ali criaria segunda régua que diverge) |
| o board lista os negócios do funil, menos arquivados | `app/api/v1/pipelines/[id]/board/route.ts` (leitura de `crm_leads` por `pipeline_id`) |
| a IA já sabe recusar bloqueado, humano-forçado e silenciado — pessoal ela não conhece | função `checkGuards` em `workers/ai-response-worker.ts` (pula `is_blocked` e `force_human`; pula silêncio pós-handoff) |
| o caminho de entrada grava bloqueio ANTES do lead, nessa ordem de propósito | função `aplicarEfeitosPosEntrada` em `lib/channels/pos-entrada.ts` (inverter faz quem pediu para sair virar oportunidade) |
| o RAG só ingere conversa resolvida e marcada, anonimizada e com guarda de vazamento | `lib/ai/rag/ingest/conversations.ts` (filtro `usable_for_rag` + `resolved`, anonimização, isolamento por organização) |
| o contexto do lead lê bloqueio direto da fonte, sem cache | `lib/agent-engine/edge/crm/get-lead-context.ts` |
| escrita sensível em contato já exige gerente | `app/api/v1/contacts/merge/route.ts` usa `requireRole("manager")` |
| selo se lê de coluna, nunca de tag | `components/contacts/ContactsTable.tsx` (tag `cliente` é removível à mão e pelo PATCH, então selo por tag mentiria) |

---

## 2. Decisões fechadas

> Decididas pelo dono da instalação em 03/10/2026. Não se reabre sem ele.

| # | decisão | consequência |
|---|---|---|
| **1** | **só gerente e dono marcam e desmarcam** | no código: `requireRole("manager")` (o rank cobre gerente e admin; atendente não esconde conversa da operação) |
| **2** | **o negócio aberto some da vista mas continua por trás, e volta ao desmarcar** | esconder não é apagar: o board deixa de listar, a linha continua no banco, desmarcar relista |
| **3** | **contato pessoal fica inutilizado: nenhum envio pelo CRM, nem manual** | o veto segue o padrão do bloqueio que `sendMessageHandler` em `app/api/v1/messages/_handler.ts` já aplica para `is_blocked`, mas em coluna e eventos próprios (ver §3.1 e §3.5): `is_blocked` continua significando só descadastro/STOP |

---

## 3. O contrato

### 3.1 Onde a marca fica

- Tabela `contacts`, coluna boolean nova com prefixo `is_`, no padrão de `is_blocked` e `is_anonymized`. É coluna nova de propósito: reutilizar `is_blocked` misturaria descadastro com pessoal na auditoria e nas regras.
- Valor padrão desligado. Tripla da casa: arquivo novo em `supabase/migrations/` com linha `-- manifest:` no cabeçalho, apêndice idempotente em `supabase/baseline.sql`; `MANIFEST.md` é histórico e não recebe linha.

### 3.2 Marcar e desmarcar

- Só gerente e dono (`requireRole("manager")`). Marcar grava quem marcou e quando; desmarcar grava quem desmarcou e quando.
- Marcar cancela follow-up de fluxo pendente (mesmo comportamento do bloqueio: parada total, inclusive dormente).
- Marcar cancela retorno avulso pendente. Hoje o retorno avulso só tem veto na hora do envio; para pessoal a spec decide: cancela na hora de marcar, para não deixar lixo pendente.
- Marcar tira o contato da campanha com efeito de saída (marca saída sem remover a linha, como o pedido de saída faz).
- Candidato de prospecção nativa que virar pessoal vira pulado (a prospecção não tem estado de bloqueio; pulado é o estado que diz não chamar mais).
- A marca fica no contato e vale para WhatsApp, Instagram e Facebook juntos: um contato tem N conversas, uma por sessão (`fn_upsert_wa_conversation`, uma linha por organização + contato + sessão). Os robôs de envio já leem o contato a cada envio, então o veto vale nos três canais sem marca por conversa.

### 3.3 Envio: tudo recusado

- Toda rota de envio recusa contato marcado, manual ou automática, no mesmo ponto onde `sendMessageHandler` já recusa bloqueado.
- Sem exceção para gerente. Gerente marca e desmarca, mas não envia para marcado.
- Erro padrão de envio recusado, sem vazar dado do contato.

### 3.4 Resposta: guarda, mas esconde

- A resposta do pessoal entra pelo ingest normal (contato e conversa gravados, carimbo de não-lida atualizado pela função SQL de marcação de mensagem).
- Depois de gravada, ela some de tudo: inbox, funil, busca, contadores, relatórios, base de busca da IA e contexto do agente. Cada caminho que reage a mensagem nova ignora pessoal:
  - alerta no navegador (`useInboundMessageAlerts` → `entregarAviso` em `lib/notifications/deliver.ts` → `emitNotification` em `lib/notifications/emit.ts` + `playSound` em `lib/notifications/sounds.ts`);
  - inbox em tempo real (`useConversationsRealtime` em `hooks/inbox/useConversationsRealtime.ts` + `useMessagesRealtime` em `hooks/inbox/useMessagesRealtime.ts`, via `useRealtimeChannel`): a invalidação chega, mas a lista filtrada não mostra nada;
  - push no celular (`webPushInboundHandler` → `montarPayloadDeInbound` em `lib/notifications/push_payload.ts` → `enviarPushDaOrg` em `lib/notifications/web_push.ts`);
  - follow-up quente (`aplicarEfeitosPosEntrada` → `acelerarPipelineDeEventos` → `followupReactivityHandler` em `lib/followup/reactivity.handler.ts` / `applyReactivityEvent` em `lib/followup/reactivity.ts` / `aplicarTextoNosFollowups` em `lib/followup/aplicar-inbound.ts`) e morno (`aplicarRespostasQueChegaram` em `lib/relogio/executar.ts`);
  - campanha (`campanhaRespostaHandler` → `aplicarRespostaNaCampanha`: resposta de pessoal não carimba nada);
  - Jev (`processSentiment` → `medirClima` em `lib/ai/decisao/clima.ts` → `observarPedidos`/`avisarAEquipe` em `lib/ai/decisao/pedidos.ts` → `aiHandoffFromSentimentHandler` em `workers/ai-handoff-from-sentiment.handler.ts`): pessoal não entra no caminho e não cria item de revisão;
  - webhook externo (`automationRulesHandler` → `executeCallWebhook`: evento de pessoal não casa com regra);
  - distribuição (`runRoutingWorker`/`decideRouting`: conversa de pessoal não distribui);
  - métricas (`taxasDaCampanha`, contagens, função SQL de marcação, uso da plataforma): pessoal não soma.
- Contador no título da aba não existe (nenhum `document.title` escrito em `app/`, `hooks/`, `components/` ou `lib/`), então não há nada para esconder ali.
- Tudo só volta a aparecer ao desmarcar, com o histórico inteiro.

### 3.5 Registro: auditoria e timeline

- Auditoria pelo emissor `audit` (`lib/audit/index.ts`), lista `AUDIT_ACTIONS` (`lib/audit/actions.ts`; regra: acrescenta no fim, nunca renomeia).
- Eventos novos no fim da lista, no padrão de `contact.blocked` (emitido na pós-entrada) e `contact.unblocked` (emitido na rota de desbloqueio): um para marcar, outro para desmarcar, com quem fez e quando. São eventos novos de propósito, para não misturar com descadastro.
- Timeline pela função `emitLeadActivity` (`lib/leads/activity-emitter.ts`): organização, contato, tipo, ator e motivo sem dado pessoal.

---

## 4. Critérios de aceite

1. Marca contato com conversa ativa e lê a lista: a conversa não está. Sabotagem: tirar o filtro da lista — o teste quebra.
2. Com a conversa marcada, busca por nome, telefone e prévia: zero resultados. Sabotagem: filtrar só a prévia e deixar os ids passarem — o teste acusa.
3. Marca com não-lidas pendentes e lê a contagem: igual a antes. Sabotagem: somar a busca na contagem — o número diverge.
4. Com negócio aberto, marca: o board não lista, a linha continua no banco; mensagem nova: nenhum negócio nasce. Sabotagem: apagar a linha em vez de esconder — a volta vem vazia e acusa.
5. Marca e abre Contatos: selo "Pessoal" visível; edita as etiquetas: o selo fica. Sabotagem: ler o selo da etiqueta — some ao editar e acusa.
6. Manda inbound para marcado: nenhum trabalho enfileirado, nenhuma resposta, nenhum negócio; nenhum alerta, push, follow-up, carimbo de campanha, análise do Jev, webhook ou redistribuição. Sabotagem por caminho: ligar cada efeito de volta — o teste daquele efeito acusa.
7. Tentar enviar para marcado (qualquer papel): recusado. Sabotagem: liberar para gerente — o teste acusa.
8. Marcar cancela fluxo e retorno pendentes, tira da campanha com saída e pula candidato de prospecção. Sabotagem: cancelar só o fluxo — o retorno dispara depois e acusa.
9. Auditoria guarda os dois eventos novos e a timeline guarda o registro. Sabotagem: reutilizar os eventos de bloqueio — o teste de nome acusa.
10. Filtra pessoais, desmarca: conversa de volta no inbox e negócio de volta no board, mensagens antigas todas lá. Sabotagem: limpar mensagem ao marcar — a volta vem vazia e acusa.

---

## 5. Fora do escopo

- Ler o celular ou importar agenda. Marca manual, uma a uma, por gerente ou dono.
- Apagar qualquer coisa. Marcar esconde; tudo continua no banco.
- Bloquear no WhatsApp ou mudar o STOP. Descadastro continua separado, com sentido próprio.
- Anonimização LGPD. `is_anonymized` e o trabalho de privacidade continuam como estão.
- Regra automática para adivinhar quem é pessoal. Só pessoa marca.
- Permissão nova. O teto é gerente/dono via rank existente.

---

## Rodapé da revisão

Revisor cego conferiu 17 pontos da v2 no disco: 14 confirmados, 5 endereços corrigidos nesta v3 (`useMessagesRealtime` tem arquivo próprio; `emitNotification` e `playSound` têm paths próprios; handlers de follow-up e de handoff por sentimento têm paths próprios; marcação de mensagem é função SQL; funções privadas citadas como comportamento, não como ponto de importação). Nenhum número de migration, nome de coluna ou diff nesta spec.
