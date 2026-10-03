# Spec 21 — Conversa pessoal sai da operação

> Doutrina: [`sistema-vivo.md`](../doctrine/sistema-vivo.md) (invariantes 3, 4 e 7: log visível, nada fora do radar, todo laço se fecha).
>
> Base medida: leitura direta dos arquivos citados, em 2026-10-03.

---

## 1. O problema é UM só

Quem usa o mesmo número para vender e para a vida — família, fornecedor, amigo — entrega os dois mundos para a mesma operação. A IA assume conversa que era de gente, o inbox mistura trabalho com vida, e o funil ganha card que nunca foi oportunidade. Inbox poluído, IA intrometida e funil sujo são **sintomas disso**, não problemas separados.

### Medido no código

| fato | onde |
|---|---|
| marca de pessoal **não existe** em contato nenhum | o select da lista (`app/api/v1/contacts/_handler.ts:37`) lista as colunas sem nenhuma marca de pessoal |
| o inbox lista por organização e não sabe esconder ninguém | `app/api/v1/conversations/_handler.ts:177` fixa `organization_id`; o filtro de não-lidas é `unread_count_for_assignee` (`_handler.ts:238`) |
| a busca casa por nome, telefone e prévia, via ids de contato | `app/api/v1/conversations/_handler.ts:304-368` |
| a contagem **ignora a busca de propósito** | `app/api/v1/conversations/counts/route.ts:44-46` |
| o board lista os negócios do funil, menos arquivados | `app/api/v1/pipelines/[id]/board/route.ts:464-469` |
| a IA já sabe recusar bloqueado, humano-forçado e silenciado — pessoal ela não conhece | `workers/ai-response-worker.ts:656-657`, `:708-709`; a lista de guardas está em `:11` |
| o caminho de entrada grava bloqueio ANTES do lead, nessa ordem de propósito | `lib/channels/pos-entrada.ts:23-28` |
| o RAG só ingere conversa resolvida e marcada, anonimizada e com guarda de vazamento | `lib/ai/rag/ingest/conversations.ts:5-6`, `:9-13`, `:18-19` |
| o contexto do lead lê bloqueio direto da fonte, sem cache | `lib/agent-engine/edge/crm/get-lead-context.ts:7-12` |
| escrita sensível em contato já exige gerente | `app/api/v1/contacts/merge/route.ts:85` usa `requireRole("manager")` |
| selo se lê de coluna, nunca de tag | `components/contacts/ContactsTable.tsx:228-237` |

---

## 2. Decisões fechadas (B, A, B)

> Decididas pelo dono da instalação em 03/10/2026. Não se reabre sem ele.

| # | decisão | consequência |
|---|---|---|
| **1 (B)** | **só gerente e dono marcam e desmarcam** | atendente não esconde conversa da operação; precedente em `app/api/v1/contacts/merge/route.ts:85` |
| **2 (A)** | **o negócio aberto some da vista mas continua por trás, e volta ao desmarcar** | esconder não é apagar: o board deixa de listar (`app/api/v1/pipelines/[id]/board/route.ts:464-469` é o ponto de toque), a linha continua no banco, desmarcar relista |
| **3 (B)** | **envio manual só a partir de Contatos, sem IA e sem criar conversa no inbox** | o pessoal continua contatável à mão; ponto de toque em `app/api/v1/contacts/_handler.ts:499-501`, que para pessoal não cria conversa no inbox |

---

## 3. O contrato — os 7 comportamentos

1. **Some do inbox na hora.** Marcou, a conversa sai da lista (`app/api/v1/conversations/_handler.ts:177` é onde a lista nasce). Não é arquivar nem fechar: é excluir da vista pelo marcador.
2. **A busca do inbox não acha.** Nome, telefone e prévia deixam de casar a conversa marcada (`app/api/v1/conversations/_handler.ts:304-368`). A contagem continua ignorando a busca, como hoje (`app/api/v1/conversations/counts/route.ts:44-46`).
3. **O contador ignora.** Não-lidas de conversa pessoal não entram no número (`app/api/v1/conversations/_handler.ts:238` e `counts/route.ts:108-119`).
4. **O funil não mostra nem cria.** O board não lista negócio de contato marcado (`app/api/v1/pipelines/[id]/board/route.ts:464-469`), e mensagem nova de marcado não cria negócio. O aberto continua por trás e volta ao desmarcar (decisão 2).
5. **Contatos mostra, com selo.** A linha continua em Contatos e a tabela ganha o selo "Pessoal" na região padrão dos selos (`components/contacts/ContactsTable.tsx:226-240`), lido da coluna — nunca de etiqueta.
6. **Mensagem nova não reabre nada e a IA fica quieta.** Inbound de marcado não volta para a lista, não cria negócio e não chama a IA: nem enfileira (`lib/agent-engine/edge/crm/drain.ts`, regra pura de `lib/ai/elegibilidade/gate.ts`) nem responde (`workers/ai-response-worker.ts:656-709`). O bloqueio por STOP passa na frente de tudo (`lib/channels/pos-entrada.ts:23-28`).
7. **Filtro de pessoais + desmarcar devolve o histórico.** Contatos ganha filtro que lista só marcados; desmarcar relista a conversa no inbox e no board **com o histórico intacto**. O RAG nunca vê pessoal (`lib/ai/rag/ingest/conversations.ts:5-13`).

---

## 4. Critérios de aceite

1. Marca contato com conversa ativa e lê a lista: a conversa não está. Sabotagem: tirar o filtro da lista — o teste quebra.
2. Com a conversa marcada, busca por nome, telefone e prévia: zero resultados. Sabotagem: filtrar só a prévia e deixar os ids passarem — o teste acusa.
3. Marca com não-lidas pendentes e lê a contagem: igual a antes. Sabotagem: somar a busca na contagem — o número diverge.
4. Com negócio aberto, marca: o board não lista, a linha continua no banco; mensagem nova: nenhum negócio nasce. Sabotagem: apagar a linha em vez de esconder — a volta vem vazia e acusa.
5. Marca e abre Contatos: selo "Pessoal" visível; edita as etiquetas: o selo fica. Sabotagem: ler o selo da etiqueta — some ao editar e acusa.
6. Manda inbound para marcado: nenhum trabalho enfileirado, nenhuma resposta, nenhum negócio. Sabotagem: recusar só na resposta mas enfileirar — o teste de fila acusa o custo.
7. Filtra pessoais, desmarca: conversa de volta no inbox e negócio de volta no board, mensagens antigas todas lá. Sabotagem: limpar mensagem ao marcar — a volta vem vazia e acusa.

---

## 5. Fora do escopo

- Ler o celular ou importar agenda. Marca manual, uma a uma, por gerente ou dono.
- Apagar qualquer coisa. Marcar esconde; tudo continua no banco.
- Bloquear no WhatsApp. Bloqueio continua sendo só o caminho de saída que o cliente pede.
- Permissão nova. O teto é gerente/dono.
- Usar pessoal para IA. Nem resposta, nem contexto, nem RAG.
- Mudar o STOP. Quem pediu para sair continua saindo pelo caminho de hoje.
