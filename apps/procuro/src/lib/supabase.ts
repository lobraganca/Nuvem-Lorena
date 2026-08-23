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

export const supabase = createClient(url, chaveAnonima, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
