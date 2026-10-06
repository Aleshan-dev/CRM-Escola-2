---
impacto: nada_mudou
secao: corrigido
titulo: Ajustar o invariante que a própria branch criou deixa de pedir a válvula
---

A catraca de `tests/invariants/` barrava qualquer modificação contra o último commit, e isso incluía o invariante que a própria branch tinha acabado de criar e que a `main` nunca viu. A única saída era a válvula `DESKCOMM_GOV_INVARIANTS_EDIT=1`, reservada ao flip de `test.fails`, e ela já tinha sido usada duas vezes só por isso, na triagem de PRs de contribuidor. Uma válvula que vira rotina deixa de proteger.

Agora uma modificação passa sem válvula quando o caminho não existe em `origin/main` nem no ponto de onde a branch saiu dela. Para a `main` isso é um arquivo novo, e o PR o mostra inteiro para revisão. Invariante da `main` editado, apagado, renomeado ou revertido continua barrado, e sem a ref `origin/main` a guarda falha fechada como antes. O cabeçalho do hook registra o limite que foi medido: com a ref local desatualizada, um invariante que a `main` ganhou depois do último `git fetch` passa. Rodar `git fetch` antes de trabalhar fecha esse caso.

Não exige ação de ninguém.
