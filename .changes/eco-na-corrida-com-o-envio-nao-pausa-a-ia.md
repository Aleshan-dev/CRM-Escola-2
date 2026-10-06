---
impacto: nada_mudou
secao: corrigido
titulo: A IA não é mais pausada por engano quando o eco de uma mensagem enviada chega durante o próprio envio
---

Toda mensagem que o CRM envia pelo WhatsApp volta como um "eco" pelo webhook. Quando esse eco chegava enquanto o envio ainda estava sendo confirmado pelo WAHA, nenhuma das proteções o reconhecia: a conversa mostrava a mesma mensagem duas vezes e a IA era pausada por 1 hora, como se uma pessoa tivesse respondido pelo celular. O cliente que respondia nesse intervalo ficava sem resposta. Isso foi medido numa campanha real: o eco chegou 14 segundos depois do envio, e a confirmação caiu no meio do processamento dele.

Agora o eco é reconhecido nessa janela também: a linha duplicada sai e a IA continua atendendo. A limpeza do eco depois do envio também passou a reconhecer o eco que volta com o contato identificado de outro jeito (`@lid` de um lado, `@c.us` do outro).

Não há nada a configurar na atualização.
