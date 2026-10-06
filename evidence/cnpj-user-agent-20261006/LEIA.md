# Consulta de CNPJ — a BrasilAPI recusava por falta de `User-Agent`

Prova pela tela (DoD 12) do conserto de `lib/brasil-api/client.ts`.

## O sintoma

Na tela **Empresas** (`/app/companies`), "Consultar CNPJ" devolvia sempre
_"Não foi possível consultar o CNPJ."_ — e, junto, a dica _"A BrasilAPI recusou a
consulta (403). Pode ser bloqueio temporário; tente de novo mais tarde."_

As duas frases mandavam para o lugar errado. A primeira é o **texto de reserva**
de `app/app/companies/_client.tsx:97`, que só aparece quando o erro real não
chega; a segunda afirmava "temporário" sobre algo que era permanente e
determinístico.

## A medição que isolou a causa

O `curl` daqui respondia 200 e o aplicativo respondia 403, na mesma máquina e no
mesmo minuto. A diferença não estava na rede nem no IP: estava no cabeçalho. O
cliente mandava apenas `Accept: application/json`, e o `fetch` do Node não manda
`User-Agent` nenhum por conta própria.

Mesmo CNPJ (`00000000000191`), quatro variações:

```
403  fetch com { Accept } apenas        ← era exatamente o que daqui saía
403  fetch sem header nenhum
200  fetch + User-Agent: curl/8.7.1
200  fetch + User-Agent próprio
```

Controle pelo outro lado, com `curl`:

```
200  curl padrão (manda User-Agent sozinho)
429  curl -H 'User-Agent:'  (cabeçalho esvaziado à força)
```

O 403 vinha da borda da Vercel que serve a BrasilAPI (`id: gru1::…`), não do
nosso código nem da conta de ninguém. **Quebrava em toda instalação**, e nos três
caminhos que usam este cliente: o lookup do cadastro, o enriquecimento de
`lib/crm-b2b/enrich.ts` e a importação em lote de `lib/crm-b2b/import-process.ts`.

Reproduzido também pela rota, autenticado, antes do conserto:

```
GET /api/v1/companies/lookup?cnpj=00000000000191
HTTP 502  {"error":{"code":"upstream_error","message":"BrasilAPI respondeu 403."}}
```

## Depois, na tela

Abrindo **Nova empresa** e digitando o CNPJ:

![O diálogo "Nova empresa" com o CNPJ 00.000.000/0001-91 digitado, antes de consultar](evidence/cnpj-user-agent-20261006/1-cnpj-preenchido.png)

Clicando em "Consultar CNPJ", o formulário inteiro é preenchido — razão social,
nome fantasia, telefone, endereço, bairro, cidade, UF e CEP — com o aviso "Dados
públicos preenchidos. Revise antes de criar.":

![O mesmo diálogo depois da consulta, com BANCO DO BRASIL SA, DIRECAO GERAL, endereço em BRASILIA/DF e CEP 70040912 preenchidos](evidence/cnpj-user-agent-20261006/2-consulta-respondida.png)

## Por que o `User-Agent` é neutro

Ele **não** reusa o `APP_USER_AGENT` de `lib/nuvemshop/config.ts`. Lá o nome do
produto tem linha na allowlist de marca porque identifica uma aplicação
**registrada** na plataforma da Nuvemshop; aqui não existe registro nenhum — a
BrasilAPI só exige que o cabeçalho exista. Mandar o nome da marca entregaria o
revendedor a um terceiro, variaria por instalação (deixando o tráfego justamente
inidentificável) e pediria linha nova numa allowlist que, por doutrina, só
encolhe.

## A cerca

`lib/brasil-api/client.test.ts`, novo — este cliente não tinha nenhum teste
co-locado. Ele asserta a **existência** e o não-vazio do cabeçalho, nunca o texto
dele: trocar o valor é livre, apagá-lo tem de reprovar.

Provado com sabotagem: removendo o cabeçalho do cliente, `1 failed | 2 passed`
(`expected null to be truthy`); restaurando, `3 passed`.
