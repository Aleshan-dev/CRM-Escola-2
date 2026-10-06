---
impacto: nada_mudou
secao: corrigido
titulo: O token com "gerente" e "administrador" marcados passa a valer como administrador
---

Em **Configurações › API Tokens**, quem marcava as duas caixas, "Tratar o token como gerente" e "Tratar o token como administrador", recebia um token que valia só como gerente. O papel saía do primeiro `role:` da lista de escopos, e a tela grava o de gerente antes do de administrador. Nas portas que exigem administrador, como editar, testar e publicar o agente de IA por token (`config:write`), a chamada voltava `403 forbidden_role` com _"Role 'manager' insufficient (required: 'admin')"_, mesmo com a caixa de administrador marcada.

Agora vale o maior papel marcado, em qualquer ordem. Token sem papel continua valendo como atendente (`agent`), como antes, e um token marcado só como leitor (`role:viewer`) continua leitor: o conserto não sobe o papel de ninguém além do que a própria tela concedeu.

Nada a fazer na instalação. Quem contornou o erro criando um token só com "administrador" não precisa mudar nada.
