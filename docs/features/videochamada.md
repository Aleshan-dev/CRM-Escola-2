# Videochamada (Jitsi Meet)

O botão **Vídeo** no cabeçalho da conversa abre uma sala de videochamada para
aquela conversa: o atendente entra pela tela, o contato entra pelo link que chega
no WhatsApp — sem instalar nada, sem conta, sem sair do atendimento.

A feature nasce **desligada**. Sem `JITSI_SERVER_URL` no `.env`, o botão não
renderiza: a tela fica igual a de antes, sem aviso e sem erro (`lib/video/jitsi.ts`).

## Para que serve, medido

A base já liga para o contato (chamada de voz: WaCalls #628/#697 e SIP #677), mas
só se ouve. Os três usos que aparecem nos clientes desta instalação são:

- **Telemedicina e teleatendimento** — o paciente chega pelo WhatsApp, o
  profissional envia o link da sala e o encontro acontece no celular do paciente.
  É o caso em que a URL do servidor próprio mais importa: a sala fica na
  infraestrutura de quem presta o cuidado.
- **Atendimento consultivo** — mostrar a tela, o produto, o formulário, o
  equipamento, o passo a passo de instalação.
- **Lives e reuniões rápidas da equipe** — a sala de uma conversa serve de sala
  de reunião sem conta em serviço de terceiro.

## Como funciona

1. O operador clica em **Vídeo** no cabeçalho (ao lado do botão de ligar).
2. Abre um `Dialog` com o iframe da sala `<JITSI_SERVER_URL>/deskcomm-<conversationId>`.
3. Duas saídas, ambas o **mesmo link**:
   - **Copiar link** — clipboard, sem tocar em API.
   - **Enviar link na conversa** — passa por `useSendMessage`, ou seja, herda
     janela fechada de 24h, suporte somente leitura e conversa encerrada; é a
     forma normal do contato receber a sala.

### A sala é a própria conversa

`deskcomm-<conversationId>`: o UUID da conversa já é o nome da sala. Não há
token a mais para armazenar nem estado novo no banco. Consequências, ambas
desejadas:

- **Reentrar é a mesma sala** — reenviar o link leva o contato para o que já
  está aberto, não para uma sala duplicada.
- **Quem tem o link entra.** O link é tratado como dado sensível (mesma régua
  do link de reset de senha): ele passa pelo chat, então quem lê o histórico da
  conversa o vê. Isso é verdade também no `meet.jit.si` público.

### Por que a URL vem de runtime

`JITSI_SERVER_URL` entra no payload do `<PublicEnvScript/>` e é lida por
`window.__PUBLIC_ENV__` — **não** por `NEXT_PUBLIC_*`. É a mesma razão da marca
e do DSN do Sentry: quem dá hospedagem roda uma imagem **pré-buildada** e o
valor do `next build` seria o errado. O defeito que ensinou a regra está no
cabeçalho de `app/public-env-script.tsx`.

## Limitações declaradas (não são acidentes)

- **Sem gravação.** Nada é gravado, arquivado nem indexado. Não há `record`.
- **Sem moderação/JWT do lado do Jitsi.** No servidor público, qualquer pessoa
  com o link entra (e o link está no histórico da conversa). Quem precisa de
  trava aponta `JITSI_SERVER_URL` para servidor próprio com JWT — a env aceita
  qualquer origem; o que muda é o endereço, não o desenho do produto.
- **Não é videochamada do WhatsApp.** A Cloud API não expõe chamada de vídeo;
  o caminho aqui é link de navegador, que é o que o canal já entrega bem.
- **Fora de `voice_calls`.** Não há linha de chamada, status, duração nem
  transcrição — videochamada não é chamada de voz com imagem.
- **O iframe pode ser bloqueado por `X-Frame-Options`/CSP do servidor Jitsi
  escolhido.** `meet.jit.si` permite embedding; um servidor próprio precisa
  liberar a origem do CRM.

## Living System Checklist

1. Entrada: `conversationId` do `ConversationHeader` (a conversa selecionada).
2. Saída: iframe da sala + link enviado por `useSendMessage` (mensagem normal,
   histórico do Inbox).
3. Registro: nenhuma migration, nenhuma tabela, nenhum campo novo.
4. Visibilidade: só o operador da conversa — o botão mora no mesmo cabeçalho
   que `Chamar`, com as mesmas permissões de tela.
5. Porta: `ConversationHeader` monta `VideoCallButton`; sem env, o componente
   devolve `null` (árvore vazia).
6. Anti-morte: diálogo abre com `data-testid`, `allow` de câmera/microfone/tela
   cheia (sem ele o navegador nega mídia), testes em
   `tests/unit/videochamada-jitsi.test.ts` e `tests/unit/videochamada-botao.test.tsx`.
7. Configuração: uma env opcional (`JITSI_SERVER_URL`), lida em runtime; vazio
   = feature off. Nenhuma credencial, nenhum token.
8. Continuidade: o atendimento IA/humano, a busca na conversa e os demais
   botões do cabeçalho não mudam; o link é uma mensagem como outra qualquer.
9. Retorno: falha de envio mostra "Não consegui enviar o link. Copie e cole na
   conversa." — o caminho de volta é copiar, não desistir.
10. i18n: toda chave nova tem `es` no `lib/i18n/dicionario.ts` (guarda
    `i18n-espanhol-cobre-a-tela`); `en` degrada para português (decisão 18.2).

## Mapa

- `lib/video/jitsi.ts` — resolução do servidor e da sala (puro, testável).
- `components/inbox/VideoCallButton.tsx` — botão, dialog, copiar/enviar link.
- `components/inbox/ConversationHeader.tsx` — montagem do botão.
- `app/public-env-script.tsx` + `types/public-env.d.ts` — injeção em runtime.
- `.env.example` § Videochamada — como ligar.
