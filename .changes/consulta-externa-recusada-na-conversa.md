---
impacto: exige_acao
secao: alterado
titulo: Durante uma conversa de atendimento, o agente não consulta mais o banco de dados externo conectado
---

Numa conversa de atendimento, a ferramenta `crm_query_external_data` passa a ser recusada.
Em vez de ler o banco externo, o agente responde que a equipe confirma o dado. Fora de uma
conversa de atendimento (integração, MCP externo, rota HTTP), a consulta segue como antes.

## Requer atenção

Se um agente seu respondia a clientes com dados do banco externo conectado (pedido,
assinatura, saldo), ele deixa de fazer isso nas conversas: o cliente passa a ouvir que a
equipe vai confirmar. Revise as instruções desse agente para que ele encaminhe essas
perguntas a uma pessoa, e confira esses dados pela equipe ou pela integração que consulta
o banco fora da conversa. Nenhuma configuração precisa ser editada.
