---
impacto: exige_acao
secao: alterado
titulo: Na conversa, o agente lê do banco externo só as linhas do cliente que está falando
---

A conexão com um banco de dados externo (em **Dados externos**) ganhou o campo
**Cliente nas conversas**: você escolhe qual coluna das suas tabelas guarda o telefone ou o
e-mail do cliente. Durante uma conversa de atendimento, o agente passa a ler só as linhas em
que essa coluna é igual ao telefone ou ao e-mail de quem está falando. Fora das conversas
(equipe, integrações, API), a consulta segue como antes.

## Requer atenção

Se um agente seu consulta o banco externo nas conversas (pedido, assinatura, saldo), abra
**Dados externos**, clique em **Editar** na conexão e, em **Cliente nas conversas**, escolha
se o cliente é identificado pelo telefone ou pelo e-mail e o nome da coluna. Até isso ser
feito, o agente não consulta esse banco nas conversas e responde que a equipe confirma o
dado. O telefone precisa estar gravado só com números, com ou sem o código do país. Nenhum
arquivo precisa ser editado.
