---
impacto: capacidade_nova
secao: corrigido
titulo: "Conversar sobre o caso" volta a aparecer quando a IA é configurada só por Credenciais, sem chave no ambiente
---

O assistente interno "Conversar sobre o caso" mostrava "Nenhum provedor de IA está
configurado" e escondia o campo em instalações que configuram a IA por
IA › Credenciais e não têm chave de IA no `.env`. O sinal que decide se o painel
aparece olhava só as variáveis de ambiente, embora a conversa do caso use a
credencial do agente do caso.

Agora o painel aparece quando o agente do caso tem credencial ativa e validada na
organização, mesmo sem chave no ambiente. Quem já tinha chave no `.env` não vê
diferença.
