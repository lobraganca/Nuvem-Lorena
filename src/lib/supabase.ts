import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * A conexão com o banco — quando ela existir.
 *
 * Hoje o Avena guarda tudo no navegador de cada pessoa. Isso funciona para
 * mostrar o app, e não funciona para nada além disso: a reserva que a viajante
 * faz no celular dela não chega ao celular da agência, porque são dois
 * armazenamentos que nunca se falam.
 *
 * Este arquivo é a porta por onde a troca vai acontecer, uma tela de cada vez.
 * Ele existe separado, e não espalhado pelo app, por um motivo prático: no dia
 * em que a chave mudar, ou em que o banco sair do Supabase, há um lugar só
 * para mexer.
 *
 * As duas variáveis são públicas de propósito. A chave publicável fica visível
 * para qualquer visitante que abrir o código da página, e isso não é falha:
 * sozinha ela não abre nada, porque toda leitura e toda escrita passam pelas
 * regras em supabase/migrations/0002_seguranca.sql. A chave que ignora essas
 * regras é a `service_role`, que nunca entra aqui — ela vive só no servidor.
 */

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

/** Há banco configurado nesta versão do site? */
export function hasDatabase(): boolean {
  return Boolean(url && key);
}

let cliente: SupabaseClient | null = null;

/**
 * O cliente, ou `null` quando o site foi publicado sem banco.
 *
 * Devolver `null` em vez de estourar um erro é deliberado: enquanto a migração
 * não termina, o app tem de continuar rodando com o armazenamento do navegador
 * para quem abrir uma versão sem as variáveis — inclusive a versão de teste que
 * a Lorena manda para as agências.
 */
export function supabase(): SupabaseClient | null {
  if (!hasDatabase()) return null;
  if (!cliente) {
    cliente = createClient(url as string, key as string, {
      auth: { persistSession: true, autoRefreshToken: true },
    });
  }
  return cliente;
}
