---
impacto: capacidade_nova
secao: adicionado
titulo: Interruptor por empresa que desliga de uma vez todo passo a IA decide das automações
---

O passo `a IA decide` (#2228) passa a ter um freio único por organização: em
Configurações → Automações, um interruptor desliga, de uma vez, todos os
`ai_decide` da empresa, sem editar regra por regra.

Com o interruptor desligado, a ação não consulta o modelo em nenhuma regra — o
run grava `ai_decide_desligado_na_empresa` e a aba Atividade mostra a frase,
com o caminho do interruptor dentro dela. A pré-checagem de adiamento também
deixa de adiar o evento por um passo que não vai rodar, então as demais ações
do mesmo gatilho não esperam à toa.

A chave mora em `organizations.settings.automacoes.ai_decide` e o padrão é
LIGADO: regra gravada depois do #2228 continua decidindo sem ninguém precisar
ligar nada, e uma falha de leitura não vira freio (o leitor devolve "não deu
para saber", e quem executa segue como antes). A troca entra no audit log com
`settings.automation_ai_decide_updated`.

Refs #2367

Contribuição de @webtecnica (#2459).
