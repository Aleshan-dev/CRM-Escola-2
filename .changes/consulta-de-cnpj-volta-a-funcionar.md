---
impacto: capacidade_nova
secao: corrigido
titulo: A consulta de CNPJ volta a funcionar — faltava um cabeçalho na chamada à BrasilAPI
---

Em **Empresas**, o botão "Consultar CNPJ" respondia sempre _"Não foi possível consultar o CNPJ"_, com a dica de que seria um bloqueio temporário e que valia tentar mais tarde. Não era: a chamada saía daqui **sem o cabeçalho `User-Agent`**, e a borda que serve a BrasilAPI recusa, com 403, todo pedido que não o traga. O `fetch` do Node não manda esse cabeçalho sozinho, então a consulta nunca funcionou em instalação nenhuma — não era o seu IP, nem limite de uso, nem indisponibilidade do serviço.

Medido contra o mesmo CNPJ, da mesma máquina e no mesmo minuto: **403** sem o cabeçalho, **200** com qualquer valor nele.

O conserto é o cabeçalho, e alcança os três caminhos que falam com a BrasilAPI: a consulta do cadastro de empresa, o enriquecimento automático de uma empresa já criada e a importação em lote. Quem recebia o erro pode repetir a consulta — o formulário volta a ser preenchido com razão social, nome fantasia, telefone e endereço completo.

O valor enviado é neutro e não leva o nome da marca: o cabeçalho sai para um terceiro, e uma instalação de marca própria não deve entregar o nome de quem a revende à BrasilAPI.
