# Videochamada (Jitsi Meet)

O botão **Vídeo** no cabeçalho da conversa abre uma sala de videochamada: o
atendente entra pela tela, o contato entra pelo link que chega na conversa — sem
instalar nada, sem conta, sem sair do atendimento.

A feature nasce **desligada**. Sem `JITSI_SERVER_URL` no `.env`, o botão não
renderiza: a tela fica igual a de antes, sem aviso e sem erro (`lib/video/jitsi.ts`).

## Para que serve, medido

A base já liga para o contato (chamada de voz: WaCalls #628/#697 e SIP #677), mas
só se ouve. Os usos que aparecem nos clientes desta instalação:

- **Telemedicina e teleatendimento** — o paciente chega pelo WhatsApp, o
  profissional envia o link da sala e o encontro acontece no celular do paciente.
  É o caso em que a URL do servidor próprio mais importa: a sala fica na
  infraestrutura de quem presta o cuidado.
- **Atendimento consultivo** — mostrar a tela, o produto, o formulário, o
  equipamento, o passo a passo de instalação.
- **Lives e reuniões rápidas da equipe** — a sala serve de sala de reunião sem
  conta em serviço de terceiro.

## Como funciona

1. O operador clica em **Vídeo** no cabeçalho (ao lado do botão de ligar).
2. Abre um `Dialog` com três saídas sobre **um mesmo link**:
   - **Abrir sala em nova aba** — `<JITSI_SERVER_URL>/sala-<uuid>`.
   - **Copiar link** — clipboard, sem tocar em API.
   - **Enviar link na conversa** — passa por `useSendMessage`, ou seja, é uma
     mensagem normal como outra qualquer.
3. Fechar o diálogo mata a sala. Reabrir gera **outro** link — é outra chamada.

### Por que NOVA ABA e não iframe

O iframe era o caminho óbvio e é o que o review do #2441 derrubou, por dois
motivos medidos no próprio app:

1. **`Permissions-Policy` de produção nega a mídia no iframe.** O `next.config.ts`
   manda `Permissions-Policy: camera=(), microphone=(self)` em **toda rota**. O
   iframe do Jitsi é outra origem, então dentro dele `camera=false` e
   `microphone=false` — a sala abriria muda, sem imagem e sem áudio. Medido no
   review: com o header de produção `{camera:false, microphone:false}`; sem ele,
   `true`. E o header é exatamente o que não se tira em produção.
2. **O `meet.jit.si` derruba chamada embutida em 5 minutos** (post oficial do
   Jitsi, 18/05/2023, "meet.jit.si – Embedded sessions are dropped after 5
   minutes"). Fora da página incorporada esse limite não se aplica.

Abrindo em aba nova (`target="_blank" rel="noopener noreferrer"`), a aba carrega
a página **do Jitsi**, com o `Permissions-Policy` e as regras **dele**: a
permissão de câmera/microfone acontece na origem certa, e o corte de 5 minutos
não existe. `rel="noopener"` para a sala não receber `window.opener` e não
manipular a tela de quem abriu.

### A sala é aleatória e dura uma chamada

`sala-<crypto.randomUUID()>`, gerado **no momento em que o diálogo abre** e
descartado quando fecha. Nada é gravado, nenhum estado novo no banco.

O formato anterior era `deskcomm-<conversationId>`, e o review do #2441 trocou
as duas metades dele:

- **O UUID da conversa saía para fora.** O link é dado sensível que vai parar na
  tela do cliente final — o id interno da nossa conversa não é informação dele.
- **A sala era fixa**, então o link de UMA consulta entraria na seguinte enquanto
  a conversa existir, e o segundo clique no botão reenviava a MESMA sala já
  aberta.

E o prefixo virou `sala-`, neutro: este link cai na tela de quem revende a
instalação, e a sala não é lugar de marca (`lib/video/jitsi.ts` fica de fora de
`MARCA_CONGELADA` por isso).

**Quem tem o link entra.** O link é tratado como dado sensível (mesma régua do
link de reset de senha): ele passa pelo chat, então quem lê o histórico da
conversa o vê. Vale também no `meet.jit.si` público.

### As duas travas de quem envia o link

O "Enviar link na conversa" não é um atalho em volta das regras: ele é o composer
enxuto, com a **mesma** régua.

1. **Janela de 24h.** `POST /api/v1/messages` só confere a janela para
   `api_token`/`ai_agent`; quem envia da tela entra como `user` e a rota **não
   barra** (`app/api/v1/messages/_handler.ts`, ~linha 548). Sem a trava aqui o
   link sairia como texto livre: a rota responde `201` e a plataforma recusa a
   entrega depois com `131047` — a falha silenciosa da #1614. Por isso o botão
   lê `estadoDaJanela(provider, last_inbound_at, agora)` de
   `lib/channels/janela.ts`, o mesmo código do composer, e desabilita o envio.
   **O motivo fica visível** (`data-testid="video-bloqueio"`): a regra não pode
   ser descoberta pelo erro da plataforma.
2. **Contato bloqueado/anonimizado e conversa encerrada.** Chegam prontos do
   header (`bloqueio`), montados com os mesmos critérios e os mesmos textos do
   composer.

Abrir a sala e copiar o link **não** dependem do canal: a janela fecha a
mensagem, não o navegador.

O que **não** entra: `supportReadonly` (somente leitura do suporte). Ele mora no
`user`, que o `ConversationHeader` não recebe — e não se afirma numa doc uma
trava que não se aplicou.

### Por que a URL vem de runtime

`JITSI_SERVER_URL` entra no payload do `<PublicEnvScript/>` e é lida por
`window.__PUBLIC_ENV__` — **não** por `NEXT_PUBLIC_*`. É a mesma razão da marca
e do DSN do Sentry: quem dá hospedagem roda uma imagem **pré-buildada** e o
valor do `next build` seria o errado. O defeito que ensinou a regra está no
cabeçalho de `app/public-env-script.tsx`.

A env é validada como URL `http(s)` no Zod (`lib/env.ts`) — desde o review do
#2441, porque este valor vira `href` de um `<a>`: um `javascript:` escrito no
`.env` seria código executando no clique. O formato é `.refine().catch()`, não
`.url()` puro, pelo motivo que a nota de `META_GRAPH_BASE_URL` registra: validação
que **derruba** roda no import do Next e derruba **todas** as telas com o
contêiner `healthy`. Aqui a ação falha fechada (URL inválida vira `""`, o botão
some, a feature desliga) e a informação sobe no log. O lado do navegador tem a
mesma triagem em `EH_HTTP` (`lib/video/jitsi.ts`), porque o payload injetado não
passa pelo Zod de novo.

## Onde aparece para o dono do servidor

`lib/recursos-opcionais/catalogo.ts` — linha **Videochamada (Jitsi Meet)**,
nível `servidor`, ao lado de "Chamada de voz pelo WhatsApp". Desligado por
padrão; `lib/recursos-opcionais/estado.ts` marca como ligado quando
`JITSI_SERVER_URL` resolve para uma origem `http(s)`. O mesmo valor que liga o
botão é o que a tela de Recursos opcionais mostra, então não há como as duas
telas discordarem.

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
- **A sala vale uma chamada.** Fechar o diálogo ou recarregar a página gera outro
  link; o contato não "reentra" na sala anterior pelo botão. Se precisar de
  reentrar, é copiar o link que já está na conversa.
- **A aba nova sai do CRM.** Não há vídeo da sala embutido na tela de
  atendimento: abrir é abrir o Jitsi na aba dele. É a troca que o
  `Permissions-Policy` do iframe impunha: câmera e microfone só funcionam fora
  da origem em que a página roda.

## Living System Checklist

1. Entrada: `conversationId`, `provider`, `last_inbound_at` e `bloqueio` do
   `ConversationHeader` (a conversa selecionada).
2. Saída: link de sala em nova aba + link enviado por `useSendMessage` (mensagem
   normal, histórico do Inbox).
3. Registro: nenhuma migration, nenhuma tabela, nenhum campo novo.
4. Visibilidade: só o operador da conversa — o botão mora no mesmo cabeçalho
   que `Chamar`, com as mesmas permissões de tela.
5. Porta: `ConversationHeader` monta `VideoCallButton`; sem env, o componente
   devolve `null` (árvore vazia).
6. Anti-morte: diálogo abre com `data-testid` (`btn-videochamada`,
   `btn-abrir-sala`, `btn-copiar-link-video`, `btn-enviar-link-video`,
   `video-bloqueio`), testes em `tests/unit/videochamada-jitsi.test.ts`
   (servidor, `EH_HTTP`, prefixo `sala-`, aleatoriedade) e
   `tests/unit/videochamada-botao.test.tsx` (nova aba, janela, bloqueio).
7. Configuração: uma env opcional (`JITSI_SERVER_URL`), validada e lida em
   runtime; vazio = feature off. Nenhuma credencial, nenhum token.
8. Continuidade: o atendimento IA/humano, a busca na conversa e os demais
   botões do cabeçalho não mudam; o link é uma mensagem como outra qualquer.
9. Retorno: falha de envio mostra "Não consegui enviar o link. Copie e cole na
   conversa." — o caminho de volta é copiar, não desistir.
10. i18n: toda chave nova tem `es` no `lib/i18n/dicionario.ts` (guarda
    `i18n-espanhol-cobre-a-tela`); `en` degrada para português (decisão 18.2).

## Mapa

- `lib/video/jitsi.ts` — servidor (`EH_HTTP`), sala (`novaSala`), URL (puro).
- `components/inbox/VideoCallButton.tsx` — botão, dialog, janela, copiar/enviar.
- `components/inbox/ConversationHeader.tsx` — montagem e `bloqueio`.
- `lib/env.ts` — `JITSI_SERVER_URL` validada (`.refine().catch()`).
- `lib/recursos-opcionais/{catalogo,estado}.ts` — a linha no catálogo.
- `app/public-env-script.tsx` + `types/public-env.d.ts` — injeção em runtime.
- `.env.example` § Videochamada — como ligar.
