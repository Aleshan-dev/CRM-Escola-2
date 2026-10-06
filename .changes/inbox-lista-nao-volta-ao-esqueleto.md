---
impacto: nada_mudou
secao: corrigido
titulo: A lista do inbox não volta ao esqueleto quando uma recarga não traz nada novo
---

Quem já tinha a caixa de entrada carregada via o inbox via a lista de conversas sumir e voltar como esqueletos no meio do uso: quando a leitura do atendimento automático respondia, a chave da busca da lista mudava, a resposta que já tinha chegado era descartada e uma segunda requisição saía ~2 s depois — de 1 a 3 s de tela vazia a cada carga do inbox, medido no trace do #2360. Um refetch que falhava com a lista na tela também a apagava e trocava a tela cheia por "Erro ao carregar conversas". Agora a lista anterior fica visível até a nova resposta chegar (ou falhar): só a primeira carga mostra o esqueleto, a falha de rede aparece como aviso sem destruir a tela, e a conversa aberta deixa de piscar junto. Nenhuma ação é necessária. Contribuição de @webtecnica (#2414).
