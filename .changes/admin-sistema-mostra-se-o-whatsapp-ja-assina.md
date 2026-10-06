---
impacto: capacidade_nova
secao: adicionado
titulo: Admin › Sistema mostra se as entregas do WhatsApp já chegam assinadas
---

Ao lado do interruptor **"Exigir assinatura nas entregas do canal"**, em **Admin › Sistema**, a tela passa a dizer se as últimas entregas do WhatsApp chegaram assinadas (sim ou não), com a data da última assinada e da última sem assinatura, olhando os últimos 7 dias. Quando a resposta é sim e o interruptor está desligado, ela sugere: _"Pode ligar: o WhatsApp já assina."_

O "sim" só aparece quando **nenhuma** entrega chegou sem assinatura desde a primeira assinada. Assim, numa instalação com dois números em que só um assina, a tela não sugere ligar — ligar ali cortaria a entrada de mensagens do outro.

**O padrão não muda:** o interruptor continua desligado, e nada é ligado sozinho. Quem roda o WAHA do compose do Deskcomm passa a receber entregas assinadas a partir da versão que traz o conserto do nome da variável do segredo; a tela é o jeito de conferir isso antes de ligar a exigência. Só quem administra a plataforma vê esta informação.
