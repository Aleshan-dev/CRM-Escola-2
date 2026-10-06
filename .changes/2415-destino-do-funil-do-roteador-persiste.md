---
impacto: nada_mudou
secao: corrigido
titulo: O roteador volta a mostrar o funil e a etapa de destino depois de salvar e recarregar
---

O editor do roteador aceitava salvar o funil e a etapa de destino de uma intenção, mas ao recarregar a página os dois campos voltavam para "Sem destino — só escolher o agente". A gravação existia (o banco e a API de detalhe já lidavam com os campos); o que faltava era a tela enxergar o que estava salvo: a carga inicial do editor (server-side) não selecionava o funil e a etapa de destino dos membros, e o estado editável da tela não reidratava quando a busca em segundo plano devolvia a resposta completa da API.

Agora a carga inicial traz os dois campos e a tela reidrata o destino quando o dado carregado muda — sem sobrescrever uma edição local pendente. A regra continua a mesma: etapa vazia = primeira etapa aberta do funil; funil vazio = só escolher o agente. Nenhuma ação é necessária.
