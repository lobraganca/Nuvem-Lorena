/**
 * A conexão com o banco.
 *
 * Um detalhe que não é detalhe: **a sessão precisa de `AsyncStorage`**.
 * O cliente do Supabase guarda o login em `localStorage` por padrão, que
 * não existe no React Native. Sem passar o armazenamento aqui, o app
 * funciona a sessão inteira e esquece quem entrou assim que fecha — e o
 * sintoma ("toda hora pede login de novo") não aponta para cá de jeito
 * nenhum.
 *
 * `detectSessionInUrl: false` pelo mesmo motivo: é comportamento de
 * navegador, e no aparelho ele só atrapalha o retorno do login social.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const chaveAnonima = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

/**
 * Falta de configuração é avisada aqui, alto e claro.
 *
 * A alternativa — deixar passar e quebrar na primeira consulta — produz um
 * app que abre, navega, e devolve "nada encontrado" em toda tela. Parece
 * banco vazio, e já custou horas de gente procurando defeito no lugar
 * errado. Melhor não abrir do que abrir mentindo.
 */
if (!url || !chaveAnonima) {
  throw new Error(
    'Faltam as chaves do banco. Defina EXPO_PUBLIC_SUPABASE_URL e ' +
      'EXPO_PUBLIC_SUPABASE_ANON_KEY no arquivo .env antes de abrir o app.',
  );
}

/**
 * Onde a sessão é guardada — e por que não é sempre o `AsyncStorage`.
 *
 * A versão web do app é publicada com `output: "static"`, o que significa
 * que cada tela é renderizada no **Node** antes de ir para o navegador. E
 * no Node não existe `AsyncStorage`: ele é uma ponte para o armazenamento
 * do aparelho, e do lado do servidor essa ponte não leva a lugar nenhum.
 *
 * O sintoma é violento e não aponta para cá: o servidor derruba a página
 * inteira ao montar o cliente do Supabase, antes de qualquer tela aparecer.
 * Não é erro de tela, é erro de arranque.
 *
 * A saída é um armazenamento de mentira para o servidor. Não guardar nada
 * lá é o certo, não um remendo: no servidor não HÁ sessão para guardar —
 * ninguém entrou ainda, a página está sendo montada para ser enviada. Quem
 * lê a sessão de verdade é o navegador, quando a página chega nele.
 */
const semLugarParaGuardar = {
  getItem: async () => null,
  setItem: async () => {},
  removeItem: async () => {},
};

const estaNoServidor = typeof window === 'undefined';

export const supabase = createClient(url, chaveAnonima, {
  auth: {
    storage: estaNoServidor ? semLugarParaGuardar : AsyncStorage,
    autoRefreshToken: true,
    // Renovar e guardar sessão no servidor não faz sentido pelo mesmo
    // motivo: não há dono para a sessão do lado de lá.
    persistSession: !estaNoServidor,
    detectSessionInUrl: false,
  },
});
