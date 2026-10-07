---
impacto: capacidade_nova
secao: alterado
titulo: A comanda do ganho passa a ser evento `lead.won` com opt-in por funil
---

Quem ganha um negócio não depende mais de ARRASTAR o card para receber a comanda: a abertura virou um consumidor do evento `lead.won`, que o banco grava em **qualquer** transição para ganho — o arrasto, o botão Ganhar, o mover em lote, a automação e o fechamento pela IA. Antes, só a rota de arrasto abria a comanda e todos os outros caminhos fechavam o negócio sem dizer nada ao financeiro.

A troca tem dois efeitos que o operador percebe. O primeiro é a **cobertura**: os cinco caminhos de ganho agora fazem a mesma coisa, com a mesma trava de idempotência (o vínculo em `crm_lead_links`), e a repetição do dreno de eventos devolve a comanda que já existe em vez de abrir outra. O segundo é a **porta**: a comanda do ganho agora é opt-in **por funil**, desligada por padrão, e se liga em Configurações › Funis, na caixa "Abrir comanda ao ganhar um negócio neste funil". Desligada — que é o estado de todo funil existente — ganhar não toca no financeiro, do jeito que era antes desta mudança; ligada, o arrasto e o botão Ganhar abrem a comanda com o valor e o contato do negócio. A decisão é do funil porque o valor do negócio é assunto do funil: em loja com checkout, infoproduto ou imobiliária o fecho não é conta a receber, e uma comanda aberta sem nada a cobrar vira lançamento real se alguém a finalizar.

Dois pontos que mudam de lugar e não de resultado: a comanda passa a nascer no dreno do barramento, alguns segundos depois do fecho, em vez do mesmo instante do arrasto; e o atendente da comanda sai do responsável pelo negócio (que pode não ter responsável) porque o registro de eventos não guarda quem fez. O item 3 da CR do mantenedor — pular a moeda diferente e auditar `comanda.aberta` com origem `ganho_no_kanban` — continua fora desta fatia.

Contribuição de @webtecnica (#2220, refs #1477).
