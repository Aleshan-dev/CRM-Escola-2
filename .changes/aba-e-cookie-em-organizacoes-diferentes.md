---
impacto: nada_mudou
secao: corrigido
titulo: Uma aba não escreve mais na organização de outra aba, e avisa quando a sessão mudou
---
O cookie `active_org` é um por sessão do navegador e vale para todas as abas, mas a organização que cada aba mostra vem das props do layout e fica fixa enquanto o documento vive. Quem trocava de empresa pelo seletor recarregava só a própria aba: as outras continuavam exibindo a organização antiga, e as leituras e as escritas daquela aba já iam para a organização do cookie — quase escrevendo automação na empresa errada. Agora a leitura avisa ("Esta aba está numa organização diferente da sessão. Recarregar?") em vez de recarregar sozinha, preservando o formulário em edição, e o servidor recusa a escrita com o código `org_divergente` quando a organização que a aba declara não bate com o cookie. Nada muda na configuração.
