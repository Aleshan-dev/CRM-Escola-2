---
impacto: capacidade_nova
secao: adicionado
titulo: Videochamada por Jitsi Meet direto da conversa
---

O cabeçalho da conversa ganha o botão **Vídeo**. Ele abre uma sala de
videochamada para aquela conversa — `<servidor>/deskcomm-<conversationId>` — e
as duas formas de chamar o contato saem de lá: **Copiar link** e **Enviar link
na conversa**, este pelo mesmo caminho de qualquer mensagem (janela de 24h,
suporte somente leitura e conversa encerrada seguem valendo).

O alvo é o contato que já está no WhatsApp: o link chega na conversa e ele
entra pelo celular, sem instalar nada e sem criar conta. Telemedicina e
teleatendimento é o caso em que isso mais muda — o encontro acontece onde o
paciente já está; demonstração e reunião rápida da equipe usam a mesma sala.

A feature nasce desligada: sem `JITSI_SERVER_URL` no `.env`, o botão não
renderiza e a tela não muda. A URL é lida em runtime (mesmo caminho da marca e
do DSN do Sentry), então apontar para o servidor próprio não exige rebuild.
Para ligar, `docs/features/videochamada.md` e o bloco do `.env.example`.

Sem gravação, sem linha em `voice_calls`, sem migration. Quem tem o link entra
— é a mesma natureza do link de reset de senha, e a doc declara essa e as
outras limitações (inclusive a saída de servidor próprio com JWT).

Refs #2440

Contribuição de @webtecnica.
