# Atendimento por IA a partir de uma fonte de formulário

Na configuração da fonte, **Autorizar IA para leads deste formulário** permite conceder elegibilidade para IA a um contato recebido por uma nova captação. Nasce desligada; não publica agente, conecta canal ou ativa regra de automação. Desligar interrompe novas concessões, sem reescrever autorizações existentes. A configuração exige a mesma permissão de gestão da fonte.

A fonte precisa ter assinatura configurada: o integrador no servidor assina o corpo bruto com HMAC-SHA256 e envia o header `X-Deskcomm-Signature`, como a captação assinada existente. Não expor o segredo no navegador. Sem assinatura, a fonte continua captando para humano, mas não pode habilitar a concessão de IA. Não remover a assinatura enquanto a opção estiver ligada.

O integrador deve colher um aceite específico para atendimento automatizado, independente do aceite de privacidade, e enviar no topo do JSON:

```json
{
  "external_id": "identidade-estavel-da-submissao",
  "ai_service_consent": true,
  "ai_service_consent_version": "versao-do-aviso-aceito",
  "submission_status": "completed"
}
```

`ai_service_consent` exige boolean JSON; a string `"true"` não concede autorização. A versão é string não vazia, até 120 caracteres. Form-urlencoded não concede consentimento por coerção. Captura parcial não deve enviar `completed`. Uma recusa explícita (`false`) em envio completo válido revoga a autorização e trava o contato para atendimento humano. Campo ausente não equivale a recusa nem a concessão. Consentimentos de marketing e atendimento automatizado previamente recusados continuam impedindo concessão.

O servidor confere no banco a fonte ativa do tipo `lead_capture`, a organização, o funil de destino, o card com origem `webhook` e identificador canônico da fonte, o vínculo ao contato e o histórico da captação criada no mesmo request, nos últimos cinco minutos. Sem histórico gravado, não há concessão. Exige telefone E.164 válido e ausência de bloqueio, anonimização, mescla, trava humana, responsável humano ativo, handoff ou silêncio vigente.

A operação usa uma função SECURITY INVOKER restrita a `service_role`, com filtros de organização em todos os vínculos. Não há trigger nem backfill. Repetições pelo `external_id` retornam antes da autorização; tentativas concorrentes concedem uma vez, sem renovar o timestamp. Autorizações existentes não são sobrescritas. A trilha fica em `contacts.ai_authorized_reason = formulario:<source_id>:<lead_id>` e nos campos de aceite do histórico de captação. A validade continua a do gate nativo (21 dias).

Quando a opção está desligada, os caminhos existentes permanecem, incluindo a autorização legada do Respondi. Quando ligada, a fonte utiliza exclusivamente este contrato estrito, sem fallback para o aceite implícito do Respondi. Os três campos de controle ficam no histórico de captação, separados das respostas comerciais do card.

Para atender somente esses leads, o canal deve usar o gate `allowlist`, com outras concessões automáticas desativadas conforme a operação. O fluxo de primeiro contato e o repasse humano continuam sendo configurações independentes. A função não envia mensagem. Antes de ativar, conferir fonte e organização, consentimento do formulário, agente publicado, canal conectado e destinatário humano elegível.

Rollback operacional: manter a opção desligada e regras inativas; reverter o código se necessário. Preservar a coluna e a trilha histórica. Não reprocessar formulários antigos para criar autorizações.
