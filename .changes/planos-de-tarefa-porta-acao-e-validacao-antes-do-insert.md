---
impacto: capacidade_nova
secao: adicionado
titulo: Tarefas ganham a tela Planos, a ação Aplicar um plano de tarefas e a validação do plano antes de qualquer gravação
---

Quem monta uma sequência de tarefa repetida no dia a dia escrevia os mesmos passos de novo a cada negócio, um por um. Agora a sequência se salva uma vez em **Tarefas › Planos** (porta nova, entrada no hub do CRM e no ⌘K, com rota própria em `settings/task-plans`), o editor de regras oferece a ação **Aplicar um plano de tarefas ao negócio** — com o seletor dos planos cadastrados, buscados pela mesma rota que a tela grava — e o motor aplica o plano na ordem, com a marca da aplicação guardada para não duplicar. O plano inteiro agora é conferido contra o negócio **antes** do primeiro INSERT: um passo sem dono ou com título vazio recusa o plano como um todo, em vez de deixar pela metade os passos que passavam — antes, dois disparos recriavam a mesma sobra e a pessoa apagava tarefa órfã. Entregue no PR #2213, issue #1752.
