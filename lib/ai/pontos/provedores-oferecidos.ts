/**
 * QUAIS PROVEDORES ESTA INSTALAÇÃO OFERECE — `PROVEDORES` menos o que está atrás
 * de módulo desligado.
 *
 * O login por assinatura (#1639) é o módulo `login_codex`, desligado por padrão
 * (doc 73: desligado, nada aparece para as empresas). A tela de Credenciais e o
 * leitor do login já respeitavam a chave; o painel de Provedores não: o GET
 * listava "OpenAI pela assinatura (ChatGPT)" para toda empresa, e o PUT/PATCH
 * gravavam a assinatura num ponto ou no padrão com o módulo fora.
 *
 * Mora fora de `./provedores` porque aquele arquivo é vocabulário puro, importado
 * por componentes de cliente; este lê o banco.
 *
 * Devolve um PREDICADO, e não a lista: quem lê (a lista da tela, as credenciais
 * que ela mostra) e quem escreve (o PUT do ponto, o PATCH do padrão) perguntam a
 * mesma coisa sobre um id, e a resposta vem de uma leitura só. Banco que não
 * respondeu = módulo desligado (falha fechada, como `modulosLigados`).
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import { moduloLigado } from "@/lib/instalacao/modulos";

import { ehProvedorSuportado, PROVEDOR_POR_ASSINATURA } from "./provedores";

export async function provedorOferecido(db: SupabaseClient): Promise<(id: string) => boolean> {
  const assinaturaLigada = await moduloLigado(db, "login_codex");
  return (id) =>
    ehProvedorSuportado(id) && (id !== PROVEDOR_POR_ASSINATURA || assinaturaLigada);
}
