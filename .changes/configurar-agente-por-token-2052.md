---
impacto: capacidade_nova
secao: adicionado
titulo: Um token novo com a permissão de configurar o agente edita, testa, publica e pausa o agente de IA sem a tela
---
Integrações (n8n, scripts, Claude Code) passam a poder ler e editar o cadastro e o rascunho do agente de IA, rodar o teste, publicar uma versão e pausar, desligar ou arquivar o agente por token de API, sem abrir o navegador. Isso exige criar um token NOVO em Configurações › API Tokens marcando a permissão nova de configurar o agente (`config:write`, e `config:read` para leitura) junto com "Tratar o token como administrador". Os tokens que já existem não mudam: mesmo os de administrador com permissão de agir no CRM continuam recebendo recusa nessas ações, e para quem não criar esse token novo publicar, pausar e testar o agente continuam exigindo a tela, como prometido antes. Toda alteração, pausa, publicação e teste feito por token fica na auditoria com o token identificado. Não é preciso fazer nada na instalação. Crédito: @webtecnica (issue #2052).
