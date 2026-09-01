import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { continuarConectado } from "./continuarConectado";

/**
 * Cliente Supabase deste app (marketplace de profissionais).
 *
 * Este app é independente do Avena — cada um tem seu próprio projeto Supabase
 * (URL/anon key diferentes), então este arquivo não deve ser confundido com
 * src/lib/supabase.ts da raiz do repositório.
 *
 * As duas variáveis abaixo são públicas por natureza: a anon key sozinha não
 * abre nada, pois toda leitura/escrita passa pelas policies de RLS definidas
 * em supabase/migrations/*.sql. A service_role key NUNCA deve entrar aqui —
 * ela é usada somente dentro das Edge Functions (backend).
 */
// `trim()` porque copiar/colar no celular arrasta espaço e quebra de linha
// com muita facilidade — e uma chave com "\n" no fim é recusada pelo
// servidor sem nenhuma mensagem clara.
const url = (import.meta.env.VITE_SUPABASE_URL ?? "").trim();
const key = (import.meta.env.VITE_SUPABASE_ANON_KEY ?? "").trim();

/**
 * Diz o que está errado na configuração, em vez de só "não tem banco".
 *
 * Antes isto era um booleano: com a chave errada o app parecia configurado
 * e falhava em silêncio — o login criava a conta no servidor e nunca
 * entrava, sem nada na tela explicando. Agora a própria tela conta.
 */
export function problemaDeConfiguracao(): string | null {
  if (!url && !key) return "Faltam o endereço e a chave do Supabase.";
  if (!url) return "Falta o endereço do Supabase (VITE_SUPABASE_URL).";
  if (!key) return "Falta a chave do Supabase (VITE_SUPABASE_ANON_KEY).";
  if (!/^https:\/\/[a-z0-9-]+\.supabase\.(co|in)$/i.test(url)) {
    return `O endereço do Supabase parece errado: "${url}". Ele deve ser algo como https://seuprojeto.supabase.co`;
  }
  if (key.length < 30) {
    return "A chave do Supabase parece incompleta — confira se foi colada inteira.";
  }
  return null;
}

/** Endereço e chave, para quem precisa falar com o Supabase fora do cliente
 *  (a tela de configurações consulta as Edge Functions diretamente). */
export function credenciaisSupabase(): { url: string; key: string } {
  return { url, key };
}

export function hasDatabase(): boolean {
  return problemaDeConfiguracao() === null;
}

/**
 * Onde a sessão é guardada — e isso depende do que a pessoa escolheu na
 * tela de entrada (ver `continuarConectado.ts`).
 *
 * ── Por que um adaptador, e não `storage: localStorage` direto ───────
 * O cliente do Supabase é criado UMA vez, quando o app abre, e a escolha
 * é feita depois, na tela de login. Um `storage:` fixo congelaria a
 * decisão antes de ela ser tomada.
 *
 * Este adaptador decide a cada gravação, então marcar ou desmarcar a
 * caixa vale imediatamente, sem recarregar o app.
 *
 * A leitura procura nos DOIS lugares porque a escolha pode mudar com
 * uma sessão já guardada: quem entrou "conectado" e depois desmarca não
 * pode ser expulso na hora — a sessão dele está no `localStorage`, e a
 * próxima gravação (a renovação do token, que acontece de hora em hora)
 * a move sozinha para o lugar certo.
 *
 * Tudo dentro de `try` porque em aba anônima, ou com armazenamento
 * bloqueado nas configurações do navegador, qualquer um destes acessos
 * LANÇA — e uma exceção aqui derruba o app inteiro em tela branca, sem
 * dizer nada a quem só queria entrar.
 */
const armazenamentoDaSessao = {
  getItem(chave: string): string | null {
    try {
      return sessionStorage.getItem(chave) ?? localStorage.getItem(chave);
    } catch {
      return null;
    }
  },
  setItem(chave: string, valor: string): void {
    try {
      if (continuarConectado()) {
        localStorage.setItem(chave, valor);
        sessionStorage.removeItem(chave);
      } else {
        sessionStorage.setItem(chave, valor);
        localStorage.removeItem(chave);
      }
    } catch {
      /* Sem onde guardar, a sessão vale só enquanto o app estiver aberto.
         Continuar funcionando assim é melhor que não deixar entrar. */
    }
  },
  removeItem(chave: string): void {
    /* Sair tem que limpar os dois — senão a sessão "apagada" reaparece
       na próxima abertura, vinda do outro armazenamento. */
    try {
      localStorage.removeItem(chave);
    } catch {
      /* nada a fazer */
    }
    try {
      sessionStorage.removeItem(chave);
    } catch {
      /* nada a fazer */
    }
  },
};

let client: SupabaseClient | null = null;

export function supabase(): SupabaseClient | null {
  if (!hasDatabase()) return null;
  if (!client) {
    try {
      client = createClient(url, key, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
          storage: armazenamentoDaSessao,
        },
      });
    } catch (err) {
      // createClient lança com valores malformados. Sem este try, a exceção
      // sobe no meio da renderização e o app vira uma tela branca — que não
      // diz nada a quem está tentando configurar.
      console.error("Falha ao criar o cliente Supabase:", err);
      return null;
    }
  }
  return client;
}
